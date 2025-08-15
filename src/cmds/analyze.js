import {
	SlashCommandBuilder,
	EmbedBuilder,
	ButtonBuilder,
	ButtonStyle,
	ActionRowBuilder,
	AttachmentBuilder,
	MessageFlags,
} from 'discord.js';
import { analysis } from '../utils/stockfish/analyze.js';
import { extractLichessId, fetchLichessPgn } from '../utils/api/lichessApi.js';
import { extractChessComId, fetchChessComPgn } from '../utils/api/chesscomApi.js';
import { gifRenderer } from '../utils/drawGIF.js';
import { buildFensAndMetaFromPgn } from '../utils/parsePGN.js';
import { drawBoard } from '../utils/drawBoard.js';
import { log } from '../init.js';

export default {
	data: new SlashCommandBuilder()
		.setName('analyze')
		.setDescription('Analyze chess games and positions')
		.addSubcommand(subcommand =>
			subcommand
				.setName('game')
				.setDescription('Analyze a complete chess game')
				.addStringOption(o =>
					o.setName('url').setDescription('lichess or chess.com url').setRequired(false)
				)
				.addStringOption(o => 
					o.setName('pgn').setDescription('raw pgn text').setRequired(false)
				)
				.addAttachmentOption(o =>
					o.setName('file').setDescription('upload .pgn file').setRequired(false)
				)
				.addBooleanOption(option =>
					option
						.setName('gif')
						.setDescription('Generate animated GIF of the game')
						.setRequired(false)
				)
		)
		.addSubcommand(subcommand =>
			subcommand
				.setName('position')
				.setDescription('Analyze a specific chess position')
				.addStringOption(option =>
					option
						.setName('fen')
						.setDescription('FEN string of the position to analyze')
						.setRequired(true)
				)
		),

	async execute(interaction) {
		await interaction.deferReply();

		const subcommand = interaction.options.getSubcommand();

		if (subcommand === 'game') {
			await handleGameAnalysis(interaction);
		} else if (subcommand === 'position') {
			await handlePositionAnalysis(interaction);
		}
	},
};

async function handleGameAnalysis(interaction) {
	let url = interaction.options.getString('url');
	let rawPgnText = interaction.options.getString('pgn');
	const attachment = interaction.options.getAttachment('file');
	const createGif = interaction.options.getBoolean('gif') || false;

	let pgn = null;

	if (url) {
		if (url.includes('lichess.org')) {
			const id = await extractLichessId(url);
			if (!id) {
				return interaction.editReply({
					content: 'invalid lichess url',
					flags: MessageFlags.Ephemeral,
				});
			}
			pgn = await fetchLichessPgn(id, false, false, true);
			if (!pgn) {
				return interaction.editReply({
					content: 'failed to fetch lichess pgn or game is private',
					flags: MessageFlags.Ephemeral,
				});
			}
		} else if (url.includes('chess.com')) {
			const id = extractChessComId(url);
			if (!id) {
				return interaction.editReply({
					content: 'invalid chess.com url',
					flags: MessageFlags.Ephemeral,
				});
			}
			pgn = await fetchChessComPgn(id);
			if (!pgn) {
				return interaction.editReply({
					content: 'failed to fetch chess.com pgn',
					flags: MessageFlags.Ephemeral,
				});
			}
		} else {
			return interaction.editReply({
				content: 'unsupported url, provide lichess or chess.com url',
				flags: MessageFlags.Ephemeral,
			});
		}
	} else if (rawPgnText) {
		pgn = rawPgnText;
	} else if (attachment) {
		if (!attachment.name.toLowerCase().endsWith('.pgn')) {
			return interaction.editReply({
				content: 'uploaded file must be a .pgn',
				flags: MessageFlags.Ephemeral,
			});
		}
		try {
			const r = await fetch(attachment.url);
			pgn = await r.text();
		} catch (e) {
			return interaction.editReply({
				content: 'failed to download uploaded file',
				flags: MessageFlags.Ephemeral,
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
					await processGameAnalysis(interaction, pgn, createGif);
					resolve();
				} else {
					await interaction.editReply({
						content: 'No PGN received.',
						flags: MessageFlags.Ephemeral,
					});
					resolve();
				}
			});

			collector.on('end', async collected => {
				if (collected.size === 0) {
					await interaction.editReply({
						content: 'Timed out waiting for PGN.',
						flags: MessageFlags.Ephemeral,
					});
					resolve();
				}
			});
		});
	}

	if (pgn) {
		await processGameAnalysis(interaction, pgn, createGif);
	}
}

