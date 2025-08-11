import { ChessGame } from './chessGame.js'
const games = new Map()

export const GameManager = {
  createGame(channelId, players, options) {
    const game = new ChessGame(channelId, players, options)
    games.set(game.id, game)
    return game
  },

  getGame(gameId) {
    return games.get(gameId)
  },

  getGameByChannel(channelId) {
    return Array.from(games.values()).find(g => g.channelId === channelId)
  },

  deleteGame(gameId) {
    return games.delete(gameId)
  },

  getPlayerMention(gameId, playerIndex) {
    const game = games.get(gameId)
    if (!game || playerIndex < 0 || playerIndex >= game.players.length) return null
    return `<@${game.players[playerIndex]}>`
  },

  cleanup() {
    const now = Date.now()
    const staleGames = Array.from(games.entries())
      .filter(([_, game]) => now - game.lastMoveTime > 30 * 60 * 1000) // 30 min
    
    staleGames.forEach(([id]) => games.delete(id))
    return staleGames.length
  }
}