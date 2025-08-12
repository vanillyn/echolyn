import ChessWebAPI from 'chess-web-api'
import { log } from '../../init.js'

const chessAPI = new ChessWebAPI()

export async function fetchChessComProfile(username) {
  log.debug(`Cecelia: Fetching ${username}`);
  try {
    const profile = await chessAPI.getPlayer(username)
    const stats = await chessAPI.getPlayerStats(username)
    return { profile, stats }
  } catch (err) {
    log.error(`Cecelia: API error: ${err.message}`)
    return null
  }
}

export async function fetchChessComGames(username, year, month) {
  try {
    log.debug(`Cecelia: Fetching ${username}'s games.`);
    return await chessAPI.getPlayerCompleteMonthlyArchives(username, year, month)
  } catch (err) {
    log.error(`Cecelia: API error: ${err.message}`)
    return null
  }
}

export async function fetchChessComRecentGames(username, limit = 10) {
  try {
    log.debug(`Cecelia: Fetching recent games for ${username}`);
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
    log.error(`Cecelia: API error: ${err.message}`)
    return []
  }
}


export function extractChessComId(url) {
	const m = url.match(/chess\.com\/game\/(?:live|daily)\/(\d+)/i);
	return m ? m[1] : null;
}

export async function fetchChessComPgn(gameId) {
	if (ChessWebAPI) {
		try {
			const api = new ChessWebAPI();
			const res = await api.getGameById(gameId);
			if (res && res.body && res.body.pgn) return res.body.pgn;
			if (res && res.pgn) return res.pgn;
		} catch (e) {
      log.error('Error fetching chess.com PGN:', e);
      return null;
		}
	}

	try {
		const pageUrl = `https://www.chess.com/game/live/${gameId}`;
		const res = await fetch(pageUrl);
		if (!res.ok) return null;
		const html = await res.text();
		const pre = html.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);
		if (pre) {
			const candidate = pre[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
			if (candidate.toLowerCase().includes('[event')) return candidate;
		}
	} catch (e) {
    log.error('Error fetching chess.com PGN:', e);
    return null;
	}

	return null;
}