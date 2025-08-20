import {
	SlashCommandBuilder,
	EmbedBuilder,
	StringSelectMenuBuilder,
	StringSelectMenuOptionBuilder,
	ButtonBuilder,
	ButtonStyle,
	ActionRowBuilder,
	MessageFlags,
	ContainerBuilder,
	TextDisplayBuilder,
	SectionBuilder,
	AttachmentBuilder,
} from 'discord.js';
import { gifRenderer } from '../utils/drawGIF.js';
import { openingsDatabase, searchOpenings } from '../utils/game/openings.js';
import { chessGlossary } from '../utils/game/glossary.js';
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
							{ name: "King's Pawn Game", value: 'e4' },
							{ name: 'Sicilian Defense', value: 'e4-c5' },
							{ name: "Queen's Pawn Game", value: 'd4' },
							{ name: 'Indian Defense', value: 'd4-Nf6' },
							{ name: 'East Indian Defense', value: 'd4-Nf6-Nf3-g6' },
							{ name: 'English Opening', value: 'c4' },
							{ name: 'Zukertort Opening', value: 'Nf3' },
							{ name: 'Bird Opening', value: 'f4' },
							{ name: 'Hungarian Opening', value: 'g3' },
							{ name: 'Hungarian Opening: Indian Defense', value: 'g3-Nf6' },
							{ name: "Van't Kruijs Opening", value: 'e3' },
							{ name: 'Mieses Opening', value: 'd3' },
							{ name: 'Barnes Opening', value: 'f3' },
							{ name: "Barnes Opening: Fool's Mate", value: 'f3-e5-g4-qh4' },
							{ name: 'Kádas Opening', value: 'h4' },
							{ name: "Anderssen's Opening", value: 'a3' },
							{ name: 'Italian Game', value: 'e4-e5-Nf3-Nc6-Bc4' },
							{ name: 'Giuoco Piano', value: 'e4-e5-Nf3-Nc6-Bc4-Bc5' },
							{ name: 'Two Knights Defense', value: 'e4-e5-Nf3-Nc6-Bc4-Nf6' },
							{ name: 'Evans Gambit', value: 'e4-e5-Nf3-Nc6-Bc4-Bc5-b4' },
							{ name: "Scholar's Mate", value: 'e4-e5-Qh5-Nc6-Bc4-Nf6-Qxf7#' },
							{ name: 'Caro-Kann Defense', value: 'e4-c6' },
							{ name: 'Caro-Kann: Advance Variation', value: 'e4-c6-d4-d5-e5' },
							{ name: 'Caro-Kann: Classical Variation', value: 'e4-c6-d4-d5-Nc3-dxe4' },
							{ name: 'Caro-Kann: Panov-Botvinnik Attack', value: 'e4-c6-d4-d5-exd5-cxd5-c4' }
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
		)
		.addSubcommand(subcommand =>
			subcommand
				.setName('glossary')
				.setDescription('Look up chess terms and definitions')
				.addStringOption(option =>
					option
						.setName('term')
						.setDescription('The chess term to look up')
						.setRequired(true)
						.addChoices(
							...Object.entries(chessGlossary).map(([key, term]) => ({
								name: term.name,
								value: key,
							}))
						)
				)
		),

	async execute(interaction) {
		await interaction.deferReply();

		const subcommand = interaction.options.getSubcommand();

		if (subcommand === 'opening') {
			const openingKey = interaction.options.getString('opening');
			const opening = openingsDatabase[openingKey];
			log.debug(`/learn: opening: ${openingKey} returns ${opening}`);
			if (!opening) {
				return interaction.editReply('Opening not found!');
			}

			try {
				const gifBuffer = await gifRenderer.createOpeningGif(opening.moves, undefined, {
					delay: interaction.options.getInteger('delay') ?? 1000,
					boardOptions: {
						size: 400,
						showCoordinates: true,
						...(await getUserConfig(interaction.user.id)),
					},
				});

				const container = await buildOpeningContainer(openingKey, opening, gifBuffer);

				await interaction.editReply({
					files: [{ attachment: gifBuffer, name: 'opening.gif' }],
					components: [container],
					flags: MessageFlags.IsComponentsV2,
				});
			} catch (error) {
				log.error('Error creating opening guide:', error?.stack || error?.message || error);
				await interaction.editReply(
					`Error creating opening guide.\n\`\`\`ansi\n${error.message}\n\`\`\``
				);
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
				inline: false,
			}));

			embed.addFields(fields);

			if (results.length > 5) {
				embed.setFooter({ text: `Showing 5 of ${results.length} results` });
			}

			await interaction.editReply({ embeds: [embed] });
		}

		if (subcommand === 'glossary') {
			const termKey = interaction.options.getString('term');
			const term = chessGlossary[termKey];

			if (!term) {
				return interaction.editReply('Term not found!');
			}

			try {
				const imagePath = `assets/glossary/${term.image}`;
				const file = new AttachmentBuilder(imagePath, { name: term.image });

				const container = new ContainerBuilder().addSectionComponents(section =>
					section
						.addTextDisplayComponents(
							textDisplay => textDisplay.setContent(`# ${term.name}`),
							textDisplay => textDisplay.setContent(term.definition)
						)
						.setThumbnailAccessory(thumbnail =>
							thumbnail
								.setDescription(`Visual representation of ${term.name}`)
								.setURL(`attachment://${term.image}`)
						)
				);

				const selectMenu = new StringSelectMenuBuilder()
					.setCustomId('glossary_select')
					.setPlaceholder('Look up another term')
					.addOptions(
						Object.entries(chessGlossary).map(([key, t]) =>
							new StringSelectMenuOptionBuilder()
								.setLabel(t.name)
								.setDescription(t.definition.substring(0, 50) + '...')
								.setValue(key)
								.setDefault(key === termKey)
						)
					);

				const actionRow = new ActionRowBuilder().addComponents(selectMenu);
				container.addActionRowComponents(actionRow);

				await interaction.editReply({
					files: [file],
					components: [container],
					flags: MessageFlags.IsComponentsV2,
				});
			} catch (error) {
				log.error(
					'Error creating glossary entry:',
					error?.stack || error?.message || error
				);

				const container = new ContainerBuilder().addTextDisplayComponents(
					textDisplay => textDisplay.setContent(`# ${term.name}`),
					textDisplay => textDisplay.setContent(term.definition),
					textDisplay =>
						textDisplay.setContent(
							`*Image not available.* ${error?.stack || error?.message || error}`
						)
				);

				const selectMenu = new StringSelectMenuBuilder()
					.setCustomId('glossary_select')
					.setPlaceholder('Look up another term')
					.addOptions(
						Object.entries(chessGlossary).map(([key, t]) =>
							new StringSelectMenuOptionBuilder()
								.setLabel(t.name)
								.setDescription(t.definition.substring(0, 50) + '...')
								.setValue(key)
								.setDefault(key === termKey)
						)
					);

				const actionRow = new ActionRowBuilder().addComponents(selectMenu);
				container.addActionRowComponents(actionRow);

				await interaction.editReply({
					components: [container],
					flags: MessageFlags.IsComponentsV2,
				});
			}
		}
	},
};

