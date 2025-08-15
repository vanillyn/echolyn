import { Chess } from 'chess.js';
import { log } from '../init.js';

let ChessWebAPI;
try {
	ChessWebAPI = (await import('chess-web-api')).default;
} catch (e) {
	ChessWebAPI = null;
}


export function splitHeadersAndMoves(pgn) {
	const lines = pgn.split(/\r?\n/);
	const headerLines = [];
	let i = 0;
	while (i < lines.length && lines[i].trim().startsWith('[')) {
		headerLines.push(lines[i]);
		i++;
	}
	const movesPart = lines.slice(i).join(' ').trim();
	return { headersText: headerLines.join('\n'), movesText: movesPart };
}

export function tokenizeMoves(movesText) {
	const tokens = [];
	let i = 0;
	while (i < movesText.length) {
		const ch = movesText[i];
		if (/\s/.test(ch)) {
			i++;
			continue;
		}
		if (ch === '{') {
			const end = movesText.indexOf('}', i + 1);
			const comment = end === -1 ? movesText.slice(i + 1) : movesText.slice(i + 1, end);
			tokens.push({ type: 'comment', text: comment.trim() });
			i = end === -1 ? movesText.length : end + 1;
			continue;
		}
		if (ch === '(') {
			let depth = 1;
			i++;
			while (i < movesText.length && depth > 0) {
				const vch = movesText[i];
				if (vch === '(') depth++;
				else if (vch === ')') depth--;
				i++;
			}
			continue;
		}
		let j = i;
		while (j < movesText.length && !/\s|\{|\(/.test(movesText[j])) j++;
		const word = movesText.slice(i, j);
		tokens.push({ type: 'word', text: word.trim() });
		i = j;
	}
	return tokens;
}

export function parseMovesWithComments(movesText) {
	const tokens = tokenizeMoves(movesText);
	const moves = [];
	let side = 'w';
	for (let t of tokens) {
		if (t.type === 'word') {
			if (/^\d+\.+$/.test(t.text)) continue;
			if (/^(1-0|0-1|1\/2-1\/2|\*)$/.test(t.text)) break;
			let san = t.text;
			let glyph = null;
			const glyphMatch = san.match(/([!?]+)$/);
			if (glyphMatch) {
				glyph = glyphMatch[1];
				san = san.slice(0, -glyph.length);
			}
			moves.push({ san, glyph, side, comment: null });
			side = side === 'w' ? 'b' : 'w';
		} else if (t.type === 'comment') {
			if (moves.length > 0) {
				const last = moves[moves.length - 1];
				last.comment = (last.comment ? last.comment + ' ' : '') + t.text;
			}
		}
	}
	return moves;
}

export function parseCommentTagsAndClean(commentText) {
	if (!commentText) return { tags: {}, clean: null };
	let clean = commentText;

	clean = clean.replace(/\[%\s*eval\s*[^\]\s]+\]/gi, '');
	clean = clean.replace(/%eval\s*[-\d.]+/gi, '');
	clean = clean.replace(/\[%\s*clk\s*[^\]]+\]/gi, '');
	clean = clean.replace(/%clk\s*[0-9:]+/gi, '');
	clean = clean.trim() || null;

	const tags = {};
	const evalMatch =
		commentText.match(/\[%\s*eval\s*([^\]\s]+)\]/i) || commentText.match(/%eval\s*([-\d.]+)/i);
	if (evalMatch) {
		const v = parseFloat(evalMatch[1]);
		if (!Number.isNaN(v)) tags.eval = v;
	}
	const clkMatch =
		commentText.match(/\[%\s*clk\s*([^\]]+)\]/i) || commentText.match(/%clk\s*([0-9:]+)/i);
	if (clkMatch) tags.clk = clkMatch[1].trim();

	return { tags, clean };
}

export function extractHeaders(headersText) {
	const headers = {};
	const re = /^\s*\[([A-Za-z0-9_]+)\s+"([^"]*)"\]/gm;
	let m;
	while ((m = re.exec(headersText))) {
		headers[m[1]] = m[2];
	}
	return headers;
}

export function buildFensAndMetaFromPgn(pgn) {
	const { headersText, movesText } = splitHeadersAndMoves(pgn);
	const headers = extractHeaders(headersText);
	const movesWithComments = parseMovesWithComments(movesText);

	const chess = new Chess();
	const fens = [];
	const meta = [];

	fens.push(chess.fen());
	meta.push({
		inCheck: chess.inCheck(),
		isCheckmate: chess.isCheckmate(),
		checkSquare: null,
		eval: undefined,
		clocks: { white: null, black: null },
		comment: null,
		glyph: null,
	});

	let lastClocks = { white: null, black: null };

	for (const moveObj of movesWithComments) {
		const moveResult = chess.move(moveObj.san, { sloppy: true });
		if (!moveResult) {
			break;
		}

		const { tags, clean } = parseCommentTagsAndClean(moveObj.comment);
		moveObj.clean = clean;

		if (tags.clk) {
			if (moveObj.side === 'w') lastClocks.white = tags.clk;
			else lastClocks.black = tags.clk;
		}

		const evalVal = typeof tags.eval === 'number' ? tags.eval : undefined;

		let checkSquare = null;
		if (chess.inCheck()) {
			const b = chess.board();
			const turn = chess.turn(); 
			outer: for (let r = 0; r < 8; r++) {
				for (let f = 0; f < 8; f++) {
					const sq = b[r][f];
					if (sq && sq.type === 'k' && sq.color === turn) {
						checkSquare = { rank: r, file: f };
						break outer;
					}
				}
			}
		}

		fens.push(chess.fen());
		meta.push({
			inCheck: chess.inCheck(),
			isCheckmate: chess.isCheckmate(),
			checkSquare,
			eval: evalVal,
			clocks: { white: lastClocks.white, black: lastClocks.black },
			comment: clean,
			glyph: moveObj.glyph,
		});
	}

	return { headers, fens, meta, moves: movesWithComments };
}