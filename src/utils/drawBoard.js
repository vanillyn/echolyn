import sharp from 'sharp';
import path from 'node:path';

const squareSize = 32;
const boardSize = squareSize * 8;

const coordSize = 20;
const playerAreaHeight = 24;
const playerPadding = 10;
const evalBarWidth = 56;
const pieceScale = 0.85;
const files = 'abcdefgh';
const ranks = '87654321';

const defaultLightColor = { r: 230, g: 230, b: 230, alpha: 1 };
const defaultDarkColor = { r: 112, g: 112, b: 112, alpha: 1 };
const defaultBorderColor = { r: 30, g: 30, b: 30, alpha: 1 };
const defaultCheckColor = { r: 255, g: 0, b: 0, alpha: 0.45 };
const defaultArrowColor = { r: 0, g: 255, b: 0, alpha: 0.8 };
const watermarkTextDefault = process.env.BOT_NAME || 'echolyn';

function svgTextBuffer(text, width, height, opts = {}) {
	const {
		fontSize = Math.round(Math.min(width, height) * 0.4),
		fill = '#aaaaaa',
		anchor = 'middle',
		fontFamily = 'Arial, Helvetica, sans-serif',
	} = opts;

	const x = anchor === 'start' ? 6 : anchor === 'end' ? width - 6 : width / 2;
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <style>
      .t{ fill:${fill}; font-family: ${fontFamily}; font-size:${fontSize}px; }
    </style>
    <text x="${x}" y="50%" dominant-baseline="middle" text-anchor="${anchor}" class="t">${text}</text>
  </svg>`;
	return Buffer.from(svg);
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function mapSquarePos(rankIdx, fileIdx, borderTop, borderLeft, flip) {
	const r = flip ? 7 - rankIdx : rankIdx;
	const f = flip ? 7 - fileIdx : fileIdx;
	return {
		left: borderLeft + f * squareSize,
		top: borderTop + r * squareSize,
	};
}

function algebraicToCoords(square) {
	if (!square || square.length !== 2) return null;
	const file = square.charCodeAt(0) - 97;
	const rank = 8 - parseInt(square[1]);
	if (file < 0 || file > 7 || rank < 0 || rank > 7) return null;
	return { rank, file };
}

function createArrowSvg(fromSquare, toSquare, flip, boardSize, squareSize) {
	const from = algebraicToCoords(fromSquare);
	const to = algebraicToCoords(toSquare);
	if (!from || !to) return null;

	const fromPos = mapSquarePos(from.rank, from.file, 0, 0, flip);
	const toPos = mapSquarePos(to.rank, to.file, 0, 0, flip);

	const fromX = fromPos.left + squareSize / 2;
	const fromY = fromPos.top + squareSize / 2;
	const toX = toPos.left + squareSize / 2;
	const toY = toPos.top + squareSize / 2;

	const dx = toX - fromX;
	const dy = toY - fromY;
	const length = Math.sqrt(dx * dx + dy * dy);

	if (length < 10) return null;

	const unitX = dx / length;
	const unitY = dy / length;

	const arrowLength = Math.min(length * 0.3, squareSize * 0.4);
	const arrowWidth = arrowLength * 0.6;

	const arrowTipX = toX - unitX * squareSize * 0.15;
	const arrowTipY = toY - unitY * squareSize * 0.15;

	const perpX = -unitY;
	const perpY = unitX;

	const arrowBase1X = arrowTipX - unitX * arrowLength - perpX * arrowWidth / 2;
	const arrowBase1Y = arrowTipY - unitY * arrowLength - perpY * arrowWidth / 2;
	const arrowBase2X = arrowTipX - unitX * arrowLength + perpX * arrowWidth / 2;
	const arrowBase2Y = arrowTipY - unitY * arrowLength + perpY * arrowWidth / 2;

	const shaftWidth = squareSize * 0.12;
	const shaftStart = squareSize * 0.15;
	const shaftEnd = length - arrowLength * 0.7;

	const shaftStartX = fromX + unitX * shaftStart;
	const shaftStartY = fromY + unitY * shaftStart;
	const shaftEndX = fromX + unitX * shaftEnd;
	const shaftEndY = fromY + unitY * shaftEnd;

	const shaft1X = shaftStartX - perpX * shaftWidth / 2;
	const shaft1Y = shaftStartY - perpY * shaftWidth / 2;
	const shaft2X = shaftStartX + perpX * shaftWidth / 2;
	const shaft2Y = shaftStartY + perpY * shaftWidth / 2;
	const shaft3X = shaftEndX + perpX * shaftWidth / 2;
	const shaft3Y = shaftEndY + perpY * shaftWidth / 2;
	const shaft4X = shaftEndX - perpX * shaftWidth / 2;
	const shaft4Y = shaftEndY - perpY * shaftWidth / 2;

	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${boardSize}" height="${boardSize}">
		<defs>
			<filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
				<feDropShadow dx="1" dy="1" stdDeviation="1" flood-color="black" flood-opacity="0.3"/>
			</filter>
		</defs>
		<polygon points="${shaft1X},${shaft1Y} ${shaft2X},${shaft2Y} ${shaft3X},${shaft3Y} ${shaft4X},${shaft4Y}" 
			fill="rgba(0,255,0,0.8)" stroke="rgba(0,200,0,0.9)" stroke-width="1" filter="url(#shadow)"/>
		<polygon points="${arrowTipX},${arrowTipY} ${arrowBase1X},${arrowBase1Y} ${arrowBase2X},${arrowBase2Y}" 
			fill="rgba(0,255,0,0.8)" stroke="rgba(0,200,0,0.9)" stroke-width="1" filter="url(#shadow)"/>
	</svg>`;

	return Buffer.from(svg);
}

