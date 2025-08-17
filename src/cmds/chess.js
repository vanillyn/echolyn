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
  MessageFlags
} from 'discord.js'
import { GameManager } from '../utils/game/gameManager.js'
import { drawBoard } from '../utils/drawBoard.js'
import { VARIANTS } from '../utils/game/variants.js'

export default {
  data: new SlashCommandBuilder()
    .setName('chess')
    .setDescription('play chess')
    .addSubcommand(sub =>
      sub.setName('challenge')
        .setDescription('Challenge another player')
        .addUserOption(opt => opt.setName('opponent').setDescription('Player to challenge').setRequired(false))
        .addStringOption(opt => 
          opt.setName('variant')
            .setDescription('Chess variant to play')
            .addChoices(
              { name: 'Standard', value: 'standard' },
              { name: 'Antichess', value: 'antichess' },
              { name: 'Horde', value: 'horde' },
              { name: 'Atomic', value: 'atomic' },
              { name: 'Real-time Chaos', value: 'realtime' },
              { name: 'Speed Chess', value: 'blitz' }
            )
        )
    )
    .addSubcommand(sub =>
      sub.setName('servervs')
        .setDescription('Server vs one player')
        .addUserOption(opt => opt.setName('target').setDescription('Player the server will face').setRequired(true))
        .addStringOption(opt => 
          opt.setName('variant')
            .setDescription('Chess variant')
            .addChoices(
              { name: 'Standard', value: 'standard' },
              { name: 'Antichess', value: 'antichess' },
              { name: 'Horde', value: 'horde' },
              { name: 'Atomic', value: 'atomic' }
            )
        )
    )
    .addSubcommand(sub =>
      sub.setName('engine')
        .setDescription('Play against Stockfish')
        .addIntegerOption(opt => opt.setName('difficulty').setDescription('Engine strength (800-2800)').setMinValue(800).setMaxValue(2800))
        .addStringOption(opt => 
          opt.setName('variant')
            .setDescription('Chess variant')
            .addChoices(
              { name: 'Standard', value: 'standard' },
              { name: 'Antichess', value: 'antichess' },
              { name: 'Horde', value: 'horde' },
              { name: 'Atomic', value: 'atomic' }
            )
        )
    )
    .addSubcommand(sub =>
      sub.setName('random')
        .setDescription('Play against random bot')
        .addStringOption(opt => 
          opt.setName('variant')
            .setDescription('Chess variant')
            .addChoices(
              { name: 'Standard', value: 'standard' },
              { name: 'Antichess', value: 'antichess' },
              { name: 'Horde', value: 'horde' },
              { name: 'Atomic', value: 'atomic' }
            )
        )
    )
    .addSubcommand(sub =>
      sub.setName('correspondence')
        .setDescription('Start correspondence chess via DM')
        .addUserOption(opt => opt.setName('opponent').setDescription('Player to play against').setRequired(true))
        .addIntegerOption(opt => opt.setName('hours').setDescription('Hours per move (1-72)').setMinValue(1).setMaxValue(72))
    )
    .addSubcommand(sub =>
      sub.setName('resign')
        .setDescription('Resign current game')
    )
    .addSubcommand(sub =>
      sub.setName('vote')
        .setDescription('Vote for a move (server vs player games)')
        .addStringOption(opt => opt.setName('move').setDescription('Your move vote (e.g. e4, Nf3)').setRequired(true))
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand()
    
    if (subcommand === 'resign') {
      return this.handleResign(interaction)
    }

    if (subcommand === 'vote') {
      return this.handleVote(interaction)
    }

    const existingGame = GameManager.getGameByChannel(interaction.channelId)
    if (existingGame && !['correspondence'].includes(subcommand)) {
      return interaction.reply({ content: 'A game is already active in this channel', flags: MessageFlags.Ephemeral })
    }

    switch (subcommand) {
      case 'challenge':
        return this.handleChallenge(interaction)
      case 'servervs':
        return this.handleServerVs(interaction)
      case 'engine':
        return this.handleEngine(interaction)
      case 'random':
        return this.handleRandom(interaction)
      case 'correspondence':
        return this.handleCorrespondence(interaction)
    }
  },

  async handleChallenge(interaction) {
    const opponent = interaction.options.getUser('opponent')
    const variant = interaction.options.getString('variant') || 'standard'

    if (opponent) {
      if (opponent.id === interaction.user.id) {
        return interaction.reply({ content: 'Cannot challenge yourself', flags: MessageFlags.Ephemeral })
      }
      if (opponent.bot) {
        return interaction.reply({ content: 'Cannot challenge bots', flags: MessageFlags.Ephemeral })
      }

      const players = [interaction.user.id, opponent.id]
      await this.startGame(interaction, players, { type: 'pvp', variant, guild: interaction.guild })
    } else {
      const embed = new EmbedBuilder()
        .setTitle(`${VARIANTS[variant]} Challenge`)
        .setDescription(`${interaction.user} is looking for an opponent!\n\n**Variant:** ${VARIANTS[variant]}\n${this.getVariantDescription(variant)}`)
        .setColor(0x00ff00)

      return interaction.reply({
        embeds: [embed],
        components: [new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`join_${variant}`).setLabel('Accept Challenge').setStyle(ButtonStyle.Primary)
        )]
      })
    }
  },

  async handleServerVs(interaction) {
    const target = interaction.options.getUser('target')
    const variant = interaction.options.getString('variant') || 'standard'

    if (target.bot) {
      return interaction.reply({ content: 'Cannot play server vs bot', flags: MessageFlags.Ephemeral })
    }

    const players = [target.id, 'server']
    await this.startGame(interaction, players, { 
      type: 'servervs', 
      variant: 'servervs',
      baseVariant: variant,
      guild: interaction.guild 
    })
  },

  async handleEngine(interaction) {
    const difficulty = interaction.options.getInteger('difficulty') || 1500
    const variant = interaction.options.getString('variant') || 'standard'

    const players = [interaction.user.id, 'stockfish']
    await this.startGame(interaction, players, { type: 'vs-engine', variant, difficulty, guild: interaction.guild })
  },

  async handleRandom(interaction) {
    const variant = interaction.options.getString('variant') || 'standard'
    const players = [interaction.user.id, 'random']
    await this.startGame(interaction, players, { type: 'vs-random', variant, guild: interaction.guild })
  },

  async handleCorrespondence(interaction) {
    const opponent = interaction.options.getUser('opponent')
    const hours = interaction.options.getInteger('hours') || 24

    if (opponent.id === interaction.user.id) {
      return interaction.reply({ content: 'Cannot play correspondence with yourself', flags: MessageFlags.Ephemeral })
    }

    const existingGame = GameManager.getCorrespondenceGame(interaction.user.id, opponent.id)
    if (existingGame) {
      return interaction.reply({ content: 'You already have a correspondence game with this player', flags: MessageFlags.Ephemeral })
    }

    const players = [interaction.user.id, opponent.id]
    const game = GameManager.createGame(interaction.channelId, players, {
      variant: 'correspondence',
      moveTimeLimit: hours * 60 * 60 * 1000,
      guild: interaction.guild
    })

    try {
      await opponent.send({
        embeds: [new EmbedBuilder()
          .setTitle('Correspondence Chess Game Started')
          .setDescription(`${interaction.user} has started a correspondence game with you!\n\n**Time per move:** ${hours} hours\n\nUse \`/chess move\` to make moves.`)
          .setColor(0x00ff00)
        ]
      })

      await interaction.user.send({
        embeds: [new EmbedBuilder()
          .setTitle('Correspondence Chess Game Started')
          .setDescription(`Game started with ${opponent}!\n\n**Time per move:** ${hours} hours\n\nYou are White. Use \`/chess move\` to make your first move.`)
          .setColor(0x00ff00)
        ]
      })
    } catch (error) {
      GameManager.deleteGame(game.id)
      return interaction.reply({ content: 'Failed to start correspondence game. Make sure both players allow DMs.', flags: MessageFlags.Ephemeral })
    }

    return interaction.reply({ content: `Correspondence game started with ${opponent}! Check your DMs.`, flags: MessageFlags.Ephemeral })
  },

  async handleResign(interaction) {
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
  },

  async handleVote(interaction) {
    const move = interaction.options.getString('move')
    const game = GameManager.getGameByChannel(interaction.channelId)
    
    if (!game || game.variant !== 'servervs') {
      return interaction.reply({ content: 'No server vs player game active in this channel', flags: MessageFlags.Ephemeral })
    }

    if (!game.isServerTurn()) {
      return interaction.reply({ content: 'Not the server\'s turn to move', flags: MessageFlags.Ephemeral })
    }

    const result = await game.makeMove(move, interaction.user.id)
    
    if (result && result.voted) {
      const votes = game.getGameState().votes
      const voteList = votes.map(([userId, userMove]) => `<@${userId}>: ${userMove}`).join('\n')
      
      return interaction.reply({
        content: `Vote recorded: **${move}**\n\n**Current votes (${votes.length}):**\n${voteList}`,
        flags: MessageFlags.Ephemeral
      })
    } else if (result) {
      await this.updateGameMessage(interaction, game, interaction.user.id)
      return
    } else {
      return interaction.reply({ content: 'Invalid move!', flags: MessageFlags.Ephemeral })
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
    const configUserId = (typeof currentPlayerId === 'string' && !['stockfish', 'random', 'server', 'both'].includes(currentPlayerId)) 
      ? currentPlayerId 
      : requestUserId

    const buffer = await drawBoard(state.fen, {
      flip: game.currentPlayerIndex === 1 && game.variant !== 'realtime',
      players: {
        white: game.getPlayerName(0),
        black: game.getPlayerName(1)
      },
      clocks: game.clocks || {},
      eval: game.lastEvaluation,
      bestMove: game.lastBestMove,
      checkSquare: state.isCheck ? this.getCheckSquare(game.chess) : null,
      watermark: `echolyn • ${game.variant}`
    }, configUserId)
    
    const attachment = new AttachmentBuilder(buffer, { name: 'board.png' })
    
    const embed = new EmbedBuilder()
      .setTitle(`${VARIANTS[game.variant] || game.variant}: ${game.getPlayerName(0)} vs ${game.getPlayerName(1)}`)
      .setColor(state.gameOver ? 0xff0000 : this.getVariantColor(game.variant))
      .setImage('attachment://board.png')
      .setDescription(this.getGameDescription(game, state))
    
    const components = state.gameOver ? [] : this.getGameComponents(game, state)
    
    return { embed, attachment, components }
  },

  getVariantColor(variant) {
    const colors = {
      standard: 0x00ff00,
      antichess: 0xff4444,
      horde: 0xffaa00,
      atomic: 0xff0000,
      realtime: 0x00ffff,
      servervs: 0x8844ff,
      correspondence: 0x4444ff,
      blitz: 0xffff00
    }
    return colors[variant] || 0x00ff00
  },

  getVariantDescription(variant) {
    const game = { variant }
    return game.getVariantDescription?.() || {
      standard: 'Standard chess rules',
      antichess: 'Capture moves mandatory. First to lose all pieces wins!',
      horde: 'White pawns vs Black pieces',
      atomic: 'Captures cause explosions!',
      realtime: 'Simultaneous moves!',
      servervs: 'Server democracy vs one player',
      correspondence: 'Slow chess via DMs',
      blitz: 'React for move speed!'
    }[variant] || ''
  },

  getGameComponents(game, state) {
    const components = []

    if (game.variant === 'realtime') {
      components.push(new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('realtime_move').setLabel('Queue Move').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('flip_board').setLabel('Flip Board').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('resign').setLabel('Resign').setStyle(ButtonStyle.Danger)
      ))
    } else if (game.variant === 'servervs' && game.isServerTurn()) {
      const timeLeft = Math.ceil((state.voteEndTime - Date.now()) / 1000)
      components.push(new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('vote_move')
          .setLabel(`Vote for Move (${timeLeft}s left)`)
          .setStyle(ButtonStyle.Primary)
          .setDisabled(timeLeft <= 0),
        new ButtonBuilder().setCustomId('show_votes').setLabel('Show Votes').setStyle(ButtonStyle.Secondary)
      ))
    } else if (game.variant === 'blitz') {
      components.push(new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('blitz_instant').setLabel('⚡ Instant').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('blitz_think').setLabel('🤔 Think').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('blitz_normal').setLabel('Normal').setStyle(ButtonStyle.Secondary)
      ))
    } else {
      components.push(new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('make_move').setLabel('Make Move').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('flip_board').setLabel('Flip Board').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('resign').setLabel('Resign').setStyle(ButtonStyle.Danger)
      ))
    }

    return components
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
    
    if (state.variant && state.variant !== 'standard') {
      desc += `**${VARIANTS[state.variant]}**\n${this.getVariantDescription(state.variant)}\n\n`
    }
    
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
      if (game.variant === 'realtime') {
        desc += `**Both players can move!** Queue moves simultaneously.\n`
        if (state.queuedMoves?.length > 0) {
          desc += `Queued moves: ${state.queuedMoves.length}\n`
        }
      } else if (game.variant === 'servervs' && game.isServerTurn()) {
        desc += `**Server's turn!** Everyone vote for a move.\n`
        if (state.votes?.length > 0) {
          desc += `Current votes: ${state.votes.length}\n`
        }
        if (state.timeRemaining) {
          desc += `Time left: ${Math.ceil(state.timeRemaining / 1000)}s\n`
        }
      } else {
        const currentPlayer = game.getPlayerMention(game.currentPlayerIndex)
        const turnColor = state.turn === 'w' ? 'White' : 'Black'
        desc += `${state.isCheck ? 'Check! ' : ''}**${turnColor} to move**\n`
        desc += `Current player: ${currentPlayer}\n`
      }
      
      if (game.lastEvaluation !== undefined) {
        const sfeval = game.lastEvaluation
        const evalText = Math.abs(sfeval) >= 100 
          ? `M${Math.abs(sfeval) - 100}` 
          : (sfeval >= 0 ? '+' : '') + sfeval.toFixed(2)
        desc += `Evaluation: ${evalText}\n`
      }
    }
    
    return desc
  },

  setupGameCollector(message, game) {
    const collector = message.createMessageComponentCollector({ 
      time: game.variant === 'correspondence' ? 7 * 24 * 60 * 60 * 1000 : 30 * 60 * 1000
    })

    collector.on('collect', async i => {
      if (i.customId.startsWith('join_')) {
        const variant = i.customId.split('_')[1]
        if (game.players.length === 1) {
          if (i.user.id === game.players[0]) {
            return i.reply({ content: 'You cannot play against yourself', flags: MessageFlags.Ephemeral })
          }
          game.players.push(i.user.id)
          game.variant = variant
          await this.updateGameMessage(i, game, i.user.id)
          return
        }
      }

      if (i.customId === 'make_move' || i.customId === 'realtime_move' || i.customId === 'vote_move') {
        if (!game.isPlayerTurn(i.user.id)) {
          return i.reply({ content: 'Not your turn!', flags: MessageFlags.Ephemeral })
        }
        await this.showMoveModal(i, game)
        return
      }

      if (i.customId.startsWith('blitz_')) {
        const reactionType = i.customId === 'blitz_instant' ? '⚡' : i.customId === 'blitz_think' ? '🤔' : null
        await this.showMoveModal(i, game, { reactionType })
        return
      }

      if (i.customId === 'flip_board') {
        game.flip = !game.flip
        await this.updateGameMessage(i, game, i.user.id)
        return
      }

      if (i.customId === 'show_votes') {
        const state = game.getGameState()
        const voteText = state.votes.length > 0 
          ? state.votes.map(([userId, move]) => `<@${userId}>: ${move}`).join('\n')
          : 'No votes yet'
        return i.reply({ content: `**Current votes:**\n${voteText}`, flags: MessageFlags.Ephemeral })
      }

      if (i.customId === 'resign') {
        if (!game.isInGame(i.user.id)) {
          return i.reply({ content: 'You are not in this game', flags: MessageFlags.Ephemeral })
        }
        if (typeof game.resign === 'function') {
          game.resign(i.user.id)
        } else if (typeof game.handleResign === 'function') {
          game.handleResign(i.user.id)
        } else {
          game.gameOver = true
          game.resignedPlayer = i.user.id
        }
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

  async showMoveModal(interaction, game, options = {}) {
    const isVote = game.variant === 'servervs' && game.isServerTurn()
    const isRealtime = game.variant === 'realtime'
    const isBlitz = game.variant === 'blitz'

    const modal = new ModalBuilder()
      .setCustomId(`move_${game.id}`)
      .setTitle(isVote ? 'Vote for Move' : isRealtime ? 'Queue Move' : 'Make Your Move')
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('move')
            .setLabel('Enter move (e.g., e4, Nf3, O-O)')
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
    const moveResult = await game.makeMove(moveInput, modalSubmit.user.id, options)
    
    if (!moveResult) {
      return modalSubmit.reply({ content: 'Invalid move! Try again.', flags: MessageFlags.Ephemeral })
    }

    if (moveResult.voted) {
      return modalSubmit.reply({ 
        content: `Vote recorded: **${moveInput}**`, 
        flags: MessageFlags.Ephemeral 
      })
    }

    if (moveResult.queued) {
      return modalSubmit.reply({ 
        content: `Move queued: **${moveInput}**`, 
        flags: MessageFlags.Ephemeral 
      })
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