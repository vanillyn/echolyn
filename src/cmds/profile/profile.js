import { SlashCommandBuilder, EmbedBuilder } from 'discord.js'
import { userManager } from '../../data/userData.js'
import { fetchUserProfile, getUserPerfStats } from '../../utils/api/lichessApi.js'
import { fetchChessComProfile } from '../../utils/api/chesscomApi.js'

export default {
  data: new SlashCommandBuilder()
    .setName('profile')
    .setDescription('view chess profiles')
    .addSubcommand(sub =>
      sub.setName('lichess')
        .setDescription('view lichess profile')
        .addUserOption(opt =>
          opt.setName('user').setDescription('discord user (defaults to you)').setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub.setName('chesscom')
        .setDescription('view chess.com profile')  
        .addUserOption(opt =>
          opt.setName('user').setDescription('discord user (defaults to you)').setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub.setName('echolyn')
        .setDescription('view local bot profile')
        .addUserOption(opt =>
          opt.setName('user').setDescription('discord user (defaults to you)').setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub.setName('all')
        .setDescription('view all linked profiles')
        .addUserOption(opt =>
          opt.setName('user').setDescription('discord user (defaults to you)').setRequired(false)
        )
    ),

  async execute(interaction) {
    await interaction.deferReply()
    
    const subcommand = interaction.options.getSubcommand()
    const targetUser = interaction.options.getUser('user') || interaction.user
    const userId = targetUser.id
    const profile = userManager.getProfile(userId)

    if (subcommand === 'lichess') {
      if (!profile.lichess) {
        return interaction.editReply({
          content: `${targetUser.displayName} hasn't linked a lichess account`
        })
      }

      const data = await fetchUserProfile(profile.lichess.username)
      if (!data) {
        return interaction.editReply({
          content: 'failed to fetch lichess profile'
        })
      }

      const embed = new EmbedBuilder()
        .setTitle(`${data.username} - lichess`)
        .setColor(0x000000)
        .setURL(`https://lichess.org/@/${data.username}`)
        .setThumbnail(`https://lichess1.org/export/lichess_logo_2019.png`)
        .addFields(
          { name: 'bullet', value: `${data.perfs?.bullet?.rating || 'unrated'} (${data.perfs?.bullet?.games || 0} games)`, inline: true },
          { name: 'blitz', value: `${data.perfs?.blitz?.rating || 'unrated'} (${data.perfs?.blitz?.games || 0} games)`, inline: true },
          { name: 'rapid', value: `${data.perfs?.rapid?.rating || 'unrated'} (${data.perfs?.rapid?.games || 0} games)`, inline: true },
          { name: 'classical', value: `${data.perfs?.classical?.rating || 'unrated'} (${data.perfs?.classical?.games || 0} games)`, inline: true },
          { name: 'total games', value: data.count?.all?.toString() || '0', inline: true },
          { name: 'joined', value: new Date(data.createdAt).toLocaleDateString(), inline: true }
        )

      if (data.profile?.bio) {
        embed.setDescription(data.profile.bio.slice(0, 200))
      }

      await interaction.editReply({ embeds: [embed] })

    } else if (subcommand === 'chesscom') {
      if (!profile.chesscom) {
        return interaction.editReply({
          content: `${targetUser.displayName} hasn't linked a chess.com account`
        })
      }

      const data = await fetchChessComProfile(profile.chesscom.username)
      if (!data?.profile) {
        return interaction.editReply({
          content: 'failed to fetch chess.com profile'
        })
      }

      const embed = new EmbedBuilder()
        .setTitle(`${data.profile.username} - chess.com`)
        .setColor(0x7fa650)
        .setURL(data.profile.url)
        .setThumbnail(data.profile.avatar)
        .addFields(
          { name: 'bullet', value: `${data.stats?.chess_bullet?.last?.rating || 'unrated'} (${(data.stats?.chess_bullet?.record?.win + data.stats?.chess_bullet?.record?.loss + data.stats?.chess_bullet?.record?.draw) || 0} games)`, inline: true },
          { name: 'blitz', value: `${data.stats?.chess_blitz?.last?.rating || 'unrated'} (${(data.stats?.chess_blitz?.record?.win + data.stats?.chess_blitz?.record?.loss + data.stats?.chess_blitz?.record?.draw) || 0} games)`, inline: true },
          { name: 'rapid', value: `${data.stats?.chess_rapid?.last?.rating || 'unrated'} (${(data.stats?.chess_rapid?.record?.win + data.stats?.chess_rapid?.record?.loss + data.stats?.chess_rapid?.record?.draw) || 0} games)`, inline: true },
          { name: 'daily', value: `${data.stats?.chess_daily?.last?.rating || 'unrated'} (${(data.stats?.chess_daily?.record?.win + data.stats?.chess_daily?.record?.loss + data.stats?.chess_daily?.record?.draw) || 0} games)`, inline: true },
          { name: 'followers', value: data.profile.followers?.toString() || '0', inline: true },
          { name: 'joined', value: new Date(data.profile.joined * 1000).toLocaleDateString(), inline: true }
        )

      await interaction.editReply({ embeds: [embed] })

    } else if (subcommand === 'echolyn') {
      const echolyn = profile.echolyn

      const embed = new EmbedBuilder()
        .setTitle(`${targetUser.displayName} - echolyn`)
        .setColor(0x5865f2)
        .addFields(
          { name: 'rating', value: echolyn.rating.toString(), inline: true },
          { name: 'games', value: echolyn.games.toString(), inline: true },
          { name: 'wins', value: echolyn.wins.toString(), inline: true },
          { name: 'losses', value: echolyn.losses.toString(), inline: true },
          { name: 'draws', value: echolyn.draws.toString(), inline: true },
          { name: 'win rate', value: echolyn.games > 0 ? `${((echolyn.wins / echolyn.games) * 100).toFixed(1)}%` : '0%', inline: true }
        )

      await interaction.editReply({ embeds: [embed] })

    } else if (subcommand === 'all') {
      const embed = new EmbedBuilder()
        .setTitle(`${targetUser.displayName} - all profiles`)
        .setColor(0x0099ff)

      let description = ''

      if (profile.lichess) {
        const data = await fetchUserProfile(profile.lichess.username)
        if (data) {
          description += `**lichess**: ${data.username} (${data.perfs?.blitz?.rating || 'unrated'} blitz)\n`
        }
      }

      if (profile.chesscom) {
        const data = await fetchChessComProfile(profile.chesscom.username)
        if (data?.profile) {
          description += `**chess.com**: ${data.profile.username} (${data.stats?.chess_blitz?.last?.rating || 'unrated'} blitz)\n`
        }
      }

      description += `**echolyn**: ${profile.echolyn.rating} rating (${profile.echolyn.games} games)`

      if (!profile.lichess && !profile.chesscom && profile.echolyn.games === 0) {
        description = 'no accounts linked - use `/login` to connect your profiles'
      }

      embed.setDescription(description)
      await interaction.editReply({ embeds: [embed] })
    }
  }
}