import {
	SlashCommandBuilder,
	AttachmentBuilder,
	EmbedBuilder,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
} from 'discord.js';
import { Chess } from 'chess.js';
import { drawBoard } from '../utils/drawBoard.js';
import { analyzePosition } from '../utils/stockfish.js';
import { log } from '../init.js';

let ChessWebAPI;
try {
	ChessWebAPI = (await import('chess-web-api')).default;
} catch (e) {
	ChessWebAPI = null;
}

async function fetchLichessPgn(gameId) {
	const url = `https://lichess.org/game/export/${encodeURIComponent(
		gameId
	)}.pgn?moves=true&clocks=true&evals=true`;
	try {
		const res = await fetch(url, { headers: { Accept: 'application/x-chess-pgn' } });
		if (!res.ok) return null;
		return await res.text();
	} catch {
		return null;
	}
}

function extractLichessId(url) {
	const m = url.match(/lichess\.org\/([a-z0-9\-]{6,})/i);
	return m ? m[1] : null;
}

function extractChessComId(url) {
	const m = url.match(/chess\.com\/game\/(?:live|daily)\/(\d+)/i);
	return m ? m[1] : null;
}

async function fetchChessComPgn(gameId) {
	if (ChessWebAPI) {
		try {
			const api = new ChessWebAPI();
			const res = await api.getGameById(gameId);
			if (res && res.body && res.body.pgn) return res.body.pgn;
			if (res && res.pgn) return res.pgn;
		} catch (e) {
      log.error('Error fetching chess.com PGN:', e);
      return null;
		}
	}

	try {
		const pageUrl = `https://www.chess.com/game/live/${gameId}`;
		const res = await fetch(pageUrl);
		if (!res.ok) return null;
		const html = await res.text();
		const pre = html.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);
		if (pre) {
			const candidate = pre[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
			if (candidate.toLowerCase().includes('[event')) return candidate;
		}
	} catch (e) {
    log.error('Error fetching chess.com PGN:', e);
    return null;
	}

	return null;
}

