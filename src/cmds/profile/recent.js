import { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } from 'discord.js'
import { userManager } from '../../data/userData.js'
import { fetchUserGames } from '../../utils/api/lichessApi.js'
import { fetchChessComRecentGames } from '../../utils/api/chesscomApi.js'

export default {
  data: new SlashCommandBuilder()
    .setName('recentgames')
    .setDescription('view recent games from linked accounts')
    .addUserOption(opt =>
      opt.setName('user').setDescription('discord user (defaults to you)').setRequired(false)
    )
    .addIntegerOption(opt =>
      opt.setName('limit').setDescription('number of games to show (default 10)').setRequired(false).setMinValue(1).setMaxValue(25)
    ),

  async execute(interaction) {
    await interaction.deferReply()
    
    const targetUser = interaction.options.getUser('user') || interaction.user
    const limit = interaction.options.getInteger('limit') || 10
    const userId = targetUser.id
    const profile = userManager.getProfile(userId)

    if (!profile.lichess && !profile.chesscom) {
      return interaction.editReply({
        content: `${targetUser.displayName} hasn't linked any chess accounts`
      })
    }

    let allGames = []

    if (profile.lichess) {
      try {
        const lichessData = await fetchUserGames(profile.lichess.username, limit, true)
        if (lichessData) {
          const games = lichessData.trim().split('\n').map(line => {
            try {
              const game = JSON.parse(line)
              return {
                id: game.id,
                url: `https://lichess.org/${game.id}`,
                white: game.players?.white?.user?.name || 'Anonymous',
                black: game.players?.black?.user?.name || 'Anonymous',
                result: game.winner ? (game.winner === 'white' ? '1-0' : '0-1') : '1/2-1/2',
                timeControl: game.speed,
                endTime: game.createdAt,
                site: 'lichess',
                rated: game.rated,
                pgn: game.pgn
              }
            } catch (e) {
              return null
            }
          }).filter(Boolean)
          allGames.push(...games)
        }
      } catch (err) {
        console.error('Lichess games error:', err)
      }
    }

    if (profile.chesscom) {
      try {
        const chesscomGames = await fetchChessComRecentGames(profile.chesscom.username, limit)
        allGames.push(...chesscomGames)
      } catch (err) {
        console.error('Chess.com games error:', err)
      }
    }

    if (allGames.length === 0) {
      return interaction.editReply({
        content: 'no recent games found'
      })
    }

    allGames.sort((a, b) => new Date(b.endTime) - new Date(a.endTime))
    allGames = allGames.slice(0, limit)

    const embed = new EmbedBuilder()
      .setTitle(`${targetUser.displayName} - recent games`)
      .setColor(0x0099ff)
      .setDescription(`showing ${allGames.length} most recent games`)

    let gameList = ''
    allGames.forEach((game, i) => {
      const date = new Date(game.endTime).toLocaleDateString()
      const site = game.site === 'lichess' ? '♗' : '♔'
      const result = game.result === '1-0' ? '1-0' : game.result === '0-1' ? '0-1' : '½-½'
      gameList += `\`${i + 1}.\` ${site} **${game.white}** vs **${game.black}** ${result} (${date})\n`
    })

    embed.addFields({ name: 'games', value: gameList || 'none', inline: false })

    const buttons = []
    for (let i = 0; i < Math.min(allGames.length, 5); i++) {
      buttons.push(
        new ButtonBuilder()
          .setCustomId(`view_${i}`)
          .setLabel(`View Game ${i + 1}`)
          .setStyle(ButtonStyle.Secondary)
      )
    }

    const row = new ActionRowBuilder().addComponents(buttons)

    const msg = await interaction.editReply({ embeds: [embed], components: [row] })

    const collector = msg.createMessageComponentCollector({ time: 5 * 60 * 1000 })

    collector.on('collect', async i => {
      if (i.user.id !== interaction.user.id) {
        return i.reply({ content: 'only the command user can use these buttons', ephemeral: true })
      }

      const gameIndex = parseInt(i.customId.split('_')[1])
      const game = allGames[gameIndex]

      if (!game) {
        return i.reply({ content: 'game not found', ephemeral: true })
      }

      let gameUrl = game.url
      if (game.site === 'lichess') {
        gameUrl = `https://lichess.org/${game.id}`
      }

      await i.reply({
        content: `**game ${gameIndex + 1}**: ${game.white} vs ${game.black}\nurl: ${gameUrl}\n\nuse \`/viewgame url:${gameUrl}\` to analyze this game`,
        ephemeral: true
      })
    })

    collector.on('end', () => {
      msg.edit({ components: [] }).catch(() => {})
    })
  }
}