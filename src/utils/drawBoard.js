import puppeteer from 'puppeteer';
import fs from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_CONFIG = {
	size: 512,
	lightColor: '#f0d9b5',
	darkColor: '#b58863',
	borderColor: '#8b7355',
	coordinateColor: '#333',
	playerBgColor: 'rgba(255,255,255,0.1)',
	playerTextColor: '#ffffff',
	clockTextColor: '#ffffff',
	evalBarWhite: '#f0f0f0',
	evalBarBlack: '#333333',
	evalBarBorder: '#555555',
	evalTextColor: '#888888',
	watermarkColor: 'rgba(255,255,255,0.7)',
	arrowColor: 'rgba(208, 228, 208, 0.8)',
	checkColor: 'rgba(255, 0, 0, 0.4)',
	pieceSet: 'cburnett',
	showCoordinates: true,
	coordinatePosition: 'inside',
	borderRadius: 8,
	shadowEnabled: true,
	arrowStyle: 'default',
	watermark: 'echolyn',
	backgroundImage: null,
};

class ChessBoardRenderer {
	constructor() {
		this.browser = null;
		this.configs = new Map();
	}

	async init() {
		this.browser = await puppeteer.launch({
			headless: true,
			args: ['--no-sandbox', '--disable-setuid-sandbox'],
		});
	}

	async close() {
		if (this.browser) await this.browser.close();
	}

	getUserConfig(userId) {
		return { ...DEFAULT_CONFIG, ...this.configs.get(userId) };
	}

	setUserConfig(userId, config) {
		const current = this.getUserConfig(userId);
		this.configs.set(userId, { ...current, ...config });
	}

	async renderBoard(fen, options = {}, userId = null) {
		const config = userId ? this.getUserConfig(userId) : DEFAULT_CONFIG;
		const mergedOptions = { ...config, ...options };

		const page = await this.browser.newPage();

		try {
			await page.setViewport({
				width: mergedOptions.size + 300,
				height: mergedOptions.size + 300,
			});

			const html = await this.generateHTML(fen, mergedOptions);

			await page.setContent(html, { waitUntil: 'networkidle0' });
			await page.waitForSelector('#board-container', { timeout: 5000 });

			await new Promise(resolve => setTimeout(resolve, 100));

			const element = await page.$('#board-container');
			const buffer = await element.screenshot({
				type: 'png',
				omitBackground: false,
			});

			return buffer;
		} finally {
			await page.close();
		}
	}

