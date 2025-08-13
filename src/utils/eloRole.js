import { serverConfig } from '../data/serverData.js'
import { userManager } from '../data/userData.js'
import { log } from '../init.js'

export class EloRole {
  async updateUserRoles(guild, userId, newRating) {
    const config = await serverConfig.getConfig(guild.id)
    const member = await guild.members.fetch(userId).catch(() => null)
    
    if (!member) return

    if (config.sm_role_id && newRating >= config.sm_threshold) {
      const role = guild.roles.cache.get(config.sm_role_id)
      if (role && !member.roles.cache.has(config.sm_role_id)) {
        await member.roles.add(role)
        await serverConfig.addServerMaster(guild.id, userId)
      }
    }

    if (config.champion_role_id) {
      await this.updateChampionRole(guild)
    }
  }

  async updateChampionRole(guild) {
    const config = await serverConfig.getConfig(guild.id)
    if (!config.champion_role_id) return

    const championRole = guild.roles.cache.get(config.champion_role_id)
    if (!championRole) return

    const leaderboard = await userManager.getLeaderboard(1)
    if (leaderboard.length === 0) return

    const currentChampion = leaderboard[0]
    const newChampionMember = await guild.members.fetch(currentChampion.discord_id).catch(() => null)
    
    if (!newChampionMember) return

    const currentHolders = championRole.members
    for (const [, member] of currentHolders) {
      if (member.id !== currentChampion.discord_id) {
        await member.roles.remove(championRole)
      }
    }

    if (!newChampionMember.roles.cache.has(config.champion_role_id)) {
      await newChampionMember.roles.add(championRole)
    }
  }

  async getUserTitle(guildId, userId) {
    const isServerMaster = await serverConfig.isServerMaster(guildId, userId)
    const config = await serverConfig.getConfig(guildId)
    
    if (isServerMaster) {
      return 'SM'
    }

    if (config.champion_role_id) {
      const leaderboard = await userManager.getLeaderboard(1)
      if (leaderboard.length > 0 && leaderboard[0].discord_id === userId) {
        return 'Champion'
      }
    }

    return null
  }
}

export const eloRole = new EloRole()