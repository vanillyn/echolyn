import {
  SlashCommandBuilder,
  AttachmentBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} from 'discord.js'
import { GameManager } from '../utils/game/gameManager.js'
import { drawBoard } from '../utils/drawBoard.js'

export default {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('start a chess game')
    .addSubcommand(sub =>
      sub.setName('challenge')
        .setDescription('challenge another player')
        .addUserOption(opt => opt.setName('opponent').setDescription('player to challenge').setRequired(false))
    )
    .addSubcommand(sub =>
      sub.setName('engine')
        .setDescription('play against stockfish')
        .addIntegerOption(opt => opt.setName('difficulty').setDescription('engine strength (800-2800)').setMinValue(800).setMaxValue(2800))
    )
    .addSubcommand(sub =>
      sub.setName('random')
        .setDescription('play against random bot')
    )
    .addSubcommand(sub =>
      sub.setName('resign')
        .setDescription('resign current game')
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand()
    
    if (subcommand === 'resign') {
      const game = GameManager.getGameByChannel(interaction.channelId)
      if (!game) {
        return interaction.reply({ content: 'No active game in this channel', ephemeral: true })
      }
      
      if (!game.isInGame(interaction.user.id)) {
        return interaction.reply({ content: 'You are not in this game', ephemeral: true })
      }
      
      game.resign(interaction.user.id)
      GameManager.deleteGame(game.id)
      
      return interaction.reply({ content: `${game.getPlayerName(0)} vs ${game.getPlayerName(1)} - **Game Over** (Resignation)` })
    }

    const existingGame = GameManager.getGameByChannel(interaction.channelId)
    if (existingGame) {
      return interaction.reply({ content: 'A game is already active in this channel', ephemeral: true })
    }

    let players, gameType, difficulty = 1500

    if (subcommand === 'play') {
      const opponent = interaction.options.getUser('opponent')
      if (opponent) {
        if (opponent.id === interaction.user.id) {
          return interaction.reply({ content: 'Cannot challenge yourself', ephemeral: true })
        }
        if (opponent.bot) {
          return interaction.reply({ content: 'Cannot challenge bots', ephemeral: true })
        }
        players = [interaction.user.id, opponent.id]
        gameType = 'pvp'
      } else {
        return interaction.reply({ 
          content: 'Waiting for opponent... First person to react joins!',
          components: [new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('join_game').setLabel('Join Game').setStyle(ButtonStyle.Primary)
          )]
        })
      }
    } else if (subcommand === 'engine') {
      difficulty = interaction.options.getInteger('difficulty') || 1500
      players = [interaction.user.id, 'stockfish']
      gameType = 'vs-engine'
    } else if (subcommand === 'random') {
      players = [interaction.user.id, 'random']
      gameType = 'vs-random'
    }

    if (players) {
      await this.startGame(interaction, players, { type: gameType, difficulty })
    }
  },

  async startGame(interaction, players, options) {
    const game = GameManager.createGame(interaction.channelId, players, options)
    const { embed, attachment, components } = await this.buildGameMessage(game)
    
    const msg = await interaction.reply({
      embeds: [embed],
      files: [attachment],
      components
    })
    
    game.messageId = msg.id
    this.setupGameCollector(msg, game)
  },

  async buildGameMessage(game) {
    const state = game.getGameState()
    const buffer = await drawBoard(state.fen, {
      flip: game.currentPlayerIndex === 1,
      players: {
        white: game.getPlayerName(0),
        black: game.getPlayerName(1)
      },
      watermark: 'echolyn'
    })
    
    const attachment = new AttachmentBuilder(buffer, { name: 'board.png' })
    
    const embed = new EmbedBuilder()
      .setTitle(`Chess Game: ${game.getPlayerName(0)} vs ${game.getPlayerName(1)}`)
      .setColor(state.gameOver ? 0xff0000 : 0x00ff00)
      .setImage('attachment://board.png')
      .setDescription(this.getGameDescription(game, state))
    
    const components = state.gameOver ? [] : [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('make_move').setLabel('Make Move').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('flip_board').setLabel('Flip Board').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('resign').setLabel('Resign').setStyle(ButtonStyle.Danger)
      )
    ]
    
    return { embed, attachment, components }
  },

  getGameDescription(game, state) {
    let desc = `${game.getPlayerMention(0)} (White) vs ${game.getPlayerMention(1)} (Black)\n\n`
    
    if (state.gameOver) {
      if (state.isCheckmate) {
        const winner = state.turn === 'w' ? 'Black' : 'White'
        desc += `**${winner} wins by checkmate!**`
      } else if (state.isDraw) {
        desc += `**Draw**`
      } else if (state.isStalemate) {
        desc += `**Stalemate**`
      }
    } else {
      const currentPlayer = game.getPlayerMention(game.currentPlayerIndex)
      const turnColor = state.turn === 'w' ? 'White' : 'Black'
      desc += `${state.isCheck ? 'Check. ' : ''}**${turnColor} to move**\n`
      desc += `Current player: ${currentPlayer}`
    }
    
    return desc
  },

  setupGameCollector(message, game) {
    const collector = message.createMessageComponentCollector({ 
      time: 30 * 60 * 1000 // 30 minutes
    })

    collector.on('collect', async i => {
      if (i.customId === 'join_game' && game.players.length === 1) {
        if (i.user.id === game.players[0]) {
          return i.reply({ content: 'You cannot play against yourself', ephemeral: true })
        }
        game.players.push(i.user.id)
        await this.updateGameMessage(i, game)
        return
      }

      if (i.customId === 'make_move') {
        if (!game.isPlayerTurn(i.user.id)) {
          return i.reply({ content: 'Not your turn!', ephemeral: true })
        }
        await this.showMoveModal(i, game)
        return
      }

      if (i.customId === 'flip_board') {
        game.flip = !game.flip
        await this.updateGameMessage(i, game)
        return
      }

      if (i.customId === 'resign') {
        if (!game.isInGame(i.user.id)) {
          return i.reply({ content: 'You are not in this game', ephemeral: true })
        }
        game.resign(i.user.id)
        await this.updateGameMessage(i, game)
        GameManager.deleteGame(game.id)
        collector.stop()
        return
      }
    })

    collector.on('end', () => {
      GameManager.deleteGame(game.id)
    })
  },

  async showMoveModal(interaction, game) {
    const modal = new ModalBuilder()
      .setCustomId(`move_${game.id}`)
      .setTitle('Make Your Move')
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('move')
            .setLabel('Enter your move (e.g., e4, Nf3, O-O)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(10)
        )
      )

    await interaction.showModal(modal)
    
    const modalSubmit = await interaction.awaitModalSubmit({ 
      filter: i => i.customId === `move_${game.id}` && i.user.id === interaction.user.id,
      time: 60000 
    }).catch(() => null)
    
    if (!modalSubmit) return
    
    const moveInput = modalSubmit.fields.getTextInputValue('move')
    const moveResult = await game.makeMove(moveInput)
    
    if (!moveResult) {
      return modalSubmit.reply({ content: 'Invalid move! Try again.', ephemeral: true })
    }
    
    await this.updateGameMessage(modalSubmit, game)
    
    const state = game.getGameState()
    if (state.gameOver) {
      GameManager.deleteGame(game.id)
    }
  },

  async updateGameMessage(interaction, game) {
    const { embed, attachment, components } = await this.buildGameMessage(game)
    
    await interaction.update({
      embeds: [embed],
      files: [attachment],
      components
    })
  }
}