import { Chess } from 'chess.js'
import { analyzePosition } from '../stockfish/stockfish.js'

export const VARIANTS = {
  standard: 'Standard Chess',
  antichess: 'Antichess (King of the Hill)',
  horde: 'Horde Chess',
  atomic: 'Atomic Chess',
  realtime: 'Real-time Chaos Chess',
  servervs: 'Server vs Player',
  correspondence: 'Correspondence Chess',
  blitz: 'Speed Chess with Reactions'
}

export class VariantChess extends Chess {
  constructor(variant = 'standard', options = {}) {
    super()
    this.variant = variant
    this.options = options
    this.initVariant()
  }

  initVariant() {
    switch (this.variant) {
      case 'horde':
        this.load('rnbqkbnr/pppppppp/8/1PP2PP1/PPPPPPPP/PPPPPPPP/PPPPPPPP/PPPPPPPP w kq - 0 1')
        break
      case 'realtime':
        this.moveQueue = new Map()
        this.processingMoves = false
        this.simultaneousWindow = 3000
        break
      case 'blitz':
        this.reactionMoves = new Map()
        this.moveReactions = new Set()
        break
    }
  }

  move(move, options = {}) {
    switch (this.variant) {
      case 'antichess':
        return this.antichessMove(move, options)
      case 'atomic':
        return this.atomicMove(move, options)
      case 'horde':
        return this.hordeMove(move, options)
      case 'realtime':
        return this.realtimeMove(move, options)
      case 'blitz':
        return this.blitzMove(move, options)
      default:
        return super.move(move, options)
    }
  }

  realtimeMove(move, options) {
    const playerId = options.playerId
    if (!playerId) return null

    this.moveQueue.set(playerId, {
      move,
      timestamp: Date.now(),
      options
    })

    if (!this.processingMoves) {
      this.processingMoves = true
      setTimeout(() => this.processSimultaneousMoves(), this.simultaneousWindow)
    }

    return { queued: true, move, playerId }
  }

  processSimultaneousMoves() {
    this.processingMoves = false
    
    if (this.moveQueue.size === 0) return null

    const moves = Array.from(this.moveQueue.entries())
    this.moveQueue.clear()

    if (moves.length === 1) {
      const [playerId, moveData] = moves[0]
      return super.move(moveData.move, moveData.options)
    }

    const validMoves = moves.filter(([_, data]) => {
      try {
        const testChess = new Chess(this.fen())
        return testChess.move(data.move, { sloppy: true }) !== null
      } catch {
        return false
      }
    })

    if (validMoves.length === 0) return null
    if (validMoves.length === 1) {
      return super.move(validMoves[0][1].move, validMoves[0][1].options)
    }

    const [p1, p1Data] = validMoves[0]
    const [p2, p2Data] = validMoves[1]

    if (this.movesConflict(p1Data.move, p2Data.move)) {
      const earlierMove = p1Data.timestamp <= p2Data.timestamp ? p1Data : p2Data
      return super.move(earlierMove.move, earlierMove.options)
    }

    const firstMove = super.move(p1Data.move, p1Data.options)
    if (firstMove) {
      try {
        const secondMove = super.move(p2Data.move, p2Data.options)
        return { double: true, first: firstMove, second: secondMove }
      } catch {
        return firstMove
      }
    }

    return null
  }

  movesConflict(move1, move2) {
    try {
      const testChess1 = new Chess(this.fen())
      const testChess2 = new Chess(this.fen())
      
      const result1 = testChess1.move(move1, { sloppy: true })
      const result2 = testChess2.move(move2, { sloppy: true })
      
      if (!result1 || !result2) return true
      
      return result1.from === result2.from || 
             result1.to === result2.to || 
             result1.to === result2.from ||
             result1.from === result2.to
    } catch {
      return true
    }
  }

  blitzMove(move, options) {
    const playerId = options.playerId
    const reactionType = options.reactionType
    
    if (reactionType) {
      this.reactionMoves.set(playerId, { move, reaction: reactionType })
      return { reaction: true, move, playerId }
    }

    return super.move(move, options)
  }

  antichessMove(move, options) {
    const legalMoves = this.moves({ verbose: true })
    const captureMoves = legalMoves.filter(m => m.captured)
    
    if (captureMoves.length > 0) {
      const moveObj = legalMoves.find(m => 
        m.san === move || 
        m.from + m.to === move ||
        (move.from && move.to && m.from === move.from && m.to === move.to)
      )
      
      if (moveObj && !moveObj.captured) {
        return null
      }
    }

    const result = super.move(move, options)
    if (result && this.isAntichessGameOver()) {
      this._gameOver = true
    }
    return result
  }

