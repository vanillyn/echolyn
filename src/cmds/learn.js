import { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, MessageFlags } from 'discord.js';
import { gifRenderer } from '../utils/drawGIF.js';
import { openingsDatabase, searchOpenings } from '../utils/game/openings.js';
import { log } from '../init.js';
import { getUserConfig } from '../utils/drawBoard.js';

export default {
  data: new SlashCommandBuilder()
    .setName('learn')
    .setDescription('learn about chess!')
    .addSubcommand(subcommand =>
      subcommand
        .setName('opening')
        .setDescription('show a guide for a chess opening')
        .addStringOption(option =>
          option
            .setName('opening')
            .setDescription('the opening to display')
            .setRequired(true)
            .addChoices(
              { name: 'Italian Game', value: 'italian-game' },
              { name: "Queen's Gambit", value: 'queens-gambit' },
              { name: 'Ruy López', value: 'ruy-lopez' },
              { name: 'Sicilian Defense', value: 'sicilian-defense' }
            )
        )
        .addIntegerOption(option =>
          option
            .setName('delay')
            .setDescription('set the delay between moves')
              .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('search')
        .setDescription('Search for chess openings')
        .addStringOption(option =>
          option
            .setName('query')
            .setDescription('Search term for openings')
            .setRequired(true)
        )
    ),

  async execute(interaction) {
    await interaction.deferReply();

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'opening') {
      const openingKey = interaction.options.getString('opening');
      const opening = openingsDatabase[openingKey];

      if (!opening) {
        return interaction.editReply('Opening not found!');
      }

      try {
        const gifBuffer = await gifRenderer.createOpeningGif(opening.moves, undefined, {
          delay: interaction.options.getInteger('delay'),
          boardOptions: {
            size: 400,
            showCoordinates: true,
            ...await getUserConfig(interaction.user.id)
          }
        });

        const embed = new EmbedBuilder()
          .setTitle(`${opening.name} (${opening.eco})`)
          .setDescription(opening.description)
          .addFields(
            { name: 'Explanation', value: opening.explanation, inline: false },
            { name: 'Key Moves', value: opening.moves.join(' '), inline: true },
            { name: 'ECO Code', value: opening.eco, inline: true }
          )
          .setImage('attachment://opening.gif')
          .setColor('#f0d9b5');

        const historyButton = new ButtonBuilder()
          .setCustomId(`opening_history_${openingKey}`)
          .setLabel('History & Notable Players')
          .setStyle(ButtonStyle.Primary);

        const variationsButton = new ButtonBuilder()
          .setCustomId(`opening_variations_${openingKey}`)
          .setLabel('Variations')
          .setStyle(ButtonStyle.Secondary);

        const row = new ActionRowBuilder().addComponents(historyButton, variationsButton);

        await interaction.editReply({
          embeds: [embed],
          files: [{ attachment: gifBuffer, name: 'opening.gif' }],
          components: [row]
        });
      } catch (error) {
        log.error('Error creating opening guide:', error);
        await interaction.editReply('Error creating opening guide. Please try again.');
      }
    }

    if (subcommand === 'search') {
      const query = interaction.options.getString('query');
      const results = searchOpenings(query);

      if (results.length === 0) {
        return interaction.editReply('No openings found matching your search.');
      }

      const embed = new EmbedBuilder()
        .setTitle(`Opening Search: "${query}"`)
        .setColor('#b58863');

      const fields = results.slice(0, 5).map(opening => ({
        name: `${opening.name} (${opening.eco})`,
        value: `${opening.description}\n**Moves:** ${opening.moves.join(' ')}`,
        inline: false
      }));

      embed.addFields(fields);

      if (results.length > 5) {
        embed.setFooter({ text: `Showing 5 of ${results.length} results` });
      }

      await interaction.editReply({ embeds: [embed] });
    }
  }
};

export async function handleOpeningButtons(interaction) {
  const [action, type, openingKey] = interaction.customId.split('_');
  
  if (action !== 'opening') return;

  const opening = openingsDatabase[openingKey];
  if (!opening) return;

  if (type === 'history') {
    const historyEmbed = new EmbedBuilder()
      .setTitle(`${opening.name} - History`)
      .setDescription(`**Origin:** ${opening.history.origin}`)
      .addFields(
        { name: 'First Recorded', value: opening.history.first_recorded, inline: true },
        { name: 'Notable Players', value: opening.history.notable_players.join(', '), inline: false }
      )
      .setColor('#8b7355');

    await interaction.reply({ embeds: [historyEmbed], flags: MessageFlags.Ephemeral });
  }

  if (type === 'variations') {
    const variationsEmbed = new EmbedBuilder()
      .setTitle(`${opening.name} - Variations`)
      .setColor('#8b7355');

    const variationFields = opening.variations.map(variation => ({
      name: variation.name,
      value: `${variation.description}\n**Moves:** ${variation.moves.join(' ')}`,
      inline: false
    }));

    variationsEmbed.addFields(variationFields);

    await interaction.reply({ embeds: [variationsEmbed], flags: MessageFlags.Ephemeral });
  }
}