import sqlite3 from 'sqlite3'
import { open } from 'sqlite'
import { log } from '../init.js'
import { eloSystem } from './elo.js'

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
        echolyn_rating INTEGER DEFAULT 1200,
        echolyn_games INTEGER DEFAULT 0,
        echolyn_wins INTEGER DEFAULT 0,
        echolyn_losses INTEGER DEFAULT 0,
        echolyn_draws INTEGER DEFAULT 0,
        is_rated BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS game_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        discord_id TEXT,
        opponent_id TEXT,
        game_type TEXT,
        result TEXT,
        rating_before INTEGER,
        rating_after INTEGER,
        rating_change INTEGER,
        opponent_rating_before INTEGER,
        opponent_rating_after INTEGER,
        opponent_rating_change INTEGER,
        pgn TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (discord_id) REFERENCES user_profiles (discord_id)
      );

      CREATE TABLE IF NOT EXISTS server_config (
        guild_id TEXT PRIMARY KEY,
        sm_role_id TEXT,
        sm_threshold INTEGER DEFAULT 1800,
        champion_role_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS server_masters (
        guild_id TEXT,
        user_id TEXT,
        promoted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (guild_id, user_id)
      );
    `)

    log.debug('database initialized')
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

  async updateEcholynRating(player1Id, player2Id, result, pgn = null) {
    const player1Profile = await this.getProfile(player1Id)
    const player2Profile = await this.getProfile(player2Id)

    const player1Rating = player1Profile.echolyn_rating
    const player2Rating = player2Profile.echolyn_rating

    const eloChanges = eloSystem.calculateRatingChange(player1Rating, player2Rating, result)


    const player1NewGames = player1Profile.echolyn_games + 1
    let player1Wins = player1Profile.echolyn_wins
    let player1Losses = player1Profile.echolyn_losses
    let player1Draws = player1Profile.echolyn_draws

    if (result === 'win') player1Wins++
    else if (result === 'loss') player1Losses++
    else if (result === 'draw') player1Draws++

    const player1IsRated = eloSystem.isRated(player1NewGames)

    await this.db.run(`
      UPDATE user_profiles 
      SET echolyn_rating = ?, echolyn_games = ?, echolyn_wins = ?, 
          echolyn_losses = ?, echolyn_draws = ?, is_rated = ?, updated_at = CURRENT_TIMESTAMP
      WHERE discord_id = ?
    `, [eloChanges.playerRating, player1NewGames, player1Wins, player1Losses, player1Draws, player1IsRated ? 1 : 0, player1Id])

    const player2NewGames = player2Profile.echolyn_games + 1
    let player2Wins = player2Profile.echolyn_wins
    let player2Losses = player2Profile.echolyn_losses
    let player2Draws = player2Profile.echolyn_draws

    const opponentResult = result === 'win' ? 'loss' : result === 'loss' ? 'win' : 'draw'
    if (opponentResult === 'win') player2Wins++
    else if (opponentResult === 'loss') player2Losses++
    else if (opponentResult === 'draw') player2Draws++

    const player2IsRated = eloSystem.isRated(player2NewGames)

    await this.db.run(`
      UPDATE user_profiles 
      SET echolyn_rating = ?, echolyn_games = ?, echolyn_wins = ?, 
          echolyn_losses = ?, echolyn_draws = ?, is_rated = ?, updated_at = CURRENT_TIMESTAMP
      WHERE discord_id = ?
    `, [eloChanges.opponentRating, player2NewGames, player2Wins, player2Losses, player2Draws, player2IsRated ? 1 : 0, player2Id])

    await this.db.run(`
      INSERT INTO game_history (
        discord_id, opponent_id, game_type, result, rating_before, rating_after, rating_change,
        opponent_rating_before, opponent_rating_after, opponent_rating_change, pgn
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      player1Id, player2Id, 'echolyn-pvp', result, player1Rating, eloChanges.playerRating, eloChanges.playerChange,
      player2Rating, eloChanges.opponentRating, eloChanges.opponentChange, pgn
    ])

    await this.db.run(`
      INSERT INTO game_history (
        discord_id, opponent_id, game_type, result, rating_before, rating_after, rating_change,
        opponent_rating_before, opponent_rating_after, opponent_rating_change, pgn
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      player2Id, player1Id, 'echolyn-pvp', opponentResult, player2Rating, eloChanges.opponentRating, eloChanges.opponentChange,
      player1Rating, eloChanges.playerRating, eloChanges.playerChange, pgn
    ])

    return {
      player1: {
        oldRating: player1Rating,
        newRating: eloChanges.playerRating,
        change: eloChanges.playerChange,
        isRated: player1IsRated
      },
      player2: {
        oldRating: player2Rating,
        newRating: eloChanges.opponentRating,
        change: eloChanges.opponentChange,
        isRated: player2IsRated
      }
    }
  }

  async getGameHistory(discordId, limit = 10) {
    return await this.db.all(`
      SELECT gh.*, up.discord_id as opponent_discord_id
      FROM game_history gh
      LEFT JOIN user_profiles up ON gh.opponent_id = up.discord_id
      WHERE gh.discord_id = ? 
      ORDER BY gh.created_at DESC 
      LIMIT ?
    `, [discordId, limit])
  }

  async getLeaderboard(limit = 10) {
    return await this.db.all(`
      SELECT discord_id, echolyn_rating, echolyn_games, echolyn_wins, echolyn_losses, echolyn_draws, is_rated
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