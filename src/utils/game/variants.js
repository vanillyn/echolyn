import { Chess } from 'chess.js'
import { analyzePosition } from '../stockfish.js'

export const VARIANTS = {
  standard: 'Standard Chess',
  antichess: 'Antichess (King of the Hill)',
  horde: 'Horde Chess',
  atomic: 'Atomic Chess',
  realtime: 'Real-time Chess',
  servervs: 'Server vs Player',
  correspondence: 'Correspondence Chess'
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
      case 'antichess':
        break
      case 'atomic':
        break
      case 'realtime':
        this.pendingMoves = new Map()
        this.moveBuffer = []
        this.lastProcessTime = Date.now()
        break
      default:
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
      default:
        return super.move(move, options)
    }
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

  realtimeMove(move, options) {
    const playerId = options.playerId
    if (!playerId) return null

    this.pendingMoves.set(playerId, {
      move,
      timestamp: Date.now(),
      options
    })

    return this.processRealtimeMoves()
  }

  processRealtimeMoves() {
    const now = Date.now()
    const moves = Array.from(this.pendingMoves.entries())
    
    if (moves.length < 2) return null

    const [player1Move, player2Move] = moves
    const [p1Id, p1Data] = player1Move
    const [p2Id, p2Data] = player2Move

    const timeDiff = Math.abs(p1Data.timestamp - p2Data.timestamp)
    if (timeDiff > 2000) {
      const earlierMove = p1Data.timestamp < p2Data.timestamp ? p1Data : p2Data
      const laterPlayerId = p1Data.timestamp < p2Data.timestamp ? p2Id : p1Id
      
      const result = super.move(earlierMove.move, earlierMove.options)
      this.pendingMoves.delete(laterPlayerId)
      this.pendingMoves.clear()
      return result
    }

    const p1Legal = this.isMoveLegal(p1Data.move)
    const p2Legal = this.isMoveLegal(p2Data.move)

    if (p1Legal && p2Legal) {
      const conflictResult = this.resolveRealtimeConflict(p1Data, p2Data)
      this.pendingMoves.clear()
      return conflictResult
    } else if (p1Legal) {
      const result = super.move(p1Data.move, p1Data.options)
      this.pendingMoves.clear()
      return result
    } else if (p2Legal) {
      const result = super.move(p2Data.move, p2Data.options)
      this.pendingMoves.clear()
      return result
    }

    this.pendingMoves.clear()
    return null
  }

  isMoveLegal(move) {
    try {
      const tempChess = new Chess(this.fen())
      return tempChess.move(move, { sloppy: true }) !== null
    } catch {
      return false
    }
  }

  resolveRealtimeConflict(move1, move2) {
    if (move1.timestamp < move2.timestamp) {
      return super.move(move1.move, move1.options)
    } else if (move2.timestamp < move1.timestamp) {
      return super.move(move2.move, move2.options)
    } else {
      return Math.random() < 0.5 
        ? super.move(move1.move, move1.options)
        : super.move(move2.move, move2.options)
    }
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
    
    if (this.variant === 'servervs') {
      this.discussionChannel = null
      this.votingActive = false
      this.votes = new Map()
      this.voteEndTime = null
    }
    

    if (this.variant === 'correspondence') {
      this.moveTimeLimit = options.moveTimeLimit || 24 * 60 * 60 * 1000 // 24 hours
      this.lastMoveWarning = false
    }
  }

  async makeMove(move, playerId = null) {
    if (this.variant === 'realtime') {
      return this.chess.move(move, { sloppy: true, playerId })
    }

    if (this.variant === 'servervs' && this.isServerTurn()) {
      return this.handleServerMove(move, playerId)
    }

    try {
      const result = this.chess.move(move, { sloppy: true })
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

  isServerTurn() {
    return this.variant === 'servervs' && this.getCurrentPlayer() === 'server'
  }

  async handleServerMove(move, playerId) {
    if (!this.votingActive) {
      this.startMoveVoting()
      return null
    }

    this.votes.set(playerId, move)
    
    if (Date.now() >= this.voteEndTime || this.votes.size >= 5) {
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
    
    return null
  }

  startMoveVoting() {
    this.votingActive = true
    this.voteEndTime = Date.now() + 60000 // 1 minute
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
    return this.players[this.currentPlayerIndex]
  }

  isPlayerTurn(userId) {
    if (this.variant === 'realtime') {
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
    }

    if (this.variant === 'correspondence') {
      baseState.timeRemaining = this.moveTimeLimit - (Date.now() - this.lastMoveTime)
      baseState.moveTimeLimit = this.moveTimeLimit
    }

    if (this.variant === 'realtime') {
      baseState.pendingMoves = Array.from(this.chess.pendingMoves?.entries() || [])
    }

    return baseState
  }

  getVariantDescription() {
    switch (this.variant) {
      case 'antichess':
        return 'Capture moves are mandatory. First to lose all pieces or stalemate wins!'
      case 'horde':
        return 'White has only pawns, Black has normal pieces. White wins by checkmating Black king, Black wins by capturing all white pawns.'
      case 'atomic':
        return 'Captures cause explosions! Pieces adjacent to captures are destroyed (except pawns).'
      case 'realtime':
        return 'Both players can move simultaneously! Conflicts resolved by timestamp.'
      case 'servervs':
        return 'The entire server collaborates on moves against a single opponent.'
      case 'correspondence':
        return 'Slow-paced chess via DMs.'
      default:
        return 'Standard chess rules apply.'
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
    
    const player = this.players[index]
    if (player === 'stockfish') return 'Stockfish'
    if (player === 'random') return 'Random Bot'
    return `Player ${index + 1}`
  }

  getPlayerMention(index) {
    if (this.variant === 'servervs' && index === 1) return 'The Server'
    
    const player = this.players[index]
    if (player === 'stockfish') return 'Stockfish'
    if (player === 'random') return 'Random Bot'
    return `<@${player}>`
  }
}