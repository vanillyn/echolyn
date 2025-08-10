import { SlashCommandBuilder, AttachmentBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { Chess } from 'chess.js';
import { drawBoard } from '../utils/drawBoard.js';
import { fetchGamePgn, extractGameId } from '../utils/lichessApi.js';

export default {
  data: new SlashCommandBuilder()
    .setName('viewgame')
    .setDescription('View a Lichess game by URL or PGN')
    .addStringOption(option =>
      option.setName('url')
        .setDescription('Lichess game URL')
        .setRequired(false))
    .addStringOption(option =>
      option.setName('pgn')
        .setDescription('PGN string')
        .setRequired(false))
    .addAttachmentOption(option =>
      option.setName('file')
        .setDescription('Upload a PGN file')
        .setRequired(false)),

  async execute(interaction) {
    await interaction.deferReply();

    const url = interaction.options.getString('url');
    const pgnString = interaction.options.getString('pgn');
    const file = interaction.options.getAttachment('file');

    let pgn;

    if (url) {
      const gameId = extractGameId(url);
      if (!gameId) return interaction.editReply('Invalid Lichess game URL.');
      pgn = await fetchGamePgn(gameId);
      if (!pgn) return interaction.editReply('Failed to fetch PGN from Lichess.');
    } else if (pgnString) {
      pgn = pgnString;
    } else if (file) {
      if (!file.name.endsWith('.pgn')) return interaction.editReply('Please upload a valid PGN file.');
      try {
        const response = await fetch(file.url);
        pgn = await response.text();
      } catch {
        return interaction.editReply('Failed to fetch PGN from the uploaded file.');
      }
    } else {
      return interaction.editReply('Please provide a Lichess URL, PGN string, or upload a PGN file.');
    }

    const chess = new Chess();
    chess.loadPgn(pgn);

    const moves = chess.history({ verbose: true });
    const fens = ['start'];
    chess.reset();
    fens.push(chess.fen());

    for (const move of moves) {
      chess.move(move.san);
      fens.push(chess.fen());
    }

    let currentMove = 0;

    const createEmbed = async () => {
      const boardImage = await drawBoard(fens[currentMove]);
      const attachment = new AttachmentBuilder(boardImage, { name: 'board.png' });

      const embed = new EmbedBuilder()
        .setTitle('Game Viewer')
        .setDescription(`Move ${currentMove + 1} of ${fens.length - 1}`)
        .setImage('attachment://board.png')
        .setColor(0x00ff00);

      return { embed, attachment };
    };

    const { embed, attachment } = await createEmbed();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('start').setLabel('<<').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('prev').setLabel('<').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('next').setLabel('>').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('end').setLabel('>>').setStyle(ButtonStyle.Primary)
    );

    const message = await interaction.editReply({ embeds: [embed], files: [attachment], components: [row] });

    const collector = message.createMessageComponentCollector({ time: 5 * 60 * 1000 });

    collector.on('collect', async i => {
      if (i.user.id !== interaction.user.id) {
        return i.reply({ content: 'You are not authorized to control this game viewer.', ephemeral: true });
      }

      switch (i.customId) {
        case 'start': currentMove = 0; break;
        case 'prev': if (currentMove > 0) currentMove--; break;
        case 'next': if (currentMove < fens.length - 1) currentMove++; break;
        case 'end': currentMove = fens.length - 1; break;
      }

      const { embed, attachment } = await createEmbed();
      await i.update({ embeds: [embed], files: [attachment] });
    });

    collector.on('end', () => {
      message.edit({ components: [] }).catch(() => {});
    });
  }
};
