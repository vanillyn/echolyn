import { log } from '../init.js'
import { MessageFlags } from 'discord.js'

export default {
  name: 'interactionCreate',
  async execute(interaction, client) {
    if (!interaction.isChatInputCommand()) return

    const command = client.commands.get(interaction.commandName)
    if (!command) {
      log.warn(`no command found for ${interaction.commandName}`)
      return
    }

    try {
      await command.execute(interaction, client)
    } catch (err) {
      log.error({ err }, 'command error')
      
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: 'error running command', flags: MessageFlags.Ephemeral })
      }
    }
  }
}