async function buildOpeningContainer(openingKey, opening, gifBuffer) {
	const selectMenu = new StringSelectMenuBuilder()
		.setCustomId(`opening_variations_${openingKey}`)
		.setPlaceholder('Select a variation')
		.addOptions(
			opening.variations
				.map(key => {
					const variation = openingsDatabase[key];
					if (!variation) return null;
					return new StringSelectMenuOptionBuilder()
						.setLabel(variation.name.substring(0, 24))
						.setDescription(variation.moves.join(' '))
						.setValue(key);
				})
				.filter(Boolean)
		);

	const container = new ContainerBuilder()
		.addTextDisplayComponents(
			textDisplay => textDisplay.setContent(`# ${opening.name} (${opening.eco})`),
			textDisplay => textDisplay.setContent(`${opening.description}`)
		)
		.addSeparatorComponents(SeparatorBuilder => SeparatorBuilder.setDivider(true))
		.addMediaGalleryComponents(MediaGalleryBuilder =>
			MediaGalleryBuilder.addItems(MediaGalleryItemBuilder =>
				MediaGalleryItemBuilder.setDescription(
					`A gif showing the ${opening.name} in chess`
				).setURL('attachment://opening.gif')
			)
		)
		.addTextDisplayComponents(textDisplay =>
			textDisplay.setContent(`-# ${opening.moves.join(' ')}`)
		);

	if (opening.variations.length > 0) {
		const row = new ActionRowBuilder().addComponents(selectMenu);
		container.addActionRowComponents(row);
	}

	return container;
}