	async generateHTML(fen, options) {
		const {
			size,
			flip = false,
			players = {},
			clocks = {},
			eval: evaluation,
			bestMove,
			checkSquare,
			lightColor,
			darkColor,
			borderColor,
			coordinateColor,
			playerBgColor,
			playerTextColor,
			clockTextColor,
			evalBarWhite,
			evalBarBlack,
			evalBarBorder,
			evalTextColor,
			watermarkColor,
			arrowColor,
			checkColor,
			pieceSet,
			showCoordinates,
			coordinatePosition,
			borderRadius,
			shadowEnabled,
			arrowStyle,
			watermark,
			backgroundImage,
		} = options;

		const squareSize = size / 8;
		const playerHeight = 32;
		const evalWidth = 30;
		const padding = 16;

		const showPlayers = players.white || players.black || clocks.white || clocks.black;
		const showEval = evaluation !== undefined;

		const boardWidth = size;
		const boardHeight = size + (showPlayers ? playerHeight * 2 + padding : 0);
		const totalWidth = boardWidth + (showEval ? evalWidth + padding : 0) + padding * 2;
		const totalHeight = boardHeight + padding * 2;
		const pieceImages = await this.loadPieceImages(pieceSet);

		return `<!DOCTYPE html>
<html>
<head>
  <style>
    body { 
      margin: 0; 
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
      background: ${borderColor}; 
      padding: 20px;
    }
    #board-container { 
      display: inline-block; 
      padding: ${padding}px; 
      background: ${
			backgroundImage
				? `url('${backgroundImage}') no-repeat center center / cover`
				: borderColor
		};
      border-radius: ${borderRadius}px;
      ${shadowEnabled ? `box-shadow: 0 4px 12px rgba(0,0,0,0.3);` : ''}
      position: relative;
    }
    .content { 
      display: flex; 
      align-items: flex-start; 
      gap: ${padding}px;
    }
    .chess-board { 
      width: ${size}px; 
      height: ${size}px; 
      border: 2px solid ${borderColor};
      border-radius: 4px;
      position: relative;
      background: ${lightColor};
      overflow: hidden;
    }
    .square { 
      position: absolute; 
      width: ${squareSize}px; 
      height: ${squareSize}px; 
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .square.dark { background: ${darkColor}; }
    .square.light { background: ${lightColor}; }
    .square.check { 
      background: ${checkColor} !important; 
      ${shadowEnabled ? `box-shadow: inset 0 0 10px rgba(255,0,0,0.5);` : ''}
    }
    .piece { 
      width: ${squareSize * 0.9}px; 
      height: ${squareSize * 0.9}px;
      background-size: contain;
      background-repeat: no-repeat;
      background-position: center;
      ${shadowEnabled ? `filter: drop-shadow(1px 1px 2px rgba(0,0,0,0.3));` : ''}
    }
    .coord { 
      position: absolute; 
      font-size: ${Math.max(10, size / 45)}px; 
      color: ${coordinateColor};
      font-weight: 600;
      text-shadow: none;
    }
    .coord.file { 
      bottom: ${coordinatePosition === 'outside' ? '-18px' : '2px'}; 
      right: ${coordinatePosition === 'outside' ? '50%' : '4px'};
      ${coordinatePosition === 'outside' ? 'transform: translateX(50%);' : ''}
    }
    .coord.rank { 
      top: ${coordinatePosition === 'outside' ? '-18px' : '2px'}; 
      left: ${coordinatePosition === 'outside' ? '50%' : '4px'};
      ${coordinatePosition === 'outside' ? 'transform: translateX(-50%);' : ''}
    }
    .player-info { 
      height: ${playerHeight}px; 
      width: ${size}px;
      display: flex; 
      justify-content: space-between; 
      align-items: center;
      padding: 0 12px;
      background: ${playerBgColor};
      color: ${playerTextColor};
      font-size: 14px;
      margin: 8px 0;
      border-radius: 4px;
      ${shadowEnabled ? `box-shadow: inset 0 1px 3px rgba(0,0,0,0.2);` : ''}
    }
    .player-name {
      font-weight: 500;
      color: ${playerTextColor};
    }
    .player-clock {
      font-family: 'Courier New', monospace;
      font-weight: bold;
      color: ${clockTextColor};
      background: rgba(0,0,0,0.2);
      padding: 2px 8px;
      border-radius: 3px;
    }
    .eval-bar {
      width: ${evalWidth}px;
      height: ${size}px;
      border: 2px solid ${evalBarBorder};
      border-radius: 8px;
      position: relative;
      overflow: hidden;
      ${shadowEnabled ? `box-shadow: inset 0 2px 4px rgba(0,0,0,0.2);` : ''}
    }
    .eval-white { 
      background: ${evalBarWhite}; 
      position: absolute; 
      bottom: 0; 
      width: 100%; 
    }
    .eval-black { 
      background: ${evalBarBlack}; 
      position: absolute; 
      top: 0; 
      width: 100%; 
    }
    .eval-label {
      position: absolute;
      width: 100%;
      text-align: center;
      top: 50%;
      transform: translateY(-50%);
      font-size: 11px;
      color: ${evalTextColor};
      font-weight: bold;
      font-family: 'Courier New', monospace;
      text-shadow: 1px 1px 1px rgba(255,255,255,0.8);
      background: rgba(255,255,255,0.9);
      margin: 0 4px;
      border-radius: 2px;
      padding: 1px 0;
    }
    .watermark {
      position: absolute;
      bottom: 6px;
      right: 12px;
      font-size: 11px;
      color: ${watermarkColor};
      font-weight: 500;
      text-shadow: 1px 1px 1px rgba(0,0,0,0.5);
    }
    .arrow {
      position: absolute;
      pointer-events: none;
      z-index: 100;
    }
    .arrow-line {
      stroke: ${arrowColor};
      stroke-width: ${arrowStyle === 'thick' ? '8' : arrowStyle === 'thin' ? '4' : '6'};
      stroke-linecap: round;
      marker-end: url(#arrowhead);
      ${shadowEnabled ? `filter: drop-shadow(2px 2px 3px rgba(0,0,0,0.4));` : ''}
    }
    .highlight {
      position: absolute;
      border: 3px solid ${arrowColor};
      border-radius: 50%;
      width: ${squareSize - 6}px;
      height: ${squareSize - 6}px;
      top: 3px;
      left: 3px;
      pointer-events: none;
      ${shadowEnabled ? `box-shadow: 0 0 8px ${arrowColor};` : ''}
    }
  </style>
</head>
<body>
  <div id="board-container">
    <div class="content">
      <div class="board-section">
        ${showPlayers ? this.renderPlayers(players, clocks, flip, true, options) : ''}
        <div class="chess-board">
          ${this.renderSquares(size, flip, checkSquare, options)}
          ${this.renderCoords(size, flip, showCoordinates, coordinatePosition)}
          ${await this.renderPieces(fen, size, flip, pieceImages)}
          ${
				bestMove
					? this.renderArrow(bestMove, size, flip, arrowColor, arrowStyle, shadowEnabled)
					: ''
			}
        </div>
        ${showPlayers ? this.renderPlayers(players, clocks, flip, false, options) : ''}
      </div>
      ${showEval ? this.renderEval(evaluation, size, options) : ''}
    </div>
    <div class="watermark">${watermark}</div>
  </div>
</body>
</html>`;
	}

