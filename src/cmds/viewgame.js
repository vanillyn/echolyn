import {
	SlashCommandBuilder,
	AttachmentBuilder,
	EmbedBuilder,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
} from 'discord.js';
import { drawBoard } from '../utils/drawBoard.js';
import { analyzePosition } from '../utils/stockfish.js';
import { log } from '../init.js';
import {
	buildFensAndMetaFromPgn,
	extractChessComId,
	fetchChessComPgn,
} from '../utils/parsePGN.js';

import { extractLichessId, fetchLichessPgn } from '../utils/lichessApi.js';

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
				const id = await extractLichessId(url);
				if (!id)
					return interaction.editReply({
						content: 'invalid lichess url',
						ephemeral: true,
					});
				pgn = await fetchLichessPgn(id, true, true, true);
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
