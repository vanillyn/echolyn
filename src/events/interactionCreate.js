import { handleOpeningButtons } from '../cmds/learn.js';
import { handleAnalysisButtons } from '../cmds/analyze.js';
import { handleStudyButtons } from '../cmds/profile/lichess/study.js';
import { log } from '../init.js';
import { MessageFlags } from 'discord.js';

const LOG_NAME = 'interaction'
export default {
  name: 'interactionCreate',
  once: false,
  async execute(interaction, client) {
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) {
        log.warn(`${LOG_NAME}: Invalid command ran: ${interaction.commandName}`);
        return;
      }

      try {
        await command.execute(interaction);
      } catch (error) {
        log.error(`${LOG_NAME}: Command ${interaction.commandName} failed:`, error);
        
        const errorMessage = 'There was an error executing this command.';
        if (interaction.replied || interaction.deferred) {
          await interaction.editReply(errorMessage);
        } else {
          await interaction.reply({ content: errorMessage, flags: MessageFlags.Ephemeral });
        }
      }
    }

    if (interaction.isButton()) {
      try {
        if (interaction.customId.startsWith('opening_')) {
          await handleOpeningButtons(interaction);
        } else if (interaction.customId.startsWith('analysis_')) {
          await handleAnalysisButtons(interaction);
        } else if (interaction.customId.startsWith('study_')) {
          await handleStudyButtons(interaction);
        } else {
          log.warn(`${LOG_NAME}: Unknown/invalid interaction: ${interaction.customId}`);
        }
      } catch (error) {
        log.error(`${LOG_NAME}: ${interaction.customId}:`, error);
        
        const errorMessage = 'There was an error processing this interaction.';
        if (interaction.replied || interaction.deferred) {
          await interaction.editReply(errorMessage);
        } else {
          await interaction.reply({ content: errorMessage, flags: MessageFlags.Ephemeral });
        }
      }
    }
  }
};