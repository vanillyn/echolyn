import {
  SlashCommandBuilder,
  AttachmentBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
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
        return interaction.reply({ content: 'No active game in this channel', flags: MessageFlags.Ephemeral })
      }
      
      if (!game.isInGame(interaction.user.id)) {
        return interaction.reply({ content: 'You are not in this game', flags: MessageFlags.Ephemeral })
      }
      
      game.resign(interaction.user.id)
      GameManager.deleteGame(game.id)
      
      return interaction.reply({ content: `${game.getPlayerName(0)} vs ${game.getPlayerName(1)} - **Game Over** (Resignation)` })
    }

    const existingGame = GameManager.getGameByChannel(interaction.channelId)
    if (existingGame) {
      return interaction.reply({ content: 'A game is already active in this channel', flags: MessageFlags.Ephemeral })
    }

    let players, gameType, difficulty = 1500

    if (subcommand === 'challenge') {
      const opponent = interaction.options.getUser('opponent')
      if (opponent) {
        if (opponent.id === interaction.user.id) {
          return interaction.reply({ content: 'Cannot challenge yourself', flags: MessageFlags.Ephemeral })
        }
        if (opponent.bot) {
          return interaction.reply({ content: 'Cannot challenge bots', flags: MessageFlags.Ephemeral })
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
    const { embed, attachment, components } = await this.buildGameMessage(game, interaction.user.id)
    
    const msg = await interaction.reply({
      embeds: [embed],
      files: [attachment],
      components
    })
    
    game.messageId = msg.id
    this.setupGameCollector(msg, game)
  },

  async buildGameMessage(game, requestUserId = null) {
    const state = game.getGameState()
    
    const currentPlayerId = game.getCurrentPlayer()
    const configUserId = (typeof currentPlayerId === 'string' && !['stockfish', 'random'].includes(currentPlayerId)) 
      ? currentPlayerId 
      : requestUserId

    const buffer = await drawBoard(state.fen, {
      flip: game.currentPlayerIndex === 1,
      players: {
        white: game.getPlayerName(0),
        black: game.getPlayerName(1)
      },
      clocks: game.clocks || {},
      eval: game.lastEvaluation,
      bestMove: game.lastBestMove,
      checkSquare: state.isCheck ? this.getCheckSquare(game.chess) : null,
      watermark: 'echolyn'
    }, configUserId)
    
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

  getCheckSquare(chess) {
    if (!chess.inCheck()) return null
    
    const turn = chess.turn()
    const board = chess.board()
    
    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const square = board[rank][file]
        if (square && square.type === 'k' && square.color === turn) {
          return { rank, file }
        }
      }
    }
    
    return null
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
      desc += `${state.isCheck ? 'Check! ' : ''}**${turnColor} to move**\n`
      desc += `Current player: ${currentPlayer}`
      
      if (game.lastEvaluation !== undefined) {
        const sfeval = game.lastEvaluation
        const evalText = Math.abs(sfeval) >= 100 
          ? `M${Math.abs(sfeval) - 100}` 
          : (sfeval >= 0 ? '+' : '') + sfeval.toFixed(2)
        desc += `\nEvaluation: ${evalText}`
      }
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
          return i.reply({ content: 'You cannot play against yourself', flags: MessageFlags.Ephemeral })
        }
        game.players.push(i.user.id)
        await this.updateGameMessage(i, game, i.user.id)
        return
      }

      if (i.customId === 'make_move') {
        if (!game.isPlayerTurn(i.user.id)) {
          return i.reply({ content: 'Not your turn!', flags: MessageFlags.Ephemeral })
        }
        await this.showMoveModal(i, game)
        return
      }

      if (i.customId === 'flip_board') {
        game.flip = !game.flip
        await this.updateGameMessage(i, game, i.user.id)
        return
      }

      if (i.customId === 'resign') {
        if (!game.isInGame(i.user.id)) {
          return i.reply({ content: 'You are not in this game', flags: MessageFlags.Ephemeral })
        }
        game.resign(i.user.id)
        await this.updateGameMessage(i, game, i.user.id)
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
      return modalSubmit.reply({ content: 'Invalid move! Try again.', flags: MessageFlags.Ephemeral })
    }
    
    await this.updateGameMessage(modalSubmit, game, modalSubmit.user.id)
    
    const state = game.getGameState()
    if (state.gameOver) {
      GameManager.deleteGame(game.id)
    }
  },

  async updateGameMessage(interaction, game, requestUserId) {
    const { embed, attachment, components } = await this.buildGameMessage(game, requestUserId)
    
    await interaction.update({
      embeds: [embed],
      files: [attachment],
      components
    })
  }
}