async function processGameAnalysis(interaction, pgn, createGif) {
	const parsed = buildFensAndMetaFromPgn(pgn);
	if (!parsed || !parsed.fens || parsed.fens.length === 0) {
		return interaction.editReply({
			content: 'could not parse pgn or no moves found',
			flags: MessageFlags.Ephemeral,
		});
	}

	const { headers } = parsed;
	const white = headers.White || headers.WhitePlayer || 'white';
	const black = headers.Black || headers.BlackPlayer || 'black';

	await interaction.editReply({ content: 'Analyzing game... This may take a while.' });

	try {
		const analysisResult = await analysis.analyzeGame(pgn);

		const embed = new EmbedBuilder()
			.setTitle('Game Analysis Complete')
			.setDescription(`Analysis of ${white} vs ${black}`)
			.addFields(
				{
					name: 'Accuracy',
					value: `White: ${analysisResult.accuracy.white}%\nBlack: ${analysisResult.accuracy.black}%`,
					inline: true,
				},
				{
					name: 'White Summary',
					value: `${analysisResult.summary.brilliant.white}× Brilliant\n${analysisResult.summary.excellent.white}× Excellent\n${analysisResult.summary.good.white}× Good\n${analysisResult.summary.inaccuracies.white}× Inaccuracies\n${analysisResult.summary.mistakes.white}× Mistakes\n${analysisResult.summary.blunders.white}× Blunders`,
					inline: true,
				},
				{
					name: 'Black Summary',
					value: `${analysisResult.summary.brilliant.black}× Brilliant\n${analysisResult.summary.excellent.black}× Excellent\n${analysisResult.summary.good.black}× Good\n${analysisResult.summary.inaccuracies.black}× Inaccuracies\n${analysisResult.summary.mistakes.black}× Mistakes\n${analysisResult.summary.blunders.black}× Blunders`,
					inline: true,
				}
			)
			.setColor('#4a90e2');

		const keyMoves = analysisResult.moves.filter(move =>
			['??', '★', '!!'].includes(move.annotation.symbol)
		).slice(0, 3);

		if (keyMoves.length > 0) {
			const keyMovesText = keyMoves
				.map(move => `**${move.move}${move.annotation.symbol}** - ${move.comment}`)
				.join('\n');

			embed.addFields({
				name: 'Key Moments',
				value: keyMovesText,
				inline: false,
			});
		}

		const detailsButton = new ButtonBuilder()
			.setCustomId('analysis_details')
			.setLabel('View Detailed Analysis')
			.setStyle(ButtonStyle.Primary);

		const viewGameButton = new ButtonBuilder()
			.setCustomId('analysis_viewgame')
			.setLabel('View Game with Analysis')
			.setStyle(ButtonStyle.Secondary);

		const components = [
			new ActionRowBuilder().addComponents(detailsButton, viewGameButton),
		];

		const response = { embeds: [embed], components };

		if (createGif) {
			try {
				const gifBuffer = await gifRenderer.createGameReviewGif(pgn, {
					delay: 1500,
					boardOptions: { size: 400 },
				});

				embed.setImage('attachment://game_analysis.gif');
				response.files = [{ attachment: gifBuffer, name: 'game_analysis.gif' }];
			} catch (error) {
				log.error('Error creating analysis GIF:', error);
			}
		}

		await interaction.editReply(response);

		interaction.client.analysisCache = interaction.client.analysisCache || new Map();
		interaction.client.analysisCache.set(interaction.user.id, {
			analysis: analysisResult,
			pgn: pgn,
			parsed: parsed,
		});
	} catch (error) {
		log.error('Analysis error:', error);
		await interaction.editReply('Error analyzing the game. Please check your PGN format.');
	}
}

async function handlePositionAnalysis(interaction) {
	const fen = interaction.options.getString('fen');

	try {
		const positionAnalysis = await analysis.getPositionAnalysis(fen);

		const embed = new EmbedBuilder()
			.setTitle('Position Analysis')
			.setDescription('Stockfish 17.1 NNUE')
			.addFields(
				{
					name: 'Evaluation',
					value: positionAnalysis.evaluation,
					inline: true,
				},
				{
					name: 'Best Move',
					value: positionAnalysis.bestMove || 'No move found',
					inline: true,
				},
				{
					name: 'Advantage',
					value:
						positionAnalysis.mateIn !== null
							? `Mate in ${Math.abs(positionAnalysis.mateIn)}`
							: `${positionAnalysis.eval > 0 ? '+' : ''}${positionAnalysis.eval.toFixed(2)}`,
					inline: true,
				}
			)
			.setColor('#4a90e2');

		await interaction.editReply({ embeds: [embed] });
	} catch (error) {
		log.error('Position analysis error:', error);
		await interaction.editReply('Error analyzing position. Please check your FEN format.');
	}
}

