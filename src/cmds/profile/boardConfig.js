import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} from 'discord.js'
import { getUserConfig, setUserConfig, DEFAULT_CONFIG, drawBoard } from '../../utils/drawBoard.js'
import { userManager } from '../../data/userData.js'

const COLOR_PRESETS = {
  'lichess': {
    lightColor: '#f0d9b5',
    darkColor: '#b58863',
    borderColor: '#8b7355'
  },
  'chess.com': {
    lightColor: '#eeeed2',
    darkColor: '#769656',
    borderColor: '#587340'
  },
  'dark': {
    lightColor: '#404040',
    darkColor: '#202020',
    borderColor: '#101010',
    coordinateColor: '#ffffff',
    playerTextColor: '#ffffff'
  },
  'classic': {
    lightColor: '#ffffff',
    darkColor: '#000000',
    borderColor: '#333333'
  },
  'blue': {
    lightColor: '#dee3e6',
    darkColor: '#8ca2ad',
    borderColor: '#4a6b7c'
  },
  'rose.pine': {
    lightColor: '#e0def4',
    darkColor: '#26233a',
    borderColor: '#161420'
  },
  'catppuccin': {
    lightColor: '#cdd6f4',
    darkColor: '#1e1e2e', 
    borderColor: '#181825'
  }
}

const PIECE_SETS = [
  'alpha', 'caliente', 'cardinal', 'celtic', 'chessnut', 'cooke', 'dubrovny', 'firi', 'gioco', 'horsey', 'kiwen-suwi', 'leipzig', 'maestro', 'monarchy', 'mpchess', 'pixel', 'rhosgfx', 'shapes', 'staunty', 'xkcd',
  'anarcandy', 'california', 'cburnett', 'chess7', 'companion', 'disguised', 'fantasy', 'fresca', 'governor', 'icpieces', 'kosal', 'letter', 'merida', 'mono', 'pirouetti', 'reillycraig', 'riohacha', 'spatial', 'tatiana'
]

