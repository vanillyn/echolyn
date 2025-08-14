import { VariantGame } from './variants.js'

const games = new Map()
const correspondenceGames = new Map()
const serverVsChannels = new Map()

export const GameManager = {
  createGame(channelId, players, options) {
    const game = new VariantGame(channelId, players, options)
    
    if (options.variant === 'correspondence') {
      correspondenceGames.set(game.id, game)
    } else {
      games.set(game.id, game)
    }
    
    if (options.variant === 'servervs' && options.guild) {
      this.createServerVsChannel(game, options.guild)
    }
    
    return game
  },

  async createServerVsChannel(game, guild) {
    try {
      const category = guild.channels.cache.find(c => c.name === 'Chess Games' && c.type === 4)
      
      const discussionChannel = await guild.channels.create({
        name: `chess-discussion-${game.id.slice(-6)}`,
        type: 0,
        parent: category?.id,
        topic: `Discuss moves for the server vs ${game.getPlayerName(0)} chess game`,
        rateLimitPerUser: 3
      })
      
      game.discussionChannel = discussionChannel
      serverVsChannels.set(game.id, discussionChannel.id)
      
      await discussionChannel.send({
        content: `**Server vs Player Discussion**\n\n` +
                `The server is playing against ${game.getPlayerMention(0)}!\n` +
                `When it's the server's turn, discuss and vote on moves here.\n\n`
      })
      
    } catch (error) {
      console.error('Failed to create server vs discussion channel:', error)
    }
  },

  getGame(gameId) {
    return games.get(gameId) || correspondenceGames.get(gameId)
  },

  getGameByChannel(channelId) {
    return Array.from(games.values()).find(g => g.channelId === channelId) ||
           Array.from(correspondenceGames.values()).find(g => g.channelId === channelId)
  },

  getCorrespondenceGame(player1Id, player2Id) {
    return Array.from(correspondenceGames.values()).find(g => 
      (g.players.includes(player1Id) && g.players.includes(player2Id))
    )
  },

  deleteGame(gameId) {
    const game = this.getGame(gameId)
    if (game?.discussionChannel) {
      game.discussionChannel.setName(`archived-${game.discussionChannel.name}`)
      game.discussionChannel.setParent(null)
      serverVsChannels.delete(gameId)
    }
    
    return games.delete(gameId) || correspondenceGames.delete(gameId)
  },

  getPlayerMention(gameId, playerIndex) {
    const game = this.getGame(gameId)
    if (!game || playerIndex < 0 || playerIndex >= game.players.length) return null
    return game.getPlayerMention(playerIndex)
  },

  processRealtimeMove(gameId, playerId, move) {
    const game = this.getGame(gameId)
    if (!game || game.variant !== 'realtime') return null
    
    return game.makeMove(move, playerId)
  },

  submitServerVote(gameId, playerId, move) {
    const game = this.getGame(gameId)
    if (!game || game.variant !== 'servervs') return null
    
    return game.handleServerMove(move, playerId)
  },

  getActiveVotes(gameId) {
    const game = this.getGame(gameId)
    if (!game || game.variant !== 'servervs') return null
    
    return {
      votes: Array.from(game.votes.entries()),
      timeRemaining: game.voteEndTime ? Math.max(0, game.voteEndTime - Date.now()) : 0,
      isActive: game.votingActive
    }
  },

  getCorrespondenceGames() {
    return Array.from(correspondenceGames.values())
  },

  getPlayerCorrespondenceGames(playerId) {
    return Array.from(correspondenceGames.values()).filter(g => g.players.includes(playerId))
  },

  checkCorrespondenceTimeouts() {
    const timeouts = []
    for (const game of correspondenceGames.values()) {
      const timeRemaining = game.moveTimeLimit - (Date.now() - game.lastMoveTime)
      
      if (timeRemaining <= 0) {
        timeouts.push({
          game,
          type: 'timeout',
          currentPlayer: game.getCurrentPlayer()
        })
      } else if (timeRemaining <= 2 * 60 * 60 * 1000 && !game.lastMoveWarning) {
        // 2 hours
        timeouts.push({
          game,
          type: 'warning',
          currentPlayer: game.getCurrentPlayer(),
          timeRemaining
        })
        game.lastMoveWarning = true
      }
    }
    return timeouts
  },

  cleanup() {
    const now = Date.now()
    const staleGames = Array.from(games.entries())
      .filter(([_, game]) => {
        if (game.variant === 'realtime') return now - game.lastMoveTime > 5 * 60 * 1000 // 5 min
        if (game.variant === 'servervs') return now - game.lastMoveTime > 60 * 60 * 1000 // 1 hour
        return now - game.lastMoveTime > 30 * 60 * 1000 // 30 min
      })
    
    staleGames.forEach(([id]) => {
      this.deleteGame(id)
    })
    
    return staleGames.length
  },

  getGamesByVariant(variant) {
    const allGames = [...games.values(), ...correspondenceGames.values()]
    return allGames.filter(g => g.variant === variant)
  },

  getGameStats() {
    const allGames = [...games.values(), ...correspondenceGames.values()]
    const stats = {
      total: allGames.length,
      byVariant: {},
      active: allGames.filter(g => !g.chess.isGameOver()).length,
      finished: allGames.filter(g => g.chess.isGameOver()).length
    }
    
    for (const game of allGames) {
      stats.byVariant[game.variant] = (stats.byVariant[game.variant] || 0) + 1
    }
    
    return stats
  }
}