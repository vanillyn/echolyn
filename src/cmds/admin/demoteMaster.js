import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js'
import { serverConfig } from '../../data/serverData.js'

export default {
  data: new SlashCommandBuilder()
    .setName('demote')
    .setDescription('remove server master status from a user')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption(opt =>
      opt.setName('user').setDescription('user to demote').setRequired(true)
    ),

  async execute(interaction) {
    if (!interaction.guild) {
      return interaction.reply({ content: 'This command can only be used in servers', ephemeral: true })
    }

    const user = interaction.options.getUser('user')
    const member = await interaction.guild.members.fetch(user.id).catch(() => null)

    if (!member) {
      return interaction.reply({ content: 'User not found in this server', ephemeral: true })
    }

    const config = await serverConfig.getConfig(interaction.guild.id)
    
    if (!config.sm_role_id) {
      return interaction.reply({ 
        content: 'Server Master role not configured', 
        ephemeral: true 
      })
    }

    const smRole = interaction.guild.roles.cache.get(config.sm_role_id)
    if (smRole && member.roles.cache.has(config.sm_role_id)) {
      await member.roles.remove(smRole)
    }

    await serverConfig.removeServerMaster(interaction.guild.id, user.id)

    const embed = new EmbedBuilder()
      .setTitle('User Demoted')
      .setColor(0xff6b6b)
      .setDescription(`${member.displayName} is no longer a Server Master`)
      .setThumbnail(user.displayAvatarURL())

    await interaction.reply({ embeds: [embed] })
  }
}
