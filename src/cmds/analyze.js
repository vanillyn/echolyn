import {
	SlashCommandBuilder,
	EmbedBuilder,
	ButtonBuilder,
	ButtonStyle,
	ActionRowBuilder,
	AttachmentBuilder,
	MessageFlags,
	TextDisplayBuilder,
	ContainerBuilder,
	SectionBuilder,
	MediaGalleryBuilder,
	MediaGalleryItemBuilder,
	SeparatorBuilder,
} from 'discord.js';
import { analysis } from '../utils/stockfish/analyze.js';
import { extractLichessId, fetchLichessPgn } from '../utils/api/lichessApi.js';
import { extractChessComId, fetchChessComPgn } from '../utils/api/chesscomApi.js';
import { gifRenderer } from '../utils/drawGIF.js';
import { buildFensAndMetaFromPgn } from '../utils/parsePGN.js';
import { drawBoard } from '../utils/drawBoard.js';
import { log } from '../init.js';
import config from '../../config.js';

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

function getAnnotationColor(symbol) {
	const colors = {
		'??': '#ff4444',
		'?': '#ff8800',
		'?!': '#ffcc00',
		'!': 'transparent',
		'!!': '#0066cc',
		'★': '#00aaff',
		'': 'transparent',
	};
	return colors[symbol] || 'transparent';
}

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
					components: new TextDisplayBuilder().setContent('invalid lichess url'),
					flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2],
				});
			}
			pgn = await fetchLichessPgn(id, false, false, true);
			if (!pgn) {
				return interaction.editReply({
					components: new TextDisplayBuilder().setContent(
						'failed to fetch lichess pgn or game is private'
					),
					flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2],
				});
			}
		} else if (url.includes('chess.com')) {
			const id = extractChessComId(url);
			if (!id) {
				return interaction.editReply({
					components: new TextDisplayBuilder().setContent('invalid chess.com url'),
					flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2],
				});
			}
			pgn = await fetchChessComPgn(id);
			if (!pgn) {
				return interaction.editReply({
					components: new TextDisplayBuilder().setContent(
						'failed to fetch chess.com pgn'
					),
					flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2],
				});
			}
		} else {
			return interaction.editReply({
				components: new TextDisplayBuilder().setContent(
					'unsupported url, provide lichess or chess.com url'
				),
				flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2],
			});
		}
	} else if (rawPgnText) {
		pgn = rawPgnText;
	} else if (attachment) {
		if (!attachment.name.toLowerCase().endsWith('.pgn')) {
			return interaction.editReply({
				components: new TextDisplayBuilder().setContent('uploaded file must be a .pgn'),
				flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2],
			});
		}
		try {
			const r = await fetch(attachment.url);
			pgn = await r.text();
		} catch (e) {
			return interaction.editReply({
				components: new TextDisplayBuilder().setContent('failed to download uploaded file'),
				flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2],
			});
		}
	} else {
		await interaction.editReply({
			components: new TextDisplayBuilder().setContent('Send the PGN for your game!'),
		});
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
						components: new TextDisplayBuilder().setContent('No PGN received.'),
						flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2],
					});
					resolve();
				}
			});

			collector.on('end', async collected => {
				if (collected.size === 0) {
					await interaction.editReply({
						components: new TextDisplayBuilder().setContent(
							'Timed out waiting for PGN.'
						),
						flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2],
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
			components: [new TextDisplayBuilder().setContent(
				'could not parse pgn or no moves found'
			)],
			flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2],
		});
	}

	const { headers } = parsed;
	const white = headers.White || headers.WhitePlayer || config.default.white;
	const black = headers.Black || headers.BlackPlayer || config.default.black;
	const analyzing = new TextDisplayBuilder().setContent(
		'<a:sillyrook:1406752466573332551> Analyzing game. This may take a while.'
	);
	const gifrendering = new TextDisplayBuilder().setContent(
		'<a:sillyqueen:1406752464908189896> Rendering GIF. This will also take a while.'
	);
	await interaction.editReply({ components: [analyzing], flags: MessageFlags.IsComponentsV2 });
   
	try {
		const analysisResult = await analysis.analyzeGame(pgn);

		const detailsButton = new ButtonBuilder()
			.setCustomId('analysis_details')
			.setLabel('View Detailed Analysis')
			.setStyle(ButtonStyle.Primary);

		const viewGameButton = new ButtonBuilder()
			.setCustomId('analysis_viewgame')
			.setLabel('View Game with Analysis')
			.setStyle(ButtonStyle.Secondary);

		const container = new ContainerBuilder()
			.addTextDisplayComponents(textDisplay =>
				textDisplay.setContent(`# ${white} vs ${black}`)
			)
			.addSeparatorComponents(SeparatorBuilder => SeparatorBuilder.setDivider(true))
			.addTextDisplayComponents(
				textDisplay => textDisplay.setContent(`-# Info for ${white}`),
				textDisplay =>
					textDisplay.setContent(
						`## Accuracy: ${analysisResult.accuracy.white}\n${analysisResult.summary.brilliant.white} <:brilliant:1406759056894595112>\n${analysisResult.summary.excellent.white} <:great:1406759119221817364>\n${analysisResult.summary.good.white} <:good:1406759117703352370>\n${analysisResult.summary.inaccuracies.white} <:inaccuracy:1406759022031405118>\n${analysisResult.summary.mistakes.white} <:mistake:1406758987893969026>\n${analysisResult.summary.blunders.white} <:blunder:1406758934961717288>`
					)
			)
			.addTextDisplayComponents(
				textDisplay => textDisplay.setContent(`-# Info for ${black}`),
				textDisplay =>
					textDisplay.setContent(
						`## Accuracy: ${analysisResult.accuracy.black}\n${analysisResult.summary.brilliant.black} <:brilliant:1406759056894595112>\n${analysisResult.summary.excellent.black} <:great:1406759119221817364>\n${analysisResult.summary.good.black} <:good:1406759117703352370>\n${analysisResult.summary.inaccuracies.black} <:inaccuracy:1406759022031405118>\n${analysisResult.summary.mistakes.black} <:mistake:1406758987893969026>\n${analysisResult.summary.blunders.black} <:blunder:1406758934961717288>`
					)
			);

		const keyMoves = analysisResult.moves
			.filter(move => ['??', '!', '!!'].includes(move.annotation.symbol))
			.slice(0, 3);

		if (keyMoves.length > 0) {
			const keyMovesText = keyMoves
				.map(
					move =>
						`Key Moments\n**${move.move}${move.annotation.symbol}** - ${move.comment}`
				)
				.join('\n');

			const keyMoveField = new TextDisplayBuilder().setContent(keyMovesText);
			container.addTextDisplayComponents(keyMoveField);
		}

		const response = { components: [container], flags: MessageFlags.IsComponentsV2 };

		function addSubtext() {
			container
				.addActionRowComponents(ActionRowBuilder =>
					ActionRowBuilder.addComponents(detailsButton, viewGameButton)
				)
				.addTextDisplayComponents(textDisplay =>
					textDisplay.setContent('-# Analyzed by Stockfish 17.1 at Depth 12')
				);
		}

		if (createGif) {
			try {
				await interaction.editReply({
					components: [gifrendering],
					flags: MessageFlags.IsComponentsV2,
				});
				const gifBuffer = await gifRenderer.createAnalysisGif(pgn, analysisResult, {
					delay: 1500,
					size: 400,
					userId: interaction.user.id,
					showEval: true,
					highlightLastMove: true,
				});
				container.addMediaGalleryComponents(MediaGalleryBuilder =>
					MediaGalleryBuilder.addItems(MediaGalleryItemBuilder =>
						MediaGalleryItemBuilder.setDescription('GIF of an analyzed game.').setURL(
							'attachment://game_analysis.gif'
						)
					)
				);
				addSubtext();
				response.files = [{ attachment: gifBuffer, name: 'game_analysis.gif' }];
			} catch (error) {
				log.error('Error creating analysis GIF:', error?.stack || error?.message || error);
			}
		} else {
			addSubtext();
		}

		await interaction.editReply(response);

		interaction.client.analysisCache = interaction.client.analysisCache || new Map();
		interaction.client.analysisCache.set(interaction.user.id, {
			analysis: analysisResult,
			pgn: pgn,
			parsed: parsed,
		});
	} catch (error) {
		log.error(`Analysis error: ${error?.stack || error?.message || error}`);
		await interaction.editReply({
			components: [new TextDisplayBuilder().setContent(
				'Error analyzing the game. Please check your PGN format.'
			)],
			flags: MessageFlags.IsComponentsV2,
		});
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
							: `${
									positionAnalysis.eval > 0 ? '+' : ''
							  }${positionAnalysis.eval.toFixed(2)}`,
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
			components: new TextDisplayBuilder().setContent(
				'Analysis data expired. Please run the analysis again.'
			),
			flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2],
		});
	}

	if (interaction.customId === 'analysis_details') {
		const moveText = cache.analysis.moves
			.slice(0, 20)
			.map((move, index) => {
				const moveNumber = Math.floor(index / 2) + 1;
				const isWhite = move.color === 'white';
				const movePrefix = isWhite ? `${moveNumber}.` : `${moveNumber}...`;
				return `${isWhite ? '⚪' : '⚫'} **${movePrefix} ${move.move}${
					move.annotation.symbol
				}** ${move.comment ? `- ${move.comment}` : ''}`;
			})
			.join('\n');

		const detailEmbed = new EmbedBuilder()
			.setTitle('Detailed Move Analysis')
			.setDescription(moveText)
			.setColor('#4a90e2')
			.setFooter({
				text: `Showing first 20 moves of ${cache.analysis.moves.length} total moves`,
			});

		await interaction.reply({
			embeds: [detailEmbed],
			flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2],
		});
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
		analysisMap.set(move.index, {
			eval: move.evaluation,
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
			eval: idx === 0 ? 0.2 : analysisData?.eval || m.eval || 0,
			clocks: m.clocks,
			players: { white, black },
			watermark: 'echolyn analysis',
		};

		if (analysisData?.bestMove && analysisData.bestMove.length >= 4) {
			drawOptions.bestMove = analysisData.bestMove;
		}

		if (idx > 0) {
			const lastMove = moves[idx - 1];
			if (lastMove && lastMove.from && lastMove.to) {
				drawOptions.lastMove = {
					from: lastMove.from,
					to: lastMove.to,
				};
			}

			if (
				analysisData &&
				analysisData.annotation.symbol &&
				analysisData.annotation.symbol !== '!' &&
				analysisData.annotation.symbol !== ''
			) {
				if (lastMove && lastMove.to) {
					drawOptions.annotatedMove = {
						square: lastMove.to,
						color: getAnnotationColor(analysisData.annotation.symbol),
					};
					drawOptions.annotation = analysisData.annotation.symbol;
				}
			}
		}

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
		flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2],
	});

	const collector = msg.createMessageComponentCollector({ time: 10 * 60 * 1000 });

	collector.on('collect', async i => {
		try {
			if (i.user.id !== interaction.user.id) {
				return i.reply({
					components: new TextDisplayBuilder().setContent(
						'Only the command user can control this viewer.'
					),
					flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2],
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
