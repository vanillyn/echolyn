import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js'
import { createChallenge, testLichessToken } from '../../../utils/api/lichessApi.js'
import { userManager } from '../../../data/userData.js'

const TIME_CONTROLS = {
  'bullet': { limit: 60, increment: 0 },
  'blitz-3': { limit: 180, increment: 0 },
  'blitz-5': { limit: 300, increment: 0 },
  'blitz-3+2': { limit: 180, increment: 2 },
  'blitz-5+3': { limit: 300, increment: 3 },
  'rapid-10': { limit: 600, increment: 0 },
  'rapid-15+10': { limit: 900, increment: 10 },
  'classical-30': { limit: 1800, increment: 0 }
}

export default {
  data: new SlashCommandBuilder()
    .setName('challenge')
    .setDescription('create a lichess challenge')
    .addStringOption(opt =>
      opt.setName('username')
        .setDescription('lichess username to challenge')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('time')
        .setDescription('time control')
        .setRequired(false)
        .addChoices(
          { name: '1+0 (bullet)', value: 'bullet' },
          { name: '3+0 (blitz)', value: 'blitz-3' },
          { name: '5+0 (blitz)', value: 'blitz-5' },
          { name: '3+2 (blitz)', value: 'blitz-3+2' },
          { name: '5+3 (blitz)', value: 'blitz-5+3' },
          { name: '10+0 (rapid)', value: 'rapid-10' },
          { name: '15+10 (rapid)', value: 'rapid-15+10' },
          { name: '30+0 (classical)', value: 'classical-30' }
        )
    )
    .addBooleanOption(opt =>
      opt.setName('rated')
        .setDescription('make the game rated (default: false)')
        .setRequired(false)
    )
    .addStringOption(opt =>
      opt.setName('color')
        .setDescription('color preference')
        .setRequired(false)
        .addChoices(
          { name: 'random', value: 'random' },
          { name: 'white', value: 'white' },
          { name: 'black', value: 'black' }
        )
    ),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral })
    
    const userId = interaction.user.id
    const targetUsername = interaction.options.getString('username')
    const timeControl = interaction.options.getString('time') || 'blitz-5'
    const rated = interaction.options.getBoolean('rated') || false
    const color = interaction.options.getString('color') || 'random'

    const profile = await userManager.getProfile(userId)
    if (!profile.lichess?.token) {
      return interaction.editReply({
        content: 'you need to link your lichess account with oauth first. use `/login lichess`'
      })
    }

    const tokenValid = await testLichessToken(userId)
    if (!tokenValid) {
      return interaction.editReply({
        content: 'your lichess token has expired. please re-authenticate using `/login lichess`'
      })
    }

    try {
      const timeConfig = TIME_CONTROLS[timeControl]
      const challengeOptions = {
        rated: rated.toString(),
        clockLimit: timeConfig.limit.toString(),
        clockIncrement: timeConfig.increment.toString(),
        color: color,
        variant: 'standard'
      }

      const result = await createChallenge(userId, targetUsername, challengeOptions)
      
      if (!result) {
        return interaction.editReply({
          content: 'failed to create challenge. the user might not exist or challenges might be disabled.'
        })
      }

      const embed = new EmbedBuilder()
        .setTitle('challenge sent!')
        .setColor(0x00ff00)
        .setDescription(`challenge sent to **${targetUsername}**`)
        .addFields(
          { name: 'time control', value: timeControl.replace('-', '+'), inline: true },
          { name: 'rated', value: rated ? 'yes' : 'no', inline: true },
          { name: 'color', value: color, inline: true }
        )
        .setFooter({ text: 'they will receive a notification on lichess' })

      if (result.challenge?.url) {
        embed.setURL(result.challenge.url)
        embed.addFields({ name: 'challenge link', value: result.challenge.url, inline: false })
      }

      await interaction.editReply({ embeds: [embed] })

    } catch (error) {
      console.error('Challenge error:', error)
      await interaction.editReply({
        content: `failed to create challenge: ${error.message}`
      })
    }
  }
}