export async function drawBoard(fen, options = {}) {
	options = options || {};
	const flip = Boolean(options.flip);
	const lightColor = options.lightColor || defaultLightColor;
	const darkColor = options.darkColor || defaultDarkColor;
	const borderColor = options.borderColor || defaultBorderColor;
	const checkColor = options.checkColor || defaultCheckColor;
	const watermarkText = options.watermark || watermarkTextDefault;

	const showEval = typeof options.eval === 'number';
	const showClocks = options.clocks && (options.clocks.white || options.clocks.black);
	const showPlayers = options.players && (options.players.white || options.players.black);
	const showPlayerArea = showClocks || showPlayers;

	let borderTop = showPlayerArea ? playerAreaHeight + playerPadding : 0;
	let borderBottom = showPlayerArea ? playerAreaHeight + playerPadding : 0;
	let borderLeft = 0;
	let borderRight = showEval ? evalBarWidth : 0;

	const fullWidth = borderLeft + boardSize + borderRight;
	const fullHeight = borderTop + boardSize + borderBottom;

	let canvas = sharp({
		create: {
			width: fullWidth,
			height: fullHeight,
			channels: 4,
			background: borderColor,
		},
	});

	let overlays = [];

	for (let rank = 0; rank < 8; rank++) {
		for (let file = 0; file < 8; file++) {
			const isDark = (rank + file) % 2 === 1;
			const color = isDark ? darkColor : lightColor;
			const pos = mapSquarePos(rank, file, borderTop, borderLeft, false);
			overlays.push({
				input: {
					create: {
						width: squareSize,
						height: squareSize,
						channels: 4,
						background: color,
					},
				},
				left: pos.left,
				top: pos.top,
			});
		}
	}

	const fenParts = fen.split(' ');
	const fenRanks = fenParts[0].split('/');
	if (fenRanks.length !== 8) throw new Error('invalid fen: expected 8 ranks');

	for (let rankIdx = 0; rankIdx < 8; rankIdx++) {
		const rankStr = fenRanks[rankIdx];
		let fileIdx = 0;
		for (const ch of rankStr) {
			if (/[1-8]/.test(ch)) {
				fileIdx += parseInt(ch);
				continue;
			}
			const color = ch === ch.toUpperCase() ? 'w' : 'b';
			const piece = ch.toLowerCase();
			const pieceLetter = { p: 'P', n: 'N', b: 'B', r: 'R', q: 'Q', k: 'K' }[piece];
			if (!pieceLetter) {
				fileIdx++;
				continue;
			}
			const set = options.pieceSet || 'assets/pixel';
			const piecePath = path.resolve(set, `${color}${pieceLetter}.png`);
			const pieceSize = Math.floor(squareSize * pieceScale);
			const offset = Math.floor((squareSize - pieceSize) / 2);

			const pos = mapSquarePos(rankIdx, fileIdx, borderTop, borderLeft, flip);

			try {
				const pieceBuffer = await sharp(piecePath)
					.resize(pieceSize, pieceSize)
					.png()
					.toBuffer();
				overlays.push({
					input: pieceBuffer,
					left: pos.left + offset,
					top: pos.top + offset,
				});
			} catch (err) {
				console.error(`Failed to load piece: ${piecePath}`, err);
			}

			fileIdx++;
		}
		if (fileIdx !== 8)
			throw new Error(`Invalid rank ${rankIdx + 1} in FEN: file count ${fileIdx}`);
	}

	if (options.checkSquare) {
		const cs = options.checkSquare;
		const csRank = cs.rank;
		const csFile = cs.file;
		if (csRank < 0 || csRank > 7 || csFile < 0 || csFile > 7)
			throw new Error('Invalid checkSquare coordinates');
		const mapped = mapSquarePos(csRank, csFile, borderTop, borderLeft, flip);
		overlays.push({
			input: {
				create: {
					width: squareSize,
					height: squareSize,
					channels: 4,
					background: checkColor,
				},
			},
			left: mapped.left,
			top: mapped.top,
		});
	}

	if (options.bestMove && options.bestMove.length >= 4) {
		const fromSquare = options.bestMove.slice(0, 2);
		const toSquare = options.bestMove.slice(2, 4);
		const arrowSvg = createArrowSvg(fromSquare, toSquare, flip, boardSize, squareSize);
		if (arrowSvg) {
			overlays.push({
				input: arrowSvg,
				left: borderLeft,
				top: borderTop,
			});
		}
	}

	const coordFill = 'rgba(14, 14, 14, 0.5)';
	const coordFontSize = 14;

	for (let i = 0; i < 8; i++) {
		const fileChar = flip ? files[7 - i] : files[i];
		const svgBottom = svgTextBuffer(fileChar, squareSize, coordSize, {
			fontSize: coordFontSize,
			fill: coordFill,
			anchor: 'middle',
		});
		const left = borderLeft + i * squareSize;
		const top = borderTop + boardSize - coordSize;
		overlays.push({ input: svgBottom, left, top });
	}

	for (let i = 0; i < 8; i++) {
		const rankChar = flip ? ranks[7 - i] : ranks[i];
		const svgLeft = svgTextBuffer(rankChar, coordSize, squareSize, {
			fontSize: coordFontSize,
			fill: coordFill,
			anchor: 'start',
		});
		const top = borderTop + i * squareSize;
		const left = borderLeft;
		overlays.push({ input: svgLeft, left, top });
	}

	if (showPlayerArea) {
		const nameFontSize = 14;
		const topPlayer = flip ? 'white' : 'black';
		const bottomPlayer = flip ? 'black' : 'white';
		let topName = (options.players && options.players[topPlayer]) || '';
		const topElo = options.elo && options.elo[topPlayer];
		if (topElo) topName += ` (${topElo})`;
		let bottomName = (options.players && options.players[bottomPlayer]) || '';
		const bottomElo = options.elo && options.elo[bottomPlayer];
		if (bottomElo) bottomName += ` (${bottomElo})`;
		const topClock = (options.clocks && options.clocks[topPlayer]) || '';
		const bottomClock = (options.clocks && options.clocks[bottomPlayer]) || '';

		const playerWidth = boardSize;
		const playerLeft = borderLeft;

		const topSvgText = `<svg xmlns="http://www.w3.org/2000/svg" width="${playerWidth}" height="${playerAreaHeight}">
      <style>.t{ fill:#ddd; font-family: Arial, sans-serif; font-size:${nameFontSize}px }</style>
      <text x="6" y="50%" dominant-baseline="middle" text-anchor="start" class="t">${topName}</text>
      <text x="${
			playerWidth - 6
		}" y="50%" dominant-baseline="middle" text-anchor="end" class="t">${topClock}</text>
    </svg>`;
		const topPlayerY = 0;
		overlays.push({ input: Buffer.from(topSvgText), left: playerLeft, top: topPlayerY });

		const bottomSvgText = `<svg xmlns="http://www.w3.org/2000/svg" width="${playerWidth}" height="${playerAreaHeight}">
      <style>.t{ fill:#ddd; font-family: Arial, sans-serif; font-size:${nameFontSize}px }</style>
      <text x="6" y="50%" dominant-baseline="middle" text-anchor="start" class="t">${bottomName}</text>
      <text x="${
			playerWidth - 6
		}" y="50%" dominant-baseline="middle" text-anchor="end" class="t">${bottomClock}</text>
    </svg>`;
		const bottomPlayerY = fullHeight - playerAreaHeight;
		overlays.push({ input: Buffer.from(bottomSvgText), left: playerLeft, top: bottomPlayerY });
	}

	const watermarkWidth = 80;
	const watermarkSvg = svgTextBuffer(watermarkText, watermarkWidth, coordSize, {
		fontSize: 12,
		fill: '#bbbbbb',
		anchor: 'end',
	});
	overlays.push({ input: watermarkSvg, left: fullWidth - watermarkWidth - 6, top: 12 });

	if (showEval) {
		let ev = Number(options.eval);
		if (!Number.isFinite(ev)) ev = 0;
		ev = clamp(ev, -10, 10);
		const whitePercent = (ev + 10) / 20;
		const whiteHeight = Math.round(boardSize * whitePercent);
		const blackHeight = boardSize - whiteHeight;

		const evalLeft = boardSize;
		const evalTop = borderTop;

		if (blackHeight > 0) {
			overlays.push({
				input: {
					create: {
						width: evalBarWidth,
						height: blackHeight,
						channels: 4,
						background: { r: 80, g: 80, b: 80, alpha: 1 },
					},
				},
				left: evalLeft,
				top: evalTop,
			});
		}

		if (whiteHeight > 0) {
			const whiteTop = evalTop + boardSize - whiteHeight;
			overlays.push({
				input: {
					create: {
						width: evalBarWidth,
						height: whiteHeight,
						channels: 4,
						background: { r: 240, g: 240, b: 240, alpha: 1 },
					},
				},
				left: evalLeft,
				top: whiteTop,
			});
		}

		const evalLabel =
			(ev >= 0 ? '+' : '') + (Math.abs(ev) < 10 ? ev.toFixed(2) : ev.toString());
		const evalSvg = svgTextBuffer(evalLabel, evalBarWidth, 18, { fontSize: 12, fill: '#eee' });
		const evalLabelY = borderTop + boardSize + 4;
		overlays.push({ input: evalSvg, left: evalLeft, top: evalLabelY });
	}

	canvas = canvas.composite(overlays);

	return await canvas
		.png({
			compressionLevel: 9,
			adaptiveFiltering: true,
		})
		.toBuffer();
}

export default { drawBoard };