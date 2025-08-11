import { Chess } from 'chess.js'
import { analyzePosition } from '../stockfish.js'

export class ChessGame {
  constructor(channelId, players, options = {}) {
    this.id = `${channelId}-${Date.now()}`
    this.channelId = channelId
    this.chess = new Chess()
    this.players = players
    this.currentPlayerIndex = 0
    this.gameType = options.type || 'pvp'
    this.difficulty = options.difficulty || 1000
    this.messageId = null
    this.lastMoveTime = Date.now()
    this.flip = false
  }

  getCurrentPlayer() {
    return this.players[this.currentPlayerIndex]
  }

  isPlayerTurn(userId) {
    return this.getCurrentPlayer() === userId
  }

  isInGame(userId) {
    return this.players.includes(userId)
  }

  getPlayerName(index) {
    const player = this.players[index]
    if (player === 'stockfish') return 'Stockfish'
    if (player === 'random') return 'Random Bot'
    return `Player ${index + 1}`
  }

  getPlayerMention(index) {
    const player = this.players[index]
    if (player === 'stockfish') return 'Stockfish'
    if (player === 'random') return 'Random Bot'
    return `<@${player}>`
  }

  async makeMove(move) {
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

  async makeEngineMove() {
    try {
      const analysis = await analyzePosition(this.chess.fen(), { searchTime: 1000 })
      if (analysis.bestMove) {
        try {
          const result = this.chess.move(analysis.bestMove, { sloppy: true })
          if (result) {
            this.currentPlayerIndex = 1 - this.currentPlayerIndex
            return result
          }
        } catch (error) {
          console.error('Engine move invalid:', analysis.bestMove, error)
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
      try {
        const result = this.chess.move(randomMove, { sloppy: true })
        if (result) {
          this.currentPlayerIndex = 1 - this.currentPlayerIndex
          return result
        }
      } catch (error) {
        console.error('Random move failed:', randomMove, error)
      }
    }
  }

  getGameState() {
    return {
      fen: this.chess.fen(),
      pgn: this.chess.pgn(),
      turn: this.chess.turn(),
      isCheck: this.chess.inCheck(),
      isCheckmate: this.chess.isCheckmate(),
      isDraw: this.chess.isDraw(),
      isStalemate: this.chess.isStalemate(),
      gameOver: this.chess.isGameOver()
    }
  }

  resign(userId) {
    if (!this.isInGame(userId)) return false
    this.chess.load('8/8/8/8/8/8/8/8 w - - 0 1')
    return true
  }
}