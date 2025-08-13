import { database } from './database.js'

export class UserManager {
  constructor() {
    this.pendingAuths = new Map()
    this.init()
  }

  async init() {
    await database.init()
  }

  async getProfile(userId) {
    const profile = await database.getProfile(userId)
    return {
      lichess: profile.lichess_username ? {
        username: profile.lichess_username,
        token: profile.lichess_token,
        hasToken: !!profile.lichess_token
      } : null,
      chesscom: profile.chesscom_username ? {
        username: profile.chesscom_username
      } : null,
      echolyn: {
        rating: profile.echolyn_rating,
        games: profile.echolyn_games,
        wins: profile.echolyn_wins,
        losses: profile.echolyn_losses,
        draws: profile.echolyn_draws
      }
    }
  }

  async setLichess(userId, username, token = null) {
    await database.setLichess(userId, username, token)
  }

  async setChessCom(userId, username) {
    await database.setChessCom(userId, username)
  }

  async updateEcholyn(userId, gameResult, opponent = 'Unknown', pgn = null) {
    return await database.updateEcholyn(userId, gameResult, opponent, pgn)
  }

  async getGameHistory(userId, limit = 10) {
    return await database.getGameHistory(userId, limit)
  }

  async getLeaderboard(limit = 10) {
    return await database.getLeaderboard(limit)
  }

  storePendingAuth(state, data) {
    this.pendingAuths.set(state, { ...data, timestamp: Date.now() })
    setTimeout(() => this.pendingAuths.delete(state), 10 * 60 * 1000)
  }

  getPendingAuth(state) {
    const auth = this.pendingAuths.get(state)
    if (auth) {
      this.pendingAuths.delete(state)
      return auth
    }
    return null
  }

  async updateLichessToken(userId, token) {
    const profile = await database.getProfile(userId)
    if (profile.lichess_username) {
      await database.setLichess(userId, profile.lichess_username, token)
      return true
    }
    return false
  }
}

export const userManager = new UserManager()