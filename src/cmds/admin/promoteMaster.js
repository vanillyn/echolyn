import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js'
import { serverConfig } from '../../data/serverData.js'

export default {
  data: new SlashCommandBuilder()
    .setName('promote')
    .setDescription('promote a user to server master')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption(opt =>
      opt.setName('user').setDescription('user to promote').setRequired(true)
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
        content: 'Server Master role not configured. Use `/config titles` first.', 
        ephemeral: true 
      })
    }

    const smRole = interaction.guild.roles.cache.get(config.sm_role_id)
    if (!smRole) {
      return interaction.reply({ 
        content: 'Server Master role not found. Please reconfigure with `/config titles`.', 
        ephemeral: true 
      })
    }

    if (member.roles.cache.has(config.sm_role_id)) {
      return interaction.reply({ 
        content: `${member.displayName} is already a Server Master`, 
        ephemeral: true 
      })
    }

    await member.roles.add(smRole)
    await serverConfig.addServerMaster(interaction.guild.id, user.id)

    const embed = new EmbedBuilder()
      .setTitle('User Promoted')
      .setColor(0x00ff00)
      .setDescription(`${member.displayName} has been promoted to Server Master`)
      .setThumbnail(user.displayAvatarURL())

    await interaction.reply({ embeds: [embed] })
  }
}
