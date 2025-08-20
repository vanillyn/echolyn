import { handleGlossarySelect, handleOpeningButtons } from '../cmds/learn.js';
import { handleAnalysisButtons } from '../cmds/analyze.js';
import { handleStudyButtons } from '../cmds/profile/lichess/study.js';
import { log } from '../init.js';
import { MessageFlags, TextDisplayBuilder } from 'discord.js';

const LOG_NAME = 'interaction';

export default {
	name: 'interactionCreate',
	once: false,
	async execute(interaction, client) {
		try {
			if (interaction.isChatInputCommand()) {
				const command = client.commands.get(interaction.commandName);
				if (!command) {
					log.warn(`${LOG_NAME}: Invalid command: ${interaction.commandName}`);
					return;
				}

				await command.execute(interaction);
				return;
			}

			if (
				interaction.isButton() ||
				interaction.isStringSelectMenu() ||
				interaction.isModalSubmit()
			) {
				const customId = interaction.customId;

				// cmds/chess.js
				if (
					customId.startsWith('join_') ||
					customId === 'make_move' ||
					customId === 'realtime_move' ||
					customId === 'vote_move' ||
					customId.startsWith('blitz_') ||
					customId === 'flip_board' ||
					customId === 'show_votes' ||
					customId === 'resign' ||
					customId.startsWith('move_')
				) {
					return;
				}

				// cmdw/profile/boardConfig.js
				if (
					customId === 'config_category' ||
					customId === 'color_preset' ||
					customId === 'custom_colors' ||
					customId === 'back_to_main' ||
					customId === 'piece_set' ||
					customId === 'display_option' ||
					customId === 'style_option' ||
					customId === 'preview_config' ||
					customId === 'reset_config' ||
					customId === 'size_modal' ||
					customId === 'radius_modal' ||
					customId === 'custom_color_modal'
				) {
					return;
				}

				// cmds/viewGame.js
				if (
					customId === 'start' ||
					customId === 'prev' ||
					customId === 'next' ||
					customId === 'end' ||
					customId === 'flip' ||
					customId === 'evaluate' ||
					customId === 'movelist' ||
					customId === 'pgn'
				) {
					return;
				}

				// cmds/learn.js
				if (customId.startsWith('opening_')) {
					await handleOpeningButtons(interaction);
					return;
				}
				
				if (customId.startsWith('glossary_')) {
					await handleGlossarySelect(interaction);
					return;
				}
				// cmds/analyze.js
				if (customId.startsWith('analysis_')) {
					await handleAnalysisButtons(interaction);
					return;
				}

				// cmds/profile/lichess/study
				if (customId.startsWith('study_')) {
					await handleStudyButtons(interaction);
					return;
				}

				log.warn(`${LOG_NAME}: Unhandled interaction: ${customId}`);
			}
		} catch (error) {
			let idInfo;
			if (interaction.isChatInputCommand()) {
				idInfo = `command: ${interaction.commandName}`;
			} else if ('customId' in interaction) {
				idInfo = `customId: ${interaction.customId}`;
			} else {
				idInfo = `interaction of type ${interaction.type}`;
			}

			log.error(`${LOG_NAME}: error handling ${idInfo}\n${error?.stack || error?.message || error}`);

			const errorMessage = `There was an internal error processing the interaction: ${idInfo}.\n\`\`\`\n${error}\n\`\`\`\n[[report](<https://github.com/vanillyn/echolyn/issues>) - [support](<https://discord.gg/3PkaESCxxW>)]`;
			const errorText = new TextDisplayBuilder().setContent(errorMessage)
			try {
				if (interaction.replied || interaction.deferred) {
					await interaction.editReply({
						components: errorText,
						flags: MessageFlags.IsComponentsV2,
					});
				} else {
					await interaction.reply({
						components: errorText,
						flags: MessageFlags.IsComponentsV2,
					});
				}
			} catch (replyError) {
				log.error(`${LOG_NAME}: failed to send error message:`, replyError?.stack || replyError?.message || replyError);
			}
		}
	},
};