	renderPlayers(players, clocks, flip, isTop, options) {
		const color = (isTop && !flip) || (!isTop && flip) ? 'black' : 'white';
		const player = players[color] || '';
		const clock = clocks[color] || '';

		if (!player && !clock) return '';

		return `<div class="player-info">
      <span class="player-name">${player}</span>
      ${clock ? `<span class="player-clock">${clock}</span>` : ''}
    </div>`;
	}

	renderSquares(size, flip, checkSquare) {
		const squareSize = size / 8;
		let squares = '';

		for (let fenRank = 0; fenRank < 8; fenRank++) {
			for (let fenFile = 0; fenFile < 8; fenFile++) {
				const boardRank = flip ? 7 - fenRank : fenRank;
				const boardFile = flip ? 7 - fenFile : fenFile;

				const left = boardFile * squareSize;
				const top = boardRank * squareSize;

				const isLight = (fenRank + fenFile) % 2 === 0;

				let isCheck = false;
				if (checkSquare) {
					const checkRank = flip ? 7 - checkSquare.rank : checkSquare.rank;
					const checkFile = flip ? 7 - checkSquare.file : checkSquare.file;
					isCheck = checkRank === boardRank && checkFile === boardFile;
				}

				squares += `<div class="square ${isLight ? 'light' : 'dark'} ${
					isCheck ? 'check' : ''
				}" 
        style="left:${left}px; top:${top}px;"></div>`;
			}
		}

		return squares;
	}

	renderCoords(size, flip, showCoordinates, coordinatePosition) {
		if (!showCoordinates || coordinatePosition === 'none') return '';

		const squareSize = size / 8;
		const files = 'abcdefgh';
		const ranks = '87654321';
		let coords = '';

		for (let fenRank = 0; fenRank < 8; fenRank++) {
			for (let fenFile = 0; fenFile < 8; fenFile++) {
				const boardRank = flip ? 7 - fenRank : fenRank;
				const boardFile = flip ? 7 - fenFile : fenFile;
				const left = boardFile * squareSize;
				const top = boardRank * squareSize;

				if (fenRank === 7) {
					coords += `<div class="coord file" style="left:${
						left + squareSize - 10
					}px; top:${top + squareSize - 14}px;">${files[fenFile]}</div>`;
				}

				if (fenFile === 0) {
					coords += `<div class="coord rank" style="left:${left + 2}px; top:${
						top + 2
					}px;">${ranks[fenRank]}</div>`;
				}
			}
		}
		return coords;
	}

	async renderPieces(fen, size, flip, pieceImages) {
		const squareSize = size / 8;
		const fenBoard = fen.split(' ')[0].split('/');
		let pieces = '';

		for (let fenRank = 0; fenRank < 8; fenRank++) {
			let fenFile = 0;
			const rankStr = fenBoard[fenRank];

			for (const char of rankStr) {
				if (/[1-8]/.test(char)) {
					fenFile += parseInt(char, 10);
					continue;
				}

				const isWhite = char === char.toUpperCase();
				const pieceType = char.toLowerCase();
				const color = isWhite ? 'w' : 'b';
				const pieceKey = `${color}${pieceType.toUpperCase()}`;

				const boardRank = flip ? 7 - fenRank : fenRank;
				const boardFile = flip ? 7 - fenFile : fenFile;

				const left = boardFile * squareSize + squareSize * 0.05;
				const top = boardRank * squareSize + squareSize * 0.05;

				const pieceImage = pieceImages[pieceKey];
				if (pieceImage) {
					pieces += `<div class="piece" style="
          position:absolute;
          left:${left}px;
          top:${top}px;
          background-image:url('${pieceImage}');
        "></div>`;
				}

				fenFile++;
			}
		}

		return pieces;
	}