export async function handleAnalysisButtons(interaction) {
	const cache = interaction.client.analysisCache?.get(interaction.user.id);
	if (!cache) {
		return interaction.reply({
			content: 'Analysis data expired. Please run the analysis again.',
			flags: MessageFlags.Ephemeral,
		});
	}

	if (interaction.customId === 'analysis_details') {
		const moveText = cache.analysis.moves
			.slice(0, 20)
			.map((move, index) => {
				const moveNumber = Math.floor(index / 2) + 1;
				const color = move.color === 'w' ? '⚪' : '⚫';
				return `${color} **${moveNumber}.${move.color === 'b' ? '..' : ''} ${
					move.move
				}${move.annotation.symbol}** ${move.comment ? `- ${move.comment}` : ''}`;
			})
			.join('\n');

		const detailEmbed = new EmbedBuilder()
			.setTitle('Detailed Move Analysis')
			.setDescription(moveText)
			.setColor('#4a90e2')
			.setFooter({
				text: `Showing first 20 moves of ${cache.analysis.moves.length} total moves`,
			});

		await interaction.reply({ embeds: [detailEmbed], flags: MessageFlags.Ephemeral });
	} else if (interaction.customId === 'analysis_viewgame') {
		await createGameViewer(interaction, cache);
	}
}

async function createGameViewer(interaction, cache) {
	const { analysis: analysisResult, pgn, parsed } = cache;
	const { headers, fens, meta, moves } = parsed;

	const title = headers.Event || 'analyzed game';
	const white = headers.White || headers.WhitePlayer || 'white';
	const black = headers.Black || headers.BlackPlayer || 'black';
	const result = headers.Result || 'unknown';

	let orientationFlipped = false;
	const analysisMap = new Map();

	analysisResult.moves.forEach((move, index) => {
		analysisMap.set(index + 1, {
			eval: move.evaluation / 100,
			bestMove: move.bestMove,
			annotation: move.annotation,
			comment: move.comment,
		});
	});

	async function buildEmbedAtIndex(idx) {
		const fen = fens[idx];
		const m = meta[idx] || {};
		const analysisData = analysisMap.get(idx);

		const drawOptions = {
			flip: orientationFlipped,
			checkSquare: m.checkSquare || null,
			inCheck: Boolean(m.inCheck),
			isCheckmate: Boolean(m.isCheckmate),
			eval: analysisData?.eval || m.eval,
			bestMove: analysisData?.bestMove,
			clocks: m.clocks,
			players: { white, black },
			watermark: 'echolyn analysis',
		};

		const buffer = await drawBoard(fen, drawOptions);
		const attachment = new AttachmentBuilder(buffer, { name: 'board.png' });

		const embed = new EmbedBuilder()
			.setTitle(`${title} (analyzed)`)
			.setColor(0x4a90e2)
			.setImage('attachment://board.png');

		let description = `${white} vs ${black}\nresult: ${result}\nmove: ${idx} / ${
			fens.length - 1
		}`;

		if (idx > 0 && analysisData) {
			const lastMove = moves[idx - 1];
			const moveNum = Math.ceil(idx / 2);
			const side = idx % 2 === 1 ? '.' : '...';
			const moveText = `${moveNum}${side} ${lastMove.san}${analysisData.annotation.symbol}`;
			description += `\nlast move: ${moveText}`;

			if (analysisData.comment) {
				description += `\nanalysis: ${analysisData.comment}`;
			}
		}

		if (analysisData?.bestMove) {
			let evalText = '';
			if (analysisData.eval !== null) {
				evalText = `${analysisData.eval >= 0 ? '+' : ''}${analysisData.eval.toFixed(2)}`;
			}
			description += `\nbest move: ${analysisData.bestMove} (${evalText})`;
		}

		embed.setDescription(description);

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
			.setStyle(ButtonStyle.Secondary)
	);

	let idx = 0;
	const initial = await buildEmbedAtIndex(idx);
	const msg = await interaction.reply({
		embeds: [initial.embed],
		files: [initial.attachment],
		components: [row, row2],
		flags: MessageFlags.Ephemeral,
	});

	const collector = msg.createMessageComponentCollector({ time: 10 * 60 * 1000 });

	collector.on('collect', async i => {
		try {
			if (i.user.id !== interaction.user.id) {
				return i.reply({
					content: 'only the command user can control this viewer',
					flags: MessageFlags.Ephemeral,
				});
			}

			if (i.customId === 'start') idx = 0;
			else if (i.customId === 'prev') idx = Math.max(0, idx - 1);
			else if (i.customId === 'next') idx = Math.min(fens.length - 1, idx + 1);
			else if (i.customId === 'end') idx = fens.length - 1;
			else if (i.customId === 'flip') {
				orientationFlipped = !orientationFlipped;
			}

			const next = await buildEmbedAtIndex(idx);
			await i.update({ embeds: [next.embed], files: [next.attachment] });
		} catch (err) {
			log.error('analysis viewer error:', err);
		}
	});

	collector.on('end', async () => {
		try {
			await msg.edit({ components: [] });
		} catch {}
	});
}