import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js'
import { serverConfig } from '../../data/serverData.js'

export default {
  data: new SlashCommandBuilder()
    .setName('config')
    .setDescription('configure server settings')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
      sub.setName('titles')
        .setDescription('configure title roles')
        .addRoleOption(opt =>
          opt.setName('server_master').setDescription('server master role').setRequired(false)
        )
        .addIntegerOption(opt =>
          opt.setName('threshold').setDescription('server master rating threshold').setMinValue(1000).setMaxValue(3000).setRequired(false)
        )
        .addRoleOption(opt =>
          opt.setName('champion').setDescription('champion role').setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub.setName('view')
        .setDescription('view current server configuration')
    ),

  async execute(interaction) {
    if (!interaction.guild) {
      return interaction.reply({ content: 'This command can only be used in servers', ephemeral: true })
    }

    const subcommand = interaction.options.getSubcommand()

    if (subcommand === 'titles') {
      const smRole = interaction.options.getRole('server_master')
      const threshold = interaction.options.getInteger('threshold')
      const championRole = interaction.options.getRole('champion')

      if (smRole) {
        await serverConfig.setServerMasterRole(interaction.guild.id, smRole.id, threshold || 1800)
      } else if (threshold) {
        const config = await serverConfig.getConfig(interaction.guild.id)
        if (config.sm_role_id) {
          await serverConfig.setServerMasterRole(interaction.guild.id, config.sm_role_id, threshold)
        }
      }

      if (championRole) {
        await serverConfig.setChampionRole(interaction.guild.id, championRole.id)
      }

      const embed = new EmbedBuilder()
        .setTitle('Title config updated')
        .setColor(0x00ff00)
        .setDescription('Server title roles have been configured')

      if (smRole) {
        embed.addFields({ 
          name: 'Role for Server Master', 
          value: `${smRole} (${threshold || 1800} rating required)`, 
          inline: false 
        })
      }

      if (championRole) {
        embed.addFields({ 
          name: 'Role for Champion', 
          value: `${championRole}`, 
          inline: false 
        })
      }

      await interaction.reply({ embeds: [embed] })

    } else if (subcommand === 'view') {
      const config = await serverConfig.getConfig(interaction.guild.id)
      
      const embed = new EmbedBuilder()
        .setTitle('Server Configuration')
        .setColor(0x0099ff)

      let description = ''

      if (config.sm_role_id) {
        const smRole = interaction.guild.roles.cache.get(config.sm_role_id)
        description += `**Server Master Role**: ${smRole || 'Role not found'}\n`
        description += `**SM Threshold**: ${config.sm_threshold} rating\n`
      } else {
        description += `**Server Master Role**: Not configured\n`
      }

      if (config.champion_role_id) {
        const championRole = interaction.guild.roles.cache.get(config.champion_role_id)
        description += `**Champion Role**: ${championRole || 'Role not found'}\n`
      } else {
        description += `**Champion Role**: Not configured\n`
      }

      embed.setDescription(description)
      await interaction.reply({ embeds: [embed] })
    }
  }
}