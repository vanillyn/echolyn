import { Chess } from 'chess.js'
import { analyzePosition } from '../stockfish.js'
import { database } from '../../data/database.js'
import { eloRole } from '../eloRole.js'

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
    this.guild = options.guild
    this.rated = options.rated !== false
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

  async getPlayerTitle(index) {
    const player = this.players[index]
    if (player === 'stockfish' || player === 'random' || !this.guild) return null
    
    try {
      return await eloRole.getUserTitle(this.guild.id, player)
    } catch (error) {
      return null
    }
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

  async finishGame() {
    if (!this.rated || this.gameType !== 'pvp') return null

    const state = this.getGameState()
    const player1Id = this.players[0]
    const player2Id = this.players[1]

    if (typeof player1Id !== 'string' || typeof player2Id !== 'string') return null

    let result = null
    if (state.isCheckmate) {
      result = state.turn === 'w' ? 'loss' : 'win'
    } else if (state.isDraw || state.isStalemate) {
      result = 'draw'
    }

    if (result) {
      const ratingChanges = await database.updateEcholynRating(player1Id, player2Id, result, this.chess.pgn())
      
      if (this.guild) {
        try {
          await eloRole.updateUserRoles(this.guild, player1Id, ratingChanges.player1.newRating)
          await eloRole.updateUserRoles(this.guild, player2Id, ratingChanges.player2.newRating)
        } catch (error) {
          console.error('Error updating roles:', error)
        }
      }

      return ratingChanges
    }

    return null
  }

  resign(userId) {
    if (!this.isInGame(userId)) return false
    
    const resigningPlayerIndex = this.players.indexOf(userId)
    const result = resigningPlayerIndex === 0 ? 'loss' : 'win'
    
    if (this.rated && this.gameType === 'pvp' && typeof this.players[0] === 'string' && typeof this.players[1] === 'string') {
      database.updateEcholynRating(this.players[0], this.players[1], result, this.chess.pgn() + '\n1-0 {Resignation}')
        .then(ratingChanges => {
          if (this.guild && ratingChanges) {
            eloRole.updateUserRoles(this.guild, this.players[0], ratingChanges.player1.newRating)
            eloRole.updateUserRoles(this.guild, this.players[1], ratingChanges.player2.newRating)
          }
        })
        .catch(console.error)
    }
    
    this.chess.load('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')
    return true
  }
}