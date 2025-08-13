import sqlite3 from 'sqlite3'
import { open } from 'sqlite'
import { log } from '../init.js'

class ServerConfigManager {
  constructor() {
    this.db = null
    this.cache = new Map()
  }

  async init() {
    const dbPath = process.env.DATABASE_FILE || './data/database.sqlite'
    
    this.db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    })

    await this.db.exec(`
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

    log.debug('server config database initialized')
  }

  async getConfig(guildId) {
    if (this.cache.has(guildId)) {
      return this.cache.get(guildId)
    }

    let config = await this.db.get(
      'SELECT * FROM server_config WHERE guild_id = ?',
      [guildId]
    )

    if (!config) {
      await this.db.run(
        'INSERT INTO server_config (guild_id) VALUES (?)',
        [guildId]
      )
      config = await this.db.get(
        'SELECT * FROM server_config WHERE guild_id = ?',
        [guildId]
      )
    }

    this.cache.set(guildId, config)
    return config
  }

  async setServerMasterRole(guildId, roleId, threshold = 1800) {
    await this.db.run(`
      UPDATE server_config 
      SET sm_role_id = ?, sm_threshold = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE guild_id = ?
    `, [roleId, threshold, guildId])
    
    this.cache.delete(guildId)
  }

  async setChampionRole(guildId, roleId) {
    await this.db.run(`
      UPDATE server_config 
      SET champion_role_id = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE guild_id = ?
    `, [roleId, guildId])
    
    this.cache.delete(guildId)
  }

  async addServerMaster(guildId, userId) {
    await this.db.run(
      'INSERT OR REPLACE INTO server_masters (guild_id, user_id) VALUES (?, ?)',
      [guildId, userId]
    )
  }

  async removeServerMaster(guildId, userId) {
    await this.db.run(
      'DELETE FROM server_masters WHERE guild_id = ? AND user_id = ?',
      [guildId, userId]
    )
  }

  async getServerMasters(guildId) {
    return await this.db.all(
      'SELECT user_id FROM server_masters WHERE guild_id = ?',
      [guildId]
    )
  }

  async isServerMaster(guildId, userId) {
    const result = await this.db.get(
      'SELECT 1 FROM server_masters WHERE guild_id = ? AND user_id = ?',
      [guildId, userId]
    )
    return !!result
  }
}

export const serverConfig = new ServerConfigManager()