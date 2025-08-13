import { SlashCommandBuilder, EmbedBuilder } from 'discord.js'
import { userManager } from '../../data/userData.js'
import { eloSystem } from '../../data/elo.js'
import { eloRole } from '../../utils/eloRole.js'

export default {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('view the server leaderboard')
    .addIntegerOption(opt =>
      opt.setName('limit').setDescription('number of players to show').setMinValue(5).setMaxValue(25).setRequired(false)
    ),

  async execute(interaction) {
    await interaction.deferReply()
    
    const limit = interaction.options.getInteger('limit') || 10
    const leaderboard = await userManager.getLeaderboard(limit)

    if (leaderboard.length === 0) {
      return interaction.editReply({
        content: 'No rated players found.'
      })
    }

    const embed = new EmbedBuilder()
      .setTitle(`echolyn's leaderboard for ${interaction.guild ? interaction.guild.name : 'this server'}`)
      .setColor(0xffd700)
      .setDescription(`Top ${leaderboard.length} players`)

    let leaderboardText = ''
    
    for (let i = 0; i < leaderboard.length; i++) {
      const player = leaderboard[i]
      const user = await interaction.client.users.fetch(player.discord_id).catch(() => null)
      const displayName = user ? user.displayName : 'Unknown User'
      
      let title = ''
      if (interaction.guild) {
        const userTitle = await eloRole.getUserTitle(interaction.guild.id, player.discord_id)
        if (userTitle) title = ` [${userTitle}]`
      }
      
      const rank = i + 1
      const emoji = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`
      const ratingDisplay = player.is_rated ? player.echolyn_rating : `${player.echolyn_rating}?`
      const winRate = player.echolyn_games > 0 ? ((player.echolyn_wins / player.echolyn_games) * 100).toFixed(1) : '0.0'
      const ratingClass = eloSystem.getRatingClass(player.echolyn_rating)
      
      leaderboardText += `${emoji} **${displayName}**${title}\n`
      leaderboardText += `    ${ratingDisplay} (${ratingClass}) • ${player.echolyn_games} games • ${winRate}% WR\n\n`
    }

    embed.addFields({ name: 'Rankings', value: leaderboardText, inline: false })

    const totalPlayers = leaderboard.length
    const totalGames = leaderboard.reduce((sum, player) => sum + player.echolyn_games, 0)
    const averageRating = Math.round(leaderboard.reduce((sum, player) => sum + player.echolyn_rating, 0) / totalPlayers)

    embed.addFields({
      name: 'Server Stats',
      value: `**Players:** ${totalPlayers}\n**Total Games:** ${Math.floor(totalGames / 2)}\n**Average Rating:** ${averageRating}`,
      inline: true
    })

    if (interaction.guild && leaderboard.length > 0) {
      const championTitle = await eloRole.getUserTitle(interaction.guild.id, leaderboard[0].discord_id)
      if (championTitle === 'Champion') {
        const champion = await interaction.client.users.fetch(leaderboard[0].discord_id).catch(() => null)
        if (champion) {
          embed.addFields({
            name: 'Server Champion (has the highest rating)',
            value: `${champion.displayName} (${leaderboard[0].echolyn_rating})`,
            inline: true
          })
        }
      }
    }

    embed.setFooter({ text: 'in order to appear on the leaderboard, you need to play games with echolyn.' })
    embed.setTimestamp()

    await interaction.editReply({ embeds: [embed] })
  }
}