function splitHeadersAndMoves(pgn) {
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

function tokenizeMoves(movesText) {
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

function parseMovesWithComments(movesText) {
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

function parseCommentTagsAndClean(commentText) {
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

function extractHeaders(headersText) {
	const headers = {};
	const re = /^\s*\[([A-Za-z0-9_]+)\s+"([^"]*)"\]/gm;
	let m;
	while ((m = re.exec(headersText))) {
		headers[m[1]] = m[2];
	}
	return headers;
}

function buildFensAndMetaFromPgn(pgn) {
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

export default {
	data: new SlashCommandBuilder()
		.setName('viewgame')
		.setDescription('view lichess or chess.com games, or upload / paste a pgn')
		.addStringOption(o =>
			o.setName('url').setDescription('lichess or chess.com url').setRequired(false)
		)
		.addStringOption(o => o.setName('pgn').setDescription('raw pgn text').setRequired(false))
		.addAttachmentOption(o =>
			o.setName('file').setDescription('upload .pgn file').setRequired(false)
		),

	async execute(interaction) {
		await interaction.deferReply();

		let url = interaction.options.getString('url');
		let rawPgnText = interaction.options.getString('pgn');
		const attachment = interaction.options.getAttachment('file');

		let pgn = null;

		if (url) {
			if (url.includes('lichess.org')) {
				const id = extractLichessId(url);
				if (!id)
					return interaction.editReply({
						content: 'invalid lichess url',
						ephemeral: true,
					});
				pgn = await fetchLichessPgn(id);
				if (!pgn)
					return interaction.editReply({
						content: 'failed to fetch lichess pgn or game is private',
						ephemeral: true,
					});
			} else if (url.includes('chess.com')) {
				const id = extractChessComId(url);
				if (!id)
					return interaction.editReply({
						content: 'invalid chess.com url',
						ephemeral: true,
					});
				pgn = await fetchChessComPgn(id);
				if (!pgn)
					return interaction.editReply({
						content: 'failed to fetch chess.com pgn',
						ephemeral: true,
					});
			} else {
				return interaction.editReply({
					content: 'unsupported url, provide lichess or chess.com url',
					ephemeral: true,
				});
			}
		} else if (rawPgnText) {
			pgn = rawPgnText;
		} else if (attachment) {
			if (!attachment.name.toLowerCase().endsWith('.pgn'))
				return interaction.editReply({
					content: 'uploaded file must be a .pgn',
					ephemeral: true,
				});
			try {
				const r = await fetch(attachment.url);
				pgn = await r.text();
			} catch (e) {
				return interaction.editReply({
					content: 'failed to download uploaded file',
					ephemeral: true,
				});
			}
		} else {
			await interaction.editReply({ content: 'Send the PGN for your game!' });
			const collector = interaction.channel.createMessageCollector({
				filter: m => m.author.id === interaction.user.id,
				max: 1,
				time: 15000,
			});

			return new Promise(resolve => {
				collector.on('collect', async m => {
					rawPgnText = m.content;
					if (rawPgnText) {
						pgn = rawPgnText;
						await processPgn(interaction, pgn);
						resolve();
					} else {
						await interaction.editReply({
							content: 'No PGN received.',
							ephemeral: true,
						});
						resolve();
					}
				});

				collector.on('end', async collected => {
					if (collected.size === 0) {
						await interaction.editReply({
							content: 'Timed out waiting for PGN.',
							ephemeral: true,
						});
						resolve();
					}
				});
			});
		}

		if (pgn) {
			await processPgn(interaction, pgn);
		}
	},
};

async function processPgn(interaction, pgn) {
	const parsed = buildFensAndMetaFromPgn(pgn);
	if (!parsed || !parsed.fens || parsed.fens.length === 0) {
		return interaction.editReply({
			content: 'could not parse pgn or no moves found',
			ephemeral: true,
		});
	}

	const { headers, fens, meta, moves } = parsed;

	const title = headers.Event || 'game';
	const white = headers.White || headers.WhitePlayer || 'white';
	const black = headers.Black || headers.BlackPlayer || 'black';
	const result = headers.Result || 'unknown';
	const site = headers.Site || '';
	const date = headers.Date || '';

	let orientationFlipped = false;
	const stockfishEvals = new Map();

	async function buildEmbedAtIndex(idx) {
		const fen = fens[idx];
		const m = meta[idx] || {};
		
		const stockfishData = stockfishEvals.get(idx);
		const evalToUse = stockfishData?.eval ?? m.eval;
		const bestMove = stockfishData?.bestMove;

		const drawOptions = {
			flip: orientationFlipped,
			checkSquare: m.checkSquare || null,
			inCheck: Boolean(m.inCheck),
			isCheckmate: Boolean(m.isCheckmate),
			eval: evalToUse,
			bestMove: bestMove,
			clocks: m.clocks,
			players: { white, black },
			watermark: 'echolyn',
		};

		const buffer = await drawBoard(fen, drawOptions);
		const attachment = new AttachmentBuilder(buffer, { name: 'board.png' });

		const embed = new EmbedBuilder()
			.setTitle(title)
			.setColor(0x00aaff)
			.setImage('attachment://board.png');

		let description = `${white} vs ${black}\nresult: ${result}\nmove: ${idx} / ${
			fens.length - 1
		}`;
		if (idx > 0) {
			const lastMove = moves[idx - 1];
			const moveNum = Math.ceil(idx / 2);
			const side = idx % 2 === 1 ? '.' : '...';
			const moveText = `${moveNum}${side} ${lastMove.san}${lastMove.glyph || ''}`;
			description += `\nlast move: ${moveText}`;
		}

		if (stockfishData) {
			let evalText = '';
			if (stockfishData.mateIn !== null) {
				evalText = `mate in ${stockfishData.mateIn}`;
			} else if (stockfishData.eval !== null) {
				evalText = `${stockfishData.eval >= 0 ? '+' : ''}${stockfishData.eval.toFixed(2)}`;
			}
			description += `\nstockfish: ${stockfishData.bestMove} (${evalText})`;
		}

		embed.setDescription(description);

		embed.addFields(
			{ name: 'event', value: headers.Event || '—', inline: true },
			{ name: 'site', value: site || '—', inline: true },
			{ name: 'date', value: date || '—', inline: true }
		);

		if (headers.WhiteElo || headers.BlackElo) {
			embed.addFields(
				{ name: 'white elo', value: headers.WhiteElo || '—', inline: true },
				{ name: 'black elo', value: headers.BlackElo || '—', inline: true }
			);
		}

		if (m.comment) {
			let commentValue = m.comment;
			if (commentValue.length > 1024) commentValue = commentValue.slice(0, 1021) + '...';
			embed.addFields({ name: 'comment', value: commentValue, inline: false });
		}

		return { embed, attachment };
	}

	const row = new ActionRowBuilder().addComponents(
		new ButtonBuilder().setCustomId('start').setLabel('<<').setStyle(ButtonStyle.Primary),
		new ButtonBuilder().setCustomId('prev').setLabel('<').setStyle(ButtonStyle.Secondary),
		new ButtonBuilder().setCustomId('next').setLabel('>').setStyle(ButtonStyle.Secondary),
		new ButtonBuilder().setCustomId('end').setLabel('>>').setStyle(ButtonStyle.Primary)
	);

	const row2 = new ActionRowBuilder().addComponents(
		new ButtonBuilder()
			.setCustomId('flip')
			.setLabel('Flip Board')
			.setStyle(ButtonStyle.Secondary),
		new ButtonBuilder()
			.setCustomId('evaluate')
			.setLabel('Evaluate Position')
			.setStyle(ButtonStyle.Success),
		new ButtonBuilder()
			.setCustomId('movelist')
			.setLabel('Move List')
			.setStyle(ButtonStyle.Secondary),
		new ButtonBuilder().setCustomId('pgn').setLabel('PGN').setStyle(ButtonStyle.Secondary)
	);

	let idx = 0;
	const initial = await buildEmbedAtIndex(idx);
	const msg = await interaction.editReply({
		content: null,
		embeds: [initial.embed],
		files: [initial.attachment],
		components: [row, row2],
	});

	const collector = msg.createMessageComponentCollector({ time: 10 * 60 * 1000 });

	collector.on('collect', async i => {
		try {
			if (i.user.id !== interaction.user.id) {
				return i.reply({
					content: 'only the command user can control this viewer',
					ephemeral: true,
				});
			}

			if (i.customId === 'start') idx = 0;
			else if (i.customId === 'prev') idx = Math.max(0, idx - 1);
			else if (i.customId === 'next') idx = Math.min(fens.length - 1, idx + 1);
			else if (i.customId === 'end') idx = fens.length - 1;
			else if (i.customId === 'flip') {
				orientationFlipped = !orientationFlipped;
			} else if (i.customId === 'evaluate') {
				if (stockfishEvals.has(idx)) {
					const next = await buildEmbedAtIndex(idx);
					return i.update({ embeds: [next.embed], files: [next.attachment] });
				}

				await i.deferUpdate();
				
				try {
					const result = await analyzePosition(fens[idx], { searchTime: 3000 });
					stockfishEvals.set(idx, result);
					const next = await buildEmbedAtIndex(idx);
					await i.editReply({ embeds: [next.embed], files: [next.attachment] });
				} catch (error) {
					log.error(`Stockfish evaluation error: ${error}`, error);
					await i.followUp({ content: 'Failed to evaluate position', ephemeral: true });
				}
				return;
			} else if (i.customId === 'movelist') {
				let listText = '';
				let moveNum = 1;
				for (let mvIdx = 0; mvIdx < moves.length; mvIdx += 2) {
					const whiteMove = moves[mvIdx];
					listText += `${moveNum}. ${
						whiteMove
							? `${whiteMove.san}${whiteMove.glyph || ''}${
									whiteMove.clean ? ` {${whiteMove.clean}}` : ''
							  }`
							: ''
					}`;
					const blackMove = moves[mvIdx + 1];
					if (blackMove) {
						listText += ` ${blackMove.san}${blackMove.glyph || ''}${
							blackMove.clean ? ` {${blackMove.clean}}` : ''
						}`;
					}
					listText += '\n';
					moveNum++;
				}
				if (listText.length > 1900) listText = listText.slice(0, 1900) + '\n...truncated';
				await i.reply({
					content: '```\n' + (listText || 'no moves') + '```',
					ephemeral: true,
				});
				return;
			} else if (i.customId === 'pgn') {
				await i.reply({
					content:
						'```' +
						pgn.slice(0, 1900) +
						(pgn.length > 1900 ? '\n...truncated' : '') +
						'```',
					ephemeral: true,
				});
				return;
			}

			const next = await buildEmbedAtIndex(idx);
			await i.update({ embeds: [next.embed], files: [next.attachment] });
		} catch (err) {
			console.error('viewer collect err', err);
			try {
				await i.reply({ content: 'error handling interaction', ephemeral: true });
			} catch {}
		}
	});

	collector.on('end', async () => {
		try {
			await msg.edit({ components: [] });
		} catch {}
	});
}