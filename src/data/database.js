import sqlite3 from 'sqlite3'
import { open } from 'sqlite'
import { log } from '../init.js'

class Database {
  constructor() {
    this.db = null
  }

  async init() {
    const dbPath = process.env.DATABASE_FILE || './data/database.sqlite'
    
    this.db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    })

    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS user_profiles (
        discord_id TEXT PRIMARY KEY,
        lichess_username TEXT,
        lichess_token TEXT,
        chesscom_username TEXT,
        echolyn_rating INTEGER DEFAULT 1500,
        echolyn_games INTEGER DEFAULT 0,
        echolyn_wins INTEGER DEFAULT 0,
        echolyn_losses INTEGER DEFAULT 0,
        echolyn_draws INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS game_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        discord_id TEXT,
        game_type TEXT,
        result TEXT,
        rating_before INTEGER,
        rating_after INTEGER,
        opponent TEXT,
        pgn TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (discord_id) REFERENCES user_profiles (discord_id)
      );
    `)

    log.info('database initialized')
  }

  async getProfile(discordId) {
    const profile = await this.db.get(
      'SELECT * FROM user_profiles WHERE discord_id = ?',
      [discordId]
    )
    
    if (!profile) {
      await this.db.run(
        'INSERT INTO user_profiles (discord_id) VALUES (?)',
        [discordId]
      )
      return await this.db.get(
        'SELECT * FROM user_profiles WHERE discord_id = ?',
        [discordId]
      )
    }
    
    return profile
  }

  async setLichess(discordId, username, token = null) {
    await this.db.run(`
      UPDATE user_profiles 
      SET lichess_username = ?, lichess_token = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE discord_id = ?
    `, [username, token, discordId])
  }

  async setChessCom(discordId, username) {
    await this.db.run(`
      UPDATE user_profiles 
      SET chesscom_username = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE discord_id = ?
    `, [username, discordId])
  }

  async updateEcholyn(discordId, gameResult, opponent = 'Unknown', pgn = null) {
    const profile = await this.getProfile(discordId)
    const oldRating = profile.echolyn_rating
    
    let newWins = profile.echolyn_wins
    let newLosses = profile.echolyn_losses  
    let newDraws = profile.echolyn_draws
    
    if (gameResult === 'win') newWins++
    else if (gameResult === 'loss') newLosses++
    else if (gameResult === 'draw') newDraws++
    
    const totalGames = profile.echolyn_games + 1
    const expectedScore = 1 / (1 + Math.pow(10, (1500 - oldRating) / 400))
    const k = totalGames < 30 ? 40 : oldRating < 2100 ? 20 : 10
    
    let score = 0
    if (gameResult === 'win') score = 1
    else if (gameResult === 'draw') score = 0.5
    
    const newRating = Math.round(oldRating + k * (score - expectedScore))

    await this.db.run(`
      UPDATE user_profiles 
      SET echolyn_rating = ?, echolyn_games = ?, echolyn_wins = ?, 
          echolyn_losses = ?, echolyn_draws = ?, updated_at = CURRENT_TIMESTAMP
      WHERE discord_id = ?
    `, [newRating, totalGames, newWins, newLosses, newDraws, discordId])

    await this.db.run(`
      INSERT INTO game_history (discord_id, game_type, result, rating_before, rating_after, opponent, pgn)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [discordId, 'echolyn', gameResult, oldRating, newRating, opponent, pgn])

    return { oldRating, newRating }
  }

  async getGameHistory(discordId, limit = 10) {
    return await this.db.all(`
      SELECT * FROM game_history 
      WHERE discord_id = ? 
      ORDER BY created_at DESC 
      LIMIT ?
    `, [discordId, limit])
  }

  async getLeaderboard(limit = 10) {
    return await this.db.all(`
      SELECT discord_id, echolyn_rating, echolyn_games, echolyn_wins, echolyn_losses, echolyn_draws
      FROM user_profiles 
      WHERE echolyn_games > 0
      ORDER BY echolyn_rating DESC 
      LIMIT ?
    `, [limit])
  }

  async close() {
    if (this.db) {
      await this.db.close()
    }
  }
}

export const database = new Database()