export async function handleOpeningButtons(interaction) {
	interaction.deferUpdate();

	const [action, type, openingKey] = interaction.customId.split('_');
	if (action !== 'opening') return;

	const opening = openingsDatabase[openingKey];
	if (!opening) return;

	if (type === 'variations') {
		const selectedVariationKey = interaction.values[0];
		const variation = openingsDatabase[selectedVariationKey];

		if (!variation) {
			return interaction.reply({
				content: 'Variation not found!',
				flags: MessageFlags.Ephemeral,
			});
		}

		try {
			const gifBuffer = await gifRenderer.createOpeningGif(variation.moves, undefined, {
				delay: 1000,
				boardOptions: {
					size: 400,
					showCoordinates: true,
					...(await getUserConfig(interaction.user.id)),
				},
			});

			const backButton = new ButtonBuilder()
				.setCustomId(`opening_back_${openingKey}`)
				.setLabel('Back to Main Opening')
				.setStyle(ButtonStyle.Secondary);

			const container = new ContainerBuilder()
				.addTextDisplayComponents(
					textDisplay => textDisplay.setContent(`# ${variation.name} (${variation.eco})`),
					textDisplay => textDisplay.setContent(`${variation.description}`)
				)
				.addSeparatorComponents(SeparatorBuilder => SeparatorBuilder.setDivider(true))
				.addMediaGalleryComponents(MediaGalleryBuilder =>
					MediaGalleryBuilder.addItems(MediaGalleryItemBuilder =>
						MediaGalleryItemBuilder.setDescription(
							`A gif showing the ${variation.name} in chess`
						).setURL('attachment://opening.gif')
					)
				)
				.addTextDisplayComponents(textDisplay =>
					textDisplay.setContent(`-# ${variation.moves.join(' ')}`)
				);

			if (opening.variations.length > 0) {
				const selectMenu = new StringSelectMenuBuilder()
					.setCustomId(`opening_variations_${openingKey}`)
					.setPlaceholder('Variations of this move')
					.addOptions(
						opening.variations
							.map(key => {
								const v = openingsDatabase[key];
								if (!v) return null;
								return new StringSelectMenuOptionBuilder()
									.setLabel(v.name)
									.setDescription(v.moves.join(' '))
									.setValue(key)
									.setDefault(key === selectedVariationKey);
							})
							.filter(Boolean)
					);

				const row = new ActionRowBuilder().addComponents(selectMenu);
				const backRow = new ActionRowBuilder().addComponents(backButton);
				container.addActionRowComponents(row, backRow);
			} else {
				const backRow = new ActionRowBuilder().addComponents(backButton);
				container.addActionRowComponents(backRow);
			}

			await interaction.editReply({
				files: [{ attachment: gifBuffer, name: 'opening.gif' }],
				components: [container],
				flags: MessageFlags.IsComponentsV2,
			});
		} catch (error) {
			log.error(
				'/learn: error creating variation guide:',
				error?.stack || error?.message || error
			);
			await interaction.editReply({
				components: [
					new TextDisplayBuilder().setContent(
						`/learn: error creating variation guide.\n\`\`\`ansi\n${error.message}\n\`\`\``
					),
				],
				flags: MessageFlags.IsComponentsV2,
			});
		}
	} else if (type === 'back') {
		try {
			const gifBuffer = await gifRenderer.createOpeningGif(opening.moves, undefined, {
				delay: 1000,
				boardOptions: {
					size: 400,
					showCoordinates: true,
					...(await getUserConfig(interaction.user.id)),
				},
			});

			const container = await buildOpeningContainer(openingKey, opening, gifBuffer);

			await interaction.editReply({
				files: [{ attachment: gifBuffer, name: 'opening.gif' }],
				components: [container],
				flags: MessageFlags.IsComponentsV2,
			});
		} catch (error) {
			log.error(
				'/learn: error returning to main opening:',
				error?.stack || error?.message || error
			);
			await interaction.reply({
				content: `/learn: error returning to main opening.\n\`\`\`ansi\n${error.message}\n\`\`\``,
				flags: MessageFlags.Ephemeral,
			});
		}
	}
}

export async function handleGlossarySelect(interaction) {
	await interaction.deferUpdate();

	const selectedTerm = interaction.values[0];
	const term = chessGlossary[selectedTerm];

	if (!term) {
		return interaction.followUp({
			content: 'Term not found!',
			flags: MessageFlags.Ephemeral,
		});
	}

	try {
		const imagePath = `assets/glossary/${term.image}`;
		const file = new AttachmentBuilder(imagePath, { name: term.image });

		const container = new ContainerBuilder().addSectionComponents(section =>
			section
				.addTextDisplayComponents(
					textDisplay => textDisplay.setContent(`# ${term.name}`),
					textDisplay => textDisplay.setContent(term.definition)
				)
				.setThumbnailAccessory(thumbnail =>
					thumbnail
						.setDescription(`Visual representation of ${term.name}`)
						.setURL(`attachment://${term.image}`)
				)
		);

		const selectMenu = new StringSelectMenuBuilder()
			.setCustomId('glossary_select')
			.setPlaceholder('Look up another term')
			.addOptions(
				Object.entries(chessGlossary).map(([key, t]) =>
					new StringSelectMenuOptionBuilder()
						.setLabel(t.name)
						.setDescription(t.definition.substring(0, 50) + '...')
						.setValue(key)
						.setDefault(key === selectedTerm)
				)
			);

		const actionRow = new ActionRowBuilder().addComponents(selectMenu);
		container.addActionRowComponents(actionRow);

		await interaction.editReply({
			files: [file],
			components: [container],
			flags: MessageFlags.IsComponentsV2,
		});
	} catch (error) {
		log.error(
			'/learn: error updating glossary entry:',
			error?.stack || error?.message || error
		);

		const container = new ContainerBuilder().addTextDisplayComponents(
			textDisplay => textDisplay.setContent(`# ${term.name}`),
			textDisplay => textDisplay.setContent(term.definition),
			textDisplay => textDisplay.setContent(`*Image not available: ${imagePath}*`)
		);

		const selectMenu = new StringSelectMenuBuilder()
			.setCustomId('glossary_select')
			.setPlaceholder('Look up another term')
			.addOptions(
				Object.entries(chessGlossary).map(([key, t]) =>
					new StringSelectMenuOptionBuilder()
						.setLabel(t.name)
						.setDescription(t.definition.substring(0, 50) + '...')
						.setValue(key)
						.setDefault(key === selectedTerm)
				)
			);

		const actionRow = new ActionRowBuilder().addComponents(selectMenu);
		container.addActionRowComponents(actionRow);

		await interaction.editReply({
			components: [container],
			flags: MessageFlags.IsComponentsV2,
		});
	}
}