	renderEval(evaluation, size, options) {
		let whitePercent = 0.5;
		let label = '0.00';

		if (typeof evaluation === 'number') {
			if (Math.abs(evaluation) >= 100) {
				const mateIn = Math.abs(evaluation) - 100;
				label = evaluation > 0 ? `M${mateIn}` : `M-${mateIn}`;
				whitePercent = evaluation > 0 ? 0.95 : 0.05;
			} else {
				const clamped = Math.max(-10, Math.min(10, evaluation));
				whitePercent = (clamped + 10) / 20;
				label = (evaluation >= 0 ? '+' : '') + evaluation.toFixed(1);
			}
		}

		const whiteHeight = size * whitePercent;
		const blackHeight = size - whiteHeight;

		return `<div class="eval-bar">
      ${blackHeight > 0 ? `<div class="eval-black" style="height: ${blackHeight}px;"></div>` : ''}
      ${whiteHeight > 0 ? `<div class="eval-white" style="height: ${whiteHeight}px;"></div>` : ''}
      <div class="eval-label">${label}</div>
    </div>`;
	}

	renderArrow(bestMove, size, flip, arrowColor, arrowStyle, shadowEnabled) {
		if (!bestMove || bestMove.length < 4) return '';

		const from = bestMove.slice(0, 2);
		const to = bestMove.slice(2, 4);

		const fromCoords = this.algebraicToPixels(from, size, flip);
		const toCoords = this.algebraicToPixels(to, size, flip);

		if (!fromCoords || !toCoords) return '';

		const strokeWidth = arrowStyle === 'thick' ? 8 : arrowStyle === 'thin' ? 4 : 6;

		return `
      <svg class="arrow" style="width: ${size}px; height: ${size}px; position: absolute; top: 0; left: 0;">
        <defs>
          <marker id="arrowhead" markerWidth="30" markerHeight="20" 
                  refX="13" refY="5" orient="auto" markerUnits="userSpaceOnUse">
            <polygon points="0 0, 15 5, 0 10" fill="${arrowColor}"/>
          </marker>
        </defs>
        <line x1="${fromCoords.x}" y1="${fromCoords.y}" 
              x2="${toCoords.x}" y2="${toCoords.y}" 
              class="arrow-line"/>
      </svg>`;
	}

	algebraicToPixels(square, size, flip) {
		if (!square || square.length !== 2) return null;

		const file = square.charCodeAt(0) - 97;
		const rank = parseInt(square[1], 10) - 1;

		if (file < 0 || file > 7 || rank < 0 || rank > 7) return null;

		const squareSize = size / 8;

		const boardRank = flip ? rank : 7 - rank;
		const boardFile = flip ? 7 - file : file;

		return {
			x: boardFile * squareSize + squareSize / 2,
			y: boardRank * squareSize + squareSize / 2,
		};
	}

	async loadPieceImages(pieceSet) {
		const pieces = ['wK', 'wQ', 'wR', 'wB', 'wN', 'wP', 'bK', 'bQ', 'bR', 'bB', 'bN', 'bP'];
		const images = {};

		for (const piece of pieces) {
			try {
				const piecePath = path.resolve('assets', pieceSet, `${piece}.svg`);
				const imageBuffer = await fs.readFile(piecePath);
				const base64 = imageBuffer.toString('base64');
				images[piece] = `data:image/svg+xml;base64,${base64}`;
			} catch (error) {
				console.warn(`Could not load piece: ${piece} from ${pieceSet}`);
				const unicodePieces = {
					wK: '♔',
					wQ: '♕',
					wR: '♖',
					wB: '♗',
					wN: '♘',
					wP: '♙',
					bK: '♚',
					bQ: '♛',
					bR: '♜',
					bB: '♝',
					bN: '♞',
					bP: '♟',
				};
				const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64">
          <text x="32" y="45" text-anchor="middle" font-size="48">${unicodePieces[piece]}</text>
        </svg>`;
				images[piece] = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
			}
		}

		return images;
	}
}

let boardRenderer = null;

export async function initBoardRenderer() {
	if (!boardRenderer) {
		boardRenderer = new ChessBoardRenderer();
		await boardRenderer.init();
	}
	return boardRenderer;
}

export async function drawBoard(fen, options = {}, userId = null) {
	const renderer = await initBoardRenderer();
	return await renderer.renderBoard(fen, options, userId);
}

export async function getUserConfig(userId) {
	const renderer = await initBoardRenderer();
	return renderer.getUserConfig(userId);
}

export async function setUserConfig(userId, config) {
	const renderer = await initBoardRenderer();
	renderer.setUserConfig(userId, config);
}

export { DEFAULT_CONFIG };