  atomicMove(move, options) {
    const result = super.move(move, options)
    if (result && result.captured) {
      this.handleAtomicExplosion(result.to)
    }
    return result
  }

  hordeMove(move, options) {
    const result = super.move(move, options)
    if (result && this.isHordeGameOver()) {
      this._gameOver = true
    }
    return result
  }

  handleAtomicExplosion(square) {
    const file = square.charCodeAt(0) - 97
    const rank = parseInt(square[1]) - 1
    
    for (let df = -1; df <= 1; df++) {
      for (let dr = -1; dr <= 1; dr++) {
        const newFile = file + df
        const newRank = rank + dr
        
        if (newFile >= 0 && newFile < 8 && newRank >= 0 && newRank < 8) {
          const explosionSquare = String.fromCharCode(97 + newFile) + (newRank + 1)
          const piece = this.get(explosionSquare)
          
          if (piece && piece.type !== 'p') {
            this.remove(explosionSquare)
          }
        }
      }
    }
  }

  isAntichessGameOver() {
    const pieces = []
    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const square = String.fromCharCode(97 + file) + (rank + 1)
        const piece = this.get(square)
        if (piece) pieces.push(piece)
      }
    }

    const whitePieces = pieces.filter(p => p.color === 'w')
    const blackPieces = pieces.filter(p => p.color === 'b')

    return whitePieces.length === 0 || blackPieces.length === 0
  }

  isHordeGameOver() {
    const pieces = []
    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const square = String.fromCharCode(97 + file) + (rank + 1)
        const piece = this.get(square)
        if (piece) pieces.push(piece)
      }
    }

    const whitePawns = pieces.filter(p => p.color === 'w' && p.type === 'p')
    const blackKing = pieces.find(p => p.color === 'b' && p.type === 'k')

    return whitePawns.length === 0 || !blackKing
  }

  isAtomicGameOver() {
    const pieces = []
    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const square = String.fromCharCode(97 + file) + (rank + 1)
        const piece = this.get(square)
        if (piece && piece.type === 'k') pieces.push(piece)
      }
    }
    return pieces.length < 2
  }

  isGameOver() {
    switch (this.variant) {
      case 'antichess':
        return this.isAntichessGameOver() || super.isGameOver()
      case 'horde':
        return this.isHordeGameOver() || super.isGameOver()
      case 'atomic':
        return this.isAtomicGameOver() || super.isGameOver()
      default:
        return super.isGameOver()
    }
  }

  getWinner() {
    switch (this.variant) {
      case 'antichess':
        const pieces = []
        for (let rank = 0; rank < 8; rank++) {
          for (let file = 0; file < 8; file++) {
            const square = String.fromCharCode(97 + file) + (rank + 1)
            const piece = this.get(square)
            if (piece) pieces.push(piece)
          }
        }
        const whitePieces = pieces.filter(p => p.color === 'w')
        const blackPieces = pieces.filter(p => p.color === 'b')
        if (whitePieces.length === 0) return 'black'
        if (blackPieces.length === 0) return 'white'
        return null
      
      case 'horde':
        const allPieces = []
        for (let rank = 0; rank < 8; rank++) {
          for (let file = 0; file < 8; file++) {
            const square = String.fromCharCode(97 + file) + (rank + 1)
            const piece = this.get(square)
            if (piece) allPieces.push(piece)
          }
        }
        const whitePawns = allPieces.filter(p => p.color === 'w' && p.type === 'p')
        const blackKing = allPieces.find(p => p.color === 'b' && p.type === 'k')
        if (whitePawns.length === 0) return 'black'
        if (!blackKing) return 'white'
        return null

      case 'atomic':
        const kings = []
        for (let rank = 0; rank < 8; rank++) {
          for (let file = 0; file < 8; file++) {
            const square = String.fromCharCode(97 + file) + (rank + 1)
            const piece = this.get(square)
            if (piece && piece.type === 'k') kings.push(piece)
          }
        }
        if (kings.length === 1) {
          return kings[0].color === 'w' ? 'white' : 'black'
        }
        return null

      default:
        if (this.isCheckmate()) {
          return this.turn() === 'w' ? 'black' : 'white'
        }
        return null
    }
  }
}

