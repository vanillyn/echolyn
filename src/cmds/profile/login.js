import { SlashCommandBuilder, EmbedBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js'
import { userManager } from '../../data/userData.js'
import { fetchUserProfile } from '../../utils/api/lichessApi.js'
import { fetchChessComProfile } from '../../utils/api/chesscomApi.js'
import { lichessAuth } from '../../utils/api/lichessAuth.js'

export default {
  data: new SlashCommandBuilder()
    .setName('login')
    .setDescription('link your chess accounts')
    .addSubcommand(sub =>
      sub.setName('lichess')
        .setDescription('link your lichess account with OAuth')
    )
    .addSubcommand(sub =>
      sub.setName('lichess-username')
        .setDescription('link lichess by username only (limited features)')
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
    )
    .addSubcommand(sub =>
      sub.setName('status')
        .setDescription('check your linked accounts status')
    ),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral })
    
    const subcommand = interaction.options.getSubcommand()
    const userId = interaction.user.id

    if (subcommand === 'lichess') {
      const authUrl = lichessAuth.generateAuthUrl(userId)
      
      const embed = new EmbedBuilder()
        .setTitle('lichess oauth login')
        .setColor(0x000000)
        .setDescription('click the button below to authorize echolyn to access your lichess account')
        .addFields(
          { name: 'features with oauth', value: '• access private games\n• create challenges\n• read preferences\n• enhanced game analysis', inline: false },
          { name: 'permissions requested', value: '• read games\n• read preferences\n• create/accept challenges', inline: false }
        )
        .setFooter({ text: 'your token is stored securely and can be revoked anytime' })

      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setLabel('authorize on lichess')
            .setStyle(ButtonStyle.Link)
            .setURL(authUrl)
        )

      await interaction.editReply({ 
        content: '**important:** after authorizing on lichess, you need to complete the setup. please let me know when you\'ve authorized and i\'ll help you finish the process.',
        embeds: [embed], 
        components: [row] 
      })

    } else if (subcommand === 'lichess-username') {
      const username = interaction.options.getString('username')
      const profile = await fetchUserProfile(username)
      
      if (!profile) {
        return interaction.editReply({
          content: 'lichess user not found or profile is private'
        })
      }

      await userManager.setLichess(userId, username, null)
      
      const embed = new EmbedBuilder()
        .setTitle('lichess account linked (username only)')
        .setColor(0xffa500)
        .setDescription(`linked to **${profile.id}**`)
        .addFields(
          { name: 'rating', value: profile.perfs?.blitz?.rating?.toString() || 'unrated', inline: true },
          { name: 'games', value: profile.count?.all?.toString() || '0', inline: true },
          { name: 'limitations', value: 'public data only - use `/login lichess` for full oauth access', inline: false }
        )
        .setThumbnail(`https://lichess1.org/export/lichess_logo_2019.png`)

      await interaction.editReply({ embeds: [embed] })
      
    } else if (subcommand === 'chesscom') {
      const username = interaction.options.getString('username')
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

    } else if (subcommand === 'status') {
      const profile = await userManager.getProfile(userId)
      
      const embed = new EmbedBuilder()
        .setTitle('account status')
        .setColor(0x0099ff)

      let description = ''
      
      if (profile.lichess) {
        const status = profile.lichess.hasToken ? '🟢 oauth connected' : '🟡 username only'
        description += `**lichess**: ${profile.lichess.username} (${status})\n`
      } else {
        description += '**lichess**: not linked\n'
      }

      if (profile.chesscom) {
        description += `**chess.com**: ${profile.chesscom.username} 🟢\n`
      } else {
        description += '**chess.com**: not linked\n'
      }

      const echolyn = profile.echolyn
      const ratingDisplay = echolyn.games === 0 ? `${echolyn.rating}?` : echolyn.rating.toString()
      description += `**echolyn**: ${ratingDisplay} rating (${echolyn.games} games) 🟢`

      embed.setDescription(description)
      
      if (!profile.lichess && !profile.chesscom && echolyn.games === 0) {
        embed.setDescription('no accounts linked - use `/login` commands to connect your profiles')
      }

      await interaction.editReply({ embeds: [embed] })
    }
  }
}