import ChessWebAPI from 'chess-web-api'
import { log } from '../../init.js'

const chessAPI = new ChessWebAPI()

export async function fetchChessComProfile(username) {
  try {
    const profile = await chessAPI.getPlayer(username)
    const stats = await chessAPI.getPlayerStats(username)
    return { profile, stats }
  } catch (err) {
    log.error(`Chess.com API error: ${err.message}`)
    return null
  }
}

export async function fetchChessComGames(username, year, month) {
  try {
    return await chessAPI.getPlayerCompleteMonthlyArchives(username, year, month)
  } catch (err) {
    log.error(`Chess.com games API error: ${err.message}`)
    return null
  }
}

export async function fetchChessComRecentGames(username, limit = 10) {
  try {
    const now = new Date()
    const archives = await chessAPI.getPlayerGameArchives(username)
    
    if (!archives?.archives?.length) return []
    
    const recentArchives = archives.archives.slice(-2)
    const games = []
    
    for (const archiveUrl of recentArchives) {
      const archiveData = await fetch(archiveUrl).then(r => r.json())
      if (archiveData?.games) {
        games.push(...archiveData.games)
      }
      if (games.length >= limit) break
    }
    
    return games
      .sort((a, b) => b.end_time - a.end_time)
      .slice(0, limit)
      .map(game => ({
        id: game.url.split('/').pop(),
        url: game.url,
        white: game.white.username,
        black: game.black.username,
        result: game.white.result,
        timeControl: game.time_control,
        endTime: game.end_time,
        site: 'chess.com'
      }))
  } catch (err) {
    log.error(`Recent games error: ${err.message}`)
    return []
  }
}