export class VariantGame {
  constructor(channelId, players, options = {}) {
    this.id = `${channelId}-${Date.now()}`
    this.channelId = channelId
    this.variant = options.variant || 'standard'
    this.chess = new VariantChess(this.variant, options)
    this.players = players
    this.currentPlayerIndex = 0
    this.gameType = options.type || 'pvp'
    this.difficulty = options.difficulty || 1000
    this.messageId = null
    this.lastMoveTime = Date.now()
    this.flip = false
    this.guild = options.guild
    this.rated = options.rated !== false
    
    this.initVariantSpecific()
  }

  initVariantSpecific() {
    if (this.variant === 'servervs') {
      this.discussionChannel = null
      this.votingActive = false
      this.votes = new Map()
      this.voteEndTime = null
      this.voteMinutes = 2
    }

    if (this.variant === 'correspondence') {
      this.moveTimeLimit = this.options.moveTimeLimit || 24 * 60 * 60 * 1000
      this.lastMoveWarning = false
    }

    if (this.variant === 'realtime') {
      this.simultaneousEnabled = true
      this.moveBuffer = []
    }

    if (this.variant === 'blitz') {
      this.reactionCollector = null
      this.currentMoveMessage = null
    }
  }

  async makeMove(move, playerId = null, options = {}) {
    if (this.variant === 'realtime') {
      return this.chess.move(move, { playerId, ...options })
    }

    if (this.variant === 'servervs' && this.isServerTurn()) {
      return this.handleServerMove(move, playerId)
    }

    if (this.variant === 'blitz' && options.reactionType) {
      return this.handleBlitzReaction(move, playerId, options)
    }

    try {
      const result = this.chess.move(move, { sloppy: true, ...options })
      if (!result) return null
      
      this.currentPlayerIndex = 1 - this.currentPlayerIndex
      this.lastMoveTime = Date.now()
      
      if (this.gameType === 'vs-engine' && this.getCurrentPlayer() === 'stockfish') {
        await this.makeEngineMove()
      } else if (this.gameType === 'vs-random' && this.getCurrentPlayer() === 'random') {
        this.makeRandomMove()
      }
      
      return result
    } catch (error) {
      return null
    }
  }

  handleBlitzReaction(move, playerId, options) {
    if (options.reactionType === '⚡') {
      return this.chess.move(move, { playerId, priority: true })
    } else if (options.reactionType === '🤔') {
      setTimeout(() => {
        this.chess.move(move, { playerId })
      }, 3000)
      return { delayed: true }
    }
    
    return this.chess.move(move, { playerId })
  }

  isServerTurn() {
    return this.variant === 'servervs' && this.getCurrentPlayer() === 'server'
  }

  async handleServerMove(move, playerId) {
    if (!this.votingActive) {
      this.startMoveVoting()
    }

    this.votes.set(playerId, move)
    
    if (Date.now() >= this.voteEndTime || this.shouldEndVoting()) {
      const winningMove = this.tallyVotes()
      if (winningMove) {
        const result = this.chess.move(winningMove, { sloppy: true })
        if (result) {
          this.currentPlayerIndex = 1 - this.currentPlayerIndex
          this.lastMoveTime = Date.now()
          this.votingActive = false
          this.votes.clear()
          return result
        }
      }
    }
    
    return { voted: true, move, totalVotes: this.votes.size }
  }

  shouldEndVoting() {
    const uniqueVotes = new Set(this.votes.values())
    const majorityThreshold = Math.floor(this.votes.size / 2) + 1
    
    for (const move of uniqueVotes) {
      const voteCount = Array.from(this.votes.values()).filter(v => v === move).length
      if (voteCount >= majorityThreshold && this.votes.size >= 3) {
        return true
      }
    }
    
    return this.votes.size >= 10
  }

  startMoveVoting() {
    this.votingActive = true
    this.voteEndTime = Date.now() + (this.voteMinutes * 60000)
    this.votes.clear()
  }

  tallyVotes() {
    const moveCount = new Map()
    
    for (const move of this.votes.values()) {
      moveCount.set(move, (moveCount.get(move) || 0) + 1)
    }
    
    let winningMove = null
    let maxVotes = 0
    
    for (const [move, votes] of moveCount) {
      if (votes > maxVotes) {
        maxVotes = votes
        winningMove = move
      }
    }
    
    return winningMove
  }

