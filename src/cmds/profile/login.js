import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js'
import { userManager } from '../../data/userData.js'
import { fetchUserProfile, getUserPerfStats } from '../../utils/api/lichessApi.js'
import { fetchChessComProfile } from '../../utils/api/chesscomApi.js'

export default {
  data: new SlashCommandBuilder()
    .setName('login')
    .setDescription('link your chess accounts')
    .addSubcommand(sub =>
      sub.setName('lichess')
        .setDescription('link your lichess account')
        .addStringOption(opt =>
          opt.setName('username').setDescription('lichess username').setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('chesscom')
        .setDescription('link your chess.com account')
        .addStringOption(opt =>
          opt.setName('username').setDescription('chess.com username').setRequired(true)
        )
    ),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral })
    
    const subcommand = interaction.options.getSubcommand()
    const username = interaction.options.getString('username')
    const userId = interaction.user.id

    if (subcommand === 'lichess') {
      const profile = await fetchUserProfile(username)
      if (!profile) {
        return interaction.editReply({
          content: 'lichess user not found or profile is private'
        })
      }

      await userManager.setLichess(userId, username)
      
      const embed = new EmbedBuilder()
        .setTitle('lichess account linked')
        .setColor(0x00ff00)
        .setDescription(`linked to **${profile.username}**`)
        .addFields(
          { name: 'rating', value: profile.perfs?.blitz?.rating?.toString() || 'unrated', inline: true },
          { name: 'games', value: profile.count?.all?.toString() || '0', inline: true }
        )
        .setThumbnail(`https://lichess1.org/export/lichess_logo_2019.png`)

      await interaction.editReply({ embeds: [embed] })
      
    } else if (subcommand === 'chesscom') {
      const data = await fetchChessComProfile(username)
      if (!data?.profile) {
        return interaction.editReply({
          content: 'chess.com user not found'
        })
      }

      await userManager.setChessCom(userId, username)
      
      const embed = new EmbedBuilder()
        .setTitle('chess.com account linked')
        .setColor(0x00ff00)
        .setDescription(`linked to **${data.profile.username}**`)
        .addFields(
          { name: 'rating', value: data.stats?.chess_blitz?.last?.rating?.toString() || 'unrated', inline: true },
          { name: 'games', value: (data.stats?.chess_blitz?.record?.win + data.stats?.chess_blitz?.record?.loss + data.stats?.chess_blitz?.record?.draw)?.toString() || '0', inline: true }
        )
        .setThumbnail(data.profile.avatar || null)

      await interaction.editReply({ embeds: [embed] })
    }
  }
}