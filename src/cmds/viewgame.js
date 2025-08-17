import {
	SlashCommandBuilder,
	AttachmentBuilder,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	MessageFlags,
	ContainerBuilder,
	SectionBuilder,
	SeparatorBuilder
} from 'discord.js';
import { drawBoard } from '../utils/drawBoard.js';
import { analyzePosition } from '../utils/stockfish/stockfish.js';
import { log } from '../init.js';
import { buildFensAndMetaFromPgn } from '../utils/parsePGN.js';
import { extractChessComId, fetchChessComPgn } from '../utils/api/chesscomApi.js';
import { extractLichessId, fetchLichessPgn } from '../utils/api/lichessApi.js';
import config from '../../config.js';

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
						flags: MessageFlags.Ephemeral,
					});
				pgn = await fetchLichessPgn(id, true, true, true);
				if (!pgn)
					return interaction.editReply({
						content: 'failed to fetch lichess pgn or game is private',
						flags: MessageFlags.Ephemeral,
					});
			} else if (url.includes('chess.com')) {
				const id = extractChessComId(url);
				if (!id)
					return interaction.editReply({
						content: 'invalid chess.com url',
						flags: MessageFlags.Ephemeral,
					});
				pgn = await fetchChessComPgn(id);
				if (!pgn)
					return interaction.editReply({
						content: 'failed to fetch chess.com pgn',
						flags: MessageFlags.Ephemeral,
					});
			} else {
				return interaction.editReply({
					content: 'unsupported url, provide lichess or chess.com url',
					flags: MessageFlags.Ephemeral,
				});
			}
		} else if (rawPgnText) {
			pgn = rawPgnText;
		} else if (attachment) {
			if (!attachment.name.toLowerCase().endsWith('.pgn'))
				return interaction.editReply({
					content: 'uploaded file must be a .pgn',
					flags: MessageFlags.Ephemeral,
				});
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
						await processPgn(interaction, pgn);
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
			await processPgn(interaction, pgn);
		}
	},
};
async function processPgn(interaction, pgn) {
    const parsed = buildFensAndMetaFromPgn(pgn);
    if (!parsed || !parsed.fens || parsed.fens.length === 0) {
        return interaction.editReply({
            content: 'could not parse pgn or no moves found',
            flags: MessageFlags.Ephemeral,
        });
    }

    const { headers, fens, meta, moves } = parsed;

    const white = headers.White || headers.WhitePlayer || config.default.white;
    const black = headers.Black || headers.BlackPlayer || config.default.black;

    let orientationFlipped = false;
    const stockfishEvals = new Map();

    async function infoAtIndex(idx) {
        const m = meta[idx] || {};
        const stockfishData = stockfishEvals.get(idx);
        const evalToUse = stockfishData?.eval ?? m.eval;
        const bestMove = stockfishData?.bestMove;
        let lastMoveText = '';
        let commentText = '';
        let bestMoveText = '';
        if (m.comment) {
            let commentValue = m.comment;
            if (commentValue.length > 1024) commentValue = commentValue.slice(0, 1021) + '...';
            commentText = `[${commentValue}]`;
        }
        if (idx > 0) {
            const lastMove = moves[idx - 1];
            const moveNum = Math.ceil(idx / 2);
            const side = idx % 2 === 1 ? '.' : '...';
            const moveText = `${moveNum}${side} ${lastMove.san}${lastMove.glyph || ''}`;
            lastMoveText = ` | ${moveText}`;
        }

        if (stockfishData) {
            let evalText = '';
            if (stockfishData.mateIn !== null) {
                evalText = `mate in ${stockfishData.mateIn}`;
            } else if (stockfishData.eval !== null) {
                evalText = `${stockfishData.eval >= 0 ? '+' : ''}${stockfishData.eval.toFixed(2)}`;
            }
            bestMoveText = `[${bestMove} (${evalText})]`;
        }
        return { commentText, lastMoveText, bestMoveText, bestMove, evalToUse };
    }

    async function drawBoardAtIndex(idx) {
        const fen = fens[idx];
        const m = meta[idx] || {};
        const info = await infoAtIndex(idx);
        const bestMove = info.bestMove;
        const evalToUse = info.evalToUse;

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

        return { attachment };
    }

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('start').setLabel('<<').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('prev').setLabel('<').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('next').setLabel('>').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('end').setLabel('>>').setStyle(ButtonStyle.Primary),
		new ButtonBuilder().setCustomId('evaluate').setLabel('⚙️').setStyle(ButtonStyle.Success)
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('flip')
            .setLabel('Flip Board')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('movelist')
            .setLabel('Move List')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('pgn').setLabel('PGN').setStyle(ButtonStyle.Secondary)
    );

    async function buildInfoSection(idx) {
        const info = await infoAtIndex(idx);
        const gameInfo = new SectionBuilder()
            .addTextDisplayComponents(
                textDisplay =>
                    textDisplay.setContent(
                        `## \`[${idx}/${fens.length - 1}${info.lastMoveText}]\` Viewing ${
                            headers.Event
                        } at ${headers.Site || 'the Board'}\n**${headers.Date || ' '}**`
                    ),
                textDisplay =>
                    textDisplay.setContent(
                        `### **${white}** (${headers.WhiteElo}) vs **${black}** (${headers.BlackElo})\n**Result**: ${headers.Result || 'unknown'}`
                    ),
                textDisplay =>
                    textDisplay.setContent(
                        `-# comments: \`${info.commentText} ${info.bestMoveText}\``
                    )
            )
			.setThumbnailAccessory(
				thumbnail => thumbnail
					.setDescription(`ran by ${interaction.user.name}`)
					.setURL(interaction.user.avatarURL())
			);
        return gameInfo;
    }

    async function buildGameContainer(idx) {
        const gameContainer = new ContainerBuilder()
            .addSectionComponents(await buildInfoSection(idx))
            .addSeparatorComponents(separator => new SeparatorBuilder())
			.addActionRowComponents(row)
            .addMediaGalleryComponents(mediaGallery =>
                mediaGallery.addItems(MediaGalleryItemBuilder =>
                    MediaGalleryItemBuilder
                        .setDescription(`Move ${idx} of the game`)
                        .setURL('attachment://board.png')
                )
            )
            .addActionRowComponents(row2);

        return gameContainer;
    }

    let idx = 0;
    const initial = await buildGameContainer(idx);
    const boardImage = (await drawBoardAtIndex(idx)).attachment;
    const msg = await interaction.reply({
        files: [boardImage],
        components: [initial],
        flags: MessageFlags.IsComponentsV2,
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
            } else if (i.customId === 'evaluate') {
                if (stockfishEvals.has(idx)) {
                    const nextAttachment = (await drawBoardAtIndex(idx)).attachment;
                    const nextContainer = await buildGameContainer(idx);
                    return i.update({ components: [nextContainer], files: [nextAttachment] });
                }

                await i.deferUpdate();

                try {
                    const result = await analyzePosition(fens[idx], { searchTime: 3000 });
                    stockfishEvals.set(idx, result);
                    const nextAttachment = (await drawBoardAtIndex(idx)).attachment;
                    const nextContainer = await buildGameContainer(idx);
                    await i.editReply({ components: [nextContainer], files: [nextAttachment] });
                } catch (error) {
                    log.error(`Stockfish evaluation error: ${error}`, error);
                    await i.followUp({
                        content: 'Failed to evaluate position',
                        flags: MessageFlags.Ephemeral,
                    });
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
                    flags: MessageFlags.Ephemeral,
                });
                return;
            } else if (i.customId === 'pgn') {
                await i.reply({
                    content:
                        '```' +
                        pgn.slice(0, 1900) +
                        (pgn.length > 1900 ? '\n...truncated' : '') +
                        '```',
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }

            const nextAttachment = (await drawBoardAtIndex(idx)).attachment;
            const nextContainer = await buildGameContainer(idx);
            await i.update({ components: [nextContainer], files: [nextAttachment] });
        } catch (err) {
            console.error('viewer collect err', err);
            try {
                await i.reply({
                    content: 'error handling interaction',
                    flags: MessageFlags.Ephemeral,
                });
            } catch {}
        }
    });

    collector.on('end', async () => {
        try {
            await msg.edit({ components: [] });
        } catch {}
    });
}