  getCurrentPlayer() {
    if (this.variant === 'servervs') {
      return this.currentPlayerIndex === 0 ? this.players[0] : 'server'
    }
    if (this.variant === 'realtime') {
      return 'both'
    }
    return this.players[this.currentPlayerIndex]
  }

  isPlayerTurn(userId) {
    if (this.variant === 'realtime' || this.variant === 'blitz') {
      return this.players.includes(userId)
    }
    if (this.variant === 'servervs' && this.isServerTurn()) {
      return this.guild?.members?.cache?.has(userId)
    }
    return this.getCurrentPlayer() === userId
  }

  getGameState() {
    const baseState = {
      fen: this.chess.fen(),
      pgn: this.chess.pgn(),
      turn: this.chess.turn(),
      isCheck: this.chess.inCheck(),
      isCheckmate: this.chess.isCheckmate(),
      isDraw: this.chess.isDraw(),
      isStalemate: this.chess.isStalemate(),
      gameOver: this.chess.isGameOver(),
      variant: this.variant
    }

    if (this.variant === 'servervs') {
      baseState.votingActive = this.votingActive
      baseState.votes = Array.from(this.votes.entries())
      baseState.voteEndTime = this.voteEndTime
      baseState.timeRemaining = this.voteEndTime ? Math.max(0, this.voteEndTime - Date.now()) : 0
    }

    if (this.variant === 'correspondence') {
      baseState.timeRemaining = this.moveTimeLimit - (Date.now() - this.lastMoveTime)
      baseState.moveTimeLimit = this.moveTimeLimit
    }

    if (this.variant === 'realtime') {
      baseState.queuedMoves = Array.from(this.chess.moveQueue?.entries() || [])
      baseState.processingMoves = this.chess.processingMoves
    }

    return baseState
  }

  getVariantDescription() {
    switch (this.variant) {
      case 'antichess':
        return 'Capture moves are mandatory. First to lose all pieces wins!'
      case 'horde':
        return 'White: only pawns vs Black: normal pieces. White wins by checkmate, Black by capturing all pawns.'
      case 'atomic':
        return 'Captures cause explosions! Adjacent pieces destroyed (except pawns).'
      case 'realtime':
        return 'Both players move simultaneously! 3-second windows, conflicts resolved by timestamp.'
      case 'servervs':
        return 'The server votes on moves against one player. Democracy vs skill!'
      case 'correspondence':
        return 'Slow chess via DMs. 24 hours per move.'
      case 'blitz':
        return 'React ⚡ for instant moves, 🤔 for 3-second delay!'
      default:
        return 'Standard chess rules.'
    }
  }

  async makeEngineMove() {
    try {
      const analysis = await analyzePosition(this.chess.fen(), { searchTime: 1000 })
      if (analysis.bestMove) {
        const result = this.chess.move(analysis.bestMove, { sloppy: true })
        if (result) {
          this.currentPlayerIndex = 1 - this.currentPlayerIndex
          return result
        }
      }
    } catch (err) {
      console.error('Engine move failed:', err)
    }
    this.makeRandomMove()
  }

  makeRandomMove() {
    const moves = this.chess.moves()
    if (moves.length > 0) {
      const randomMove = moves[Math.floor(Math.random() * moves.length)]
      const result = this.chess.move(randomMove, { sloppy: true })
      if (result) {
        this.currentPlayerIndex = 1 - this.currentPlayerIndex
        return result
      }
    }
  }

  isInGame(userId) {
    if (this.variant === 'servervs') {
      return this.players.includes(userId) || this.guild?.members?.cache?.has(userId)
    }
    return this.players.includes(userId)
  }

  getPlayerName(index) {
    if (this.variant === 'servervs' && index === 1) return 'The Server'
    if (this.variant === 'realtime' && index === 1) return 'Both Players'
    
    const player = this.players[index]
    if (player === 'stockfish') return 'Stockfish'
    if (player === 'random') return 'Random Bot'
    return `Player ${index + 1}`
  }

  getPlayerMention(index) {
    if (this.variant === 'servervs' && index === 1) return 'The Server'
    if (this.variant === 'realtime') return 'Everyone'
    
    const player = this.players[index]
    if (player === 'stockfish') return 'Stockfish'
    if (player === 'random') return 'Random Bot'
    return `<@${player}>`
  }
}