export default {
  data: new SlashCommandBuilder()
    .setName('customize')
    .setDescription('configure board appearance')
    .addSubcommand(sub =>
      sub.setName('board')
        .setDescription('configure chess board appearance')
    )
    .addSubcommand(sub =>
      sub.setName('preview')
        .setDescription('preview your board configuration')
    )
    .addSubcommand(sub =>
      sub.setName('reset')
        .setDescription('reset board configuration to defaults')
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand()
    const userId = interaction.user.id

    if (subcommand === 'preview') {
      await interaction.deferReply()
      
      try {
        const config = await getUserConfig(userId)
        const testFen = 'rnbqkbnr/pp1ppppp/8/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2'
        
        const buffer = await drawBoard(testFen, {
          ...config,
          players: { white: `${await interaction.user.name} (${(await userManager.getProfile(interaction.user.id)).echolyn.rating})`, black: 'Opponent (1600)' },
          clocks: { white: '10:00', black: '9:45' },
          eval: 0.2,
          bestMove: 'd7d6'
        }, userId)

        const embed = new EmbedBuilder()
          .setTitle('Board Configuration Preview')
          .setColor(0x0099ff)
          .setImage('attachment://preview.png')
          .setDescription('This is how your board will appear in games')

        await interaction.editReply({
          embeds: [embed],
          files: [{ attachment: buffer, name: 'preview.png' }]
        })
      } catch (error) {
        console.error('Preview error:', error)
        await interaction.editReply({ content: 'Failed to generate preview' })
      }
      return
    }

    if (subcommand === 'reset') {
      await setUserConfig(userId, DEFAULT_CONFIG)
      
      const embed = new EmbedBuilder()
        .setTitle('Board Configuration Reset')
        .setColor(0x00ff00)
        .setDescription('Your board configuration has been reset to defaults')

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral })
      return
    }

    if (subcommand === 'board') {
      const config = await getUserConfig(userId)
      
      const embed = new EmbedBuilder()
        .setTitle('Board Configuration')
        .setColor(0x0099ff)
        .setDescription('Configure your chess board appearance')
        .addFields(
          { name: 'Size', value: `${config.size}px`, inline: true },
          { name: 'Piece Set', value: config.pieceSet, inline: true },
          { name: 'Coordinates', value: config.showCoordinates ? 'Enabled' : 'Disabled', inline: true },
          { name: 'Light Squares', value: config.lightColor, inline: true },
          { name: 'Dark Squares', value: config.darkColor, inline: true },
          { name: 'Border', value: config.borderColor, inline: true }
        )

      const components = [
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('config_category')
            .setPlaceholder('Choose configuration category')
            .addOptions([
              { label: 'Colors & Theme', value: 'colors', description: 'Board colors and themes' },
              { label: 'Piece Set', value: 'pieces', description: 'Choose piece style' },
              { label: 'Display Options', value: 'display', description: 'Size, coordinates, etc.' },
              { label: 'Style Options', value: 'style', description: 'Arrows, shadows, borders' }
            ])
        ),
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('preview_config')
            .setLabel('Preview')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId('reset_config')
            .setLabel('Reset to Defaults')
            .setStyle(ButtonStyle.Danger)
        )
      ]

      const msg = await interaction.reply({
        embeds: [embed],
        components,
        flags: MessageFlags.Ephemeral
      })

      const collector = msg.createMessageComponentCollector({ time: 5 * 60 * 1000 })

      collector.on('collect', async i => {
        if (i.user.id !== interaction.user.id) {
          return i.reply({ content: 'Only the command user can configure this', flags: MessageFlags.Ephemeral })
        }

        if (i.customId === 'preview_config') {
          await i.deferReply({ flags: MessageFlags.Ephemeral })
          
          try {
            const currentConfig = await getUserConfig(userId)
            const testFen = 'rnbqkbnr/pp1ppppp/8/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2'
            
            const buffer = await drawBoard(testFen, {
              ...currentConfig,
              players: { white: 'You (1500)', black: 'Opponent (1600)' },
              clocks: { white: '10:00', black: '9:45' },
              eval: 0.2,
              bestMove: 'd7d6'
            }, userId)

            const embed = new EmbedBuilder()
              .setTitle('Configuration Preview')
              .setColor(0x0099ff)
              .setImage('attachment://preview.png')

            await i.editReply({
              embeds: [embed],
              files: [{ attachment: buffer, name: 'preview.png' }]
            })
          } catch (error) {
            await i.editReply({ content: 'Failed to generate preview' })
          }
          return
        }

        if (i.customId === 'reset_config') {
          await setUserConfig(userId, DEFAULT_CONFIG)
          await i.reply({ content: 'Configuration reset to defaults!', flags: MessageFlags.Ephemeral })
          return
        }

        if (i.customId === 'config_category') {
          const category = i.values[0]
          
          if (category === 'colors') {
            await this.showColorConfig(i, userId)
          } else if (category === 'pieces') {
            await this.showPieceConfig(i, userId)
          } else if (category === 'display') {
            await this.showDisplayConfig(i, userId)
          } else if (category === 'style') {
            await this.showStyleConfig(i, userId)
          }
        }
      })

      collector.on('end', () => {
        msg.edit({ components: [] }).catch(() => {})
      })
    }
  },

  async showColorConfig(interaction, userId) {
    const config = await getUserConfig(userId)
    
    const embed = new EmbedBuilder()
      .setTitle('Color Configuration')
      .setColor(0x0099ff)
      .addFields(
        { name: 'Current Colors', value: `Light: ${config.lightColor}\nDark: ${config.darkColor}\nBorder: ${config.borderColor}`, inline: true }
      )

    const presetOptions = Object.keys(COLOR_PRESETS).map(preset => ({
      label: preset.charAt(0).toUpperCase() + preset.slice(1),
      value: `preset_${preset}`,
      description: `Apply ${preset} color scheme`
    }))

    const components = [
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('color_preset')
          .setPlaceholder('Choose a color preset')
          .addOptions(presetOptions)
      ),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('custom_colors')
          .setLabel('Custom Colors')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('back_to_main')
          .setLabel('← Back')
          .setStyle(ButtonStyle.Secondary)
      )
    ]

    await interaction.update({ embeds: [embed], components })

    const collector = interaction.message.createMessageComponentCollector({ time: 5 * 60 * 1000 })
    
    collector.on('collect', async i => {
      if (i.user.id !== interaction.user.id) return

      if (i.customId === 'color_preset') {
        const presetKey = i.values[0].replace('preset_', '')
        const preset = COLOR_PRESETS[presetKey]
        
        await setUserConfig(userId, preset)
        await i.reply({ 
          content: `Applied ${presetKey} color scheme!`, 
          flags: MessageFlags.Ephemeral 
        })
      } else if (i.customId === 'custom_colors') {
        await this.showCustomColorModal(i, userId)
      } else if (i.customId === 'back_to_main') {
        await this.showMainConfig(i, userId)
      }
    })
  },

  async showPieceConfig(interaction, userId) {
    const config = await getUserConfig(userId)
    
    const embed = new EmbedBuilder()
      .setTitle('Piece Set Configuration')
      .setColor(0x0099ff)
      .addFields(
        { name: 'Current Piece Set', value: config.pieceSet, inline: true }
      )

    const pieceOptions = PIECE_SETS.map(set => ({
      label: set.charAt(0).toUpperCase() + set.slice(1),
      value: `pieces_${set}`,
      description: `Switch to ${set} piece set`
    }))

    const components = [
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('piece_set')
          .setPlaceholder('Choose a piece set')
          .addOptions(pieceOptions.slice(0, 25))
      ),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('back_to_main')
          .setLabel('← Back')
          .setStyle(ButtonStyle.Secondary)
      )
    ]

    await interaction.update({ embeds: [embed], components })

    const collector = interaction.message.createMessageComponentCollector({ time: 5 * 60 * 1000 })
    
    collector.on('collect', async i => {
      if (i.user.id !== interaction.user.id) return

      if (i.customId === 'piece_set') {
        const pieceSet = i.values[0].replace('pieces_', '')
        await setUserConfig(userId, { pieceSet })
        await i.reply({ 
          content: `Applied setting.`, 
          flags: MessageFlags.Ephemeral 
        })
      } else if (i.customId === 'back_to_main') {
        await this.showMainConfig(i, userId)
      }
    })
  },

  async showDisplayConfig(interaction, userId) {
    const config = await getUserConfig(userId)
    
    const embed = new EmbedBuilder()
      .setTitle('Display Configuration')
      .setColor(0x0099ff)
      .addFields(
        { name: 'Size', value: `${config.size}px`, inline: true },
        { name: 'Coordinates', value: config.showCoordinates ? 'Enabled' : 'Disabled', inline: true },
        { name: 'Coordinate Position', value: config.coordinatePosition, inline: true }
      )

    const components = [
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('display_option')
          .setPlaceholder('Choose display option')
          .addOptions([
            { label: 'Board Size', value: 'size', description: 'Change board size' },
            { label: 'Coordinates', value: 'coordinates', description: 'Toggle coordinate display' },
            { label: 'Coordinate Position', value: 'coord_pos', description: 'Inside/outside squares' }
          ])
      ),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('back_to_main')
          .setLabel('← Back')
          .setStyle(ButtonStyle.Secondary)
      )
    ]

    await interaction.update({ embeds: [embed], components })

    const collector = interaction.message.createMessageComponentCollector({ time: 5 * 60 * 1000 })
    
    collector.on('collect', async i => {
      if (i.user.id !== interaction.user.id) return

      if (i.customId === 'display_option') {
        const option = i.values[0]
        
        if (option === 'size') {
          const modal = new ModalBuilder()
            .setCustomId('size_modal')
            .setTitle('Board Size')
            .addComponents(
              new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                  .setCustomId('size_input')
                  .setLabel('Board size')
                  .setStyle(TextInputStyle.Short)
                  .setValue(config.size.toString())
                  .setRequired(true)
              )
            )
          
          await i.showModal(modal)
          
          const modalSubmit = await i.awaitModalSubmit({ time: 60000 }).catch(() => null)
          if (modalSubmit) {
            const size = parseInt(modalSubmit.fields.getTextInputValue('size_input'))
            if ([256, 512, 1024].includes(size)) {
              await setUserConfig(userId, { size })
              await modalSubmit.reply({ content: `Setting applied`, flags: MessageFlags.Ephemeral })
            } else {
              await modalSubmit.reply({ content: 'Invalid size. Use 256 (1x), 512 (2x), or 1024 (4x)', flags: MessageFlags.Ephemeral })
            }
          }
        } else if (option === 'coordinates') {
          await setUserConfig(userId, { showCoordinates: !config.showCoordinates })
          await i.reply({ 
            content: `Coordinates ${config.showCoordinates ? 'disabled' : 'enabled'}!`, 
            flags: MessageFlags.Ephemeral 
          })
        } else if (option === 'coord_pos') {
          const newPos = config.coordinatePosition === 'inside' ? 'outside' : 'inside'
          await setUserConfig(userId, { coordinatePosition: newPos })
          await i.reply({ 
            content: `Coordinate position set to ${newPos}!`, 
            flags: MessageFlags.Ephemeral 
          })
        }
      } else if (i.customId === 'back_to_main') {
        await this.showMainConfig(i, userId)
      }
    })
  },

  async showStyleConfig(interaction, userId) {
    const config = await getUserConfig(userId)
    
    const embed = new EmbedBuilder()
      .setTitle('Style Configuration')
      .setColor(0x0099ff)
      .addFields(
        { name: 'Shadows', value: config.shadowEnabled ? 'Enabled' : 'Disabled', inline: true },
        { name: 'Arrow Style', value: config.arrowStyle, inline: true },
        { name: 'Border Radius', value: `${config.borderRadius}px`, inline: true }
      )

    const components = [
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('style_option')
          .setPlaceholder('Choose style option')
          .addOptions([
            { label: 'Toggle Shadows', value: 'shadows', description: 'Toggle drop shadows' },
            { label: 'Arrow Style', value: 'arrows', description: 'Change arrow appearance' },
            { label: 'Border Radius', value: 'radius', description: 'Adjust corner roundness' }
          ])
      ),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('back_to_main')
          .setLabel('← Back')
          .setStyle(ButtonStyle.Secondary)
      )
    ]

    await interaction.update({ embeds: [embed], components })

    const collector = interaction.message.createMessageComponentCollector({ time: 5 * 60 * 1000 })
    
    collector.on('collect', async i => {
      if (i.user.id !== interaction.user.id) return

      if (i.customId === 'style_option') {
        const option = i.values[0]
        
        if (option === 'shadows') {
          await setUserConfig(userId, { shadowEnabled: !config.shadowEnabled })
          await i.reply({ 
            content: `Shadows ${config.shadowEnabled ? 'disabled' : 'enabled'}!`, 
            flags: MessageFlags.Ephemeral 
          })
        } else if (option === 'arrows') {
          const styles = ['default', 'thick', 'thin']
          const currentIndex = styles.indexOf(config.arrowStyle)
          const newStyle = styles[(currentIndex + 1) % styles.length]
          
          await setUserConfig(userId, { arrowStyle: newStyle })
          await i.reply({ 
            content: `Applied settings.`, 
            flags: MessageFlags.Ephemeral 
          })
        } else if (option === 'radius') {
          const modal = new ModalBuilder()
            .setCustomId('radius_modal')
            .setTitle('Border Radius')
            .addComponents(
              new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                  .setCustomId('radius_input')
                  .setLabel('Border radius (0-20px)')
                  .setStyle(TextInputStyle.Short)
                  .setValue(config.borderRadius.toString())
                  .setRequired(true)
              )
            )
          
          await i.showModal(modal)
          
          const modalSubmit = await i.awaitModalSubmit({ time: 60000 }).catch(() => null)
          if (modalSubmit) {
            const radius = parseInt(modalSubmit.fields.getTextInputValue('radius_input'))
            if (radius >= 0 && radius <= 20) {
              await setUserConfig(userId, { borderRadius: radius })
              await modalSubmit.reply({ content: `Applied setting.`, flags: MessageFlags.Ephemeral })
            } else {
              await modalSubmit.reply({ content: 'Invalid radius (or not a number).', flags: MessageFlags.Ephemeral })
            }
          }
        }
      } else if (i.customId === 'back_to_main') {
        await this.showMainConfig(i, userId)
      }
    })
  },

  async showCustomColorModal(interaction, userId) {
    const config = await getUserConfig(userId)
    
    const modal = new ModalBuilder()
      .setCustomId('custom_color_modal')
      .setTitle('Customize board colors')
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('light_color')
            .setLabel('light square color')
            .setStyle(TextInputStyle.Short)
            .setValue(config.lightColor)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('dark_color')
            .setLabel('dark square color')
            .setStyle(TextInputStyle.Short)
            .setValue(config.darkColor)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('border_color')
            .setLabel('border color')
            .setStyle(TextInputStyle.Short)
            .setValue(config.borderColor)
            .setRequired(true)
        )
      )

    await interaction.showModal(modal)
    
    const modalSubmit = await interaction.awaitModalSubmit({ time: 60000 }).catch(() => null)
    if (modalSubmit) {
      const lightColor = modalSubmit.fields.getTextInputValue('light_color')
      const darkColor = modalSubmit.fields.getTextInputValue('dark_color')
      const borderColor = modalSubmit.fields.getTextInputValue('border_color')
      
      const hexRegex = /^#[0-9A-Fa-f]{6}$/
      if (hexRegex.test(lightColor) && hexRegex.test(darkColor) && hexRegex.test(borderColor)) {
        await setUserConfig(userId, { lightColor, darkColor, borderColor })
        await modalSubmit.reply({ content: 'Applied setting.', flags: MessageFlags.Ephemeral })
      } else {
        await modalSubmit.reply({ content: 'Invalid hex colors.', flags: MessageFlags.Ephemeral })
      }
    }
  },

  async showMainConfig(interaction, userId) {
    const config = await getUserConfig(userId)
    
    const embed = new EmbedBuilder()
      .setTitle('Board Configuration')
      .setColor(0x0099ff)
      .setDescription('Configure your chess board appearance')
      .addFields(
        { name: 'Size', value: `${config.size}px`, inline: true },
        { name: 'Piece Set', value: config.pieceSet, inline: true },
        { name: 'Coordinates', value: config.showCoordinates ? 'Enabled' : 'Disabled', inline: true },
        { name: 'Light Squares', value: config.lightColor, inline: true },
        { name: 'Dark Squares', value: config.darkColor, inline: true },
        { name: 'Border', value: config.borderColor, inline: true }
      )

    const components = [
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('config_category')
          .setPlaceholder('Choose what to configure')
          .addOptions([
            { label: 'Colours', value: 'colours', description: 'Board colours' },
            { label: 'Piece Set', value: 'pieces', description: 'Piece style' },
            { label: 'Display Options', value: 'display', description: 'Size, coordinates, etc.' },
            { label: 'Style Options', value: 'style', description: 'Arrows, shadows, borders' }
          ])
      ),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('preview_config')
          .setLabel('Preview')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('reset_config')
          .setLabel('Reset to Defaults')
          .setStyle(ButtonStyle.Danger)
      )
    ]

    await interaction.update({ embeds: [embed], components })
  }
}