import fetch from 'node-fetch';
import { log } from '../init';

const BASE_URL = 'https://lichess.org';


/**
 * General API request handler for Lichess API.
 * Handles GET, POST, etc., with query params, body, token, and custom headers.
 * @param {string} method - HTTP method (GET, POST, etc.).
 * @param {string} path - API path (e.g., '/api/account').
 * @param {Object} queryParams - Query parameters as key-value object.
 * @param {Object|string} body - Body data (object for json/form, string for text).
 * @param {string|null} token - Optional OAuth token.
 * @param {string} bodyType - 'json', 'form', 'text', or 'pgn'.
 * @param {Object} [headers={}] - Optional additional headers.
 * @returns {Promise<any>} Response data (JSON, text, PGN, or null on error).
 */
async function apiRequest(
  method,
  path,
  queryParams = {},
  body = null,
  token = null,
  bodyType = 'json',
  headers = {}
) {
  const url = new URL(path, BASE_URL);
  Object.entries(queryParams).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.append(key, value);
    }
  });
 const mergedHeaders = { ...headers };
  const options = {
    method,
    headers: mergedHeaders,
  };

  if (body && (method === 'POST' || method === 'PUT')) {
    if (bodyType === 'json') {
      options.body = JSON.stringify(body);
      options.headers['Content-Type'] = 'application/json';
    } else if (bodyType === 'form') {
      const form = new URLSearchParams();
      Object.entries(body).forEach(([key, value]) => form.append(key, value));
      options.body = form.toString();
      options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
    } else if (bodyType === 'text') {
      options.body = body;
      options.headers['Content-Type'] = 'text/plain';
    } else if (bodyType === 'pgn') {
      options.body = body;
      options.headers['Content-Type'] = 'application/x-chess-pgn';
      options.headers['Accept'] = 'application/x-chess-pgn';
    }
  }

  try {
    const response = await fetch(url.toString(), options);
    if (!response.ok) {
      throw new Error(`${method} ${path} failed: ${response.status} ${response.statusText}`);
    }
    const contentType = response.headers.get('content-type');
    log.debug(`Lila: ${method} ${url}`)
    log.debug(`Lila: Response: ${response.status} ${response.statusText}, Content-Type: ${contentType}`);
    if (contentType?.includes('application/json') || contentType?.includes('application/vnd.lichess.v3+json')) {
      return await response.json();
    } else if (contentType?.includes('application/x-ndjson')) {
      return await response.text();
    } else {
      return await response.text();
    }
  } catch (error) {
    log.error(`API request error: ${error}`);
    return null;
  }
}

// Account Endpoints

/**
 * Get the public profile of the logged-in user.
 * @param {string} token - OAuth token.
 * @returns {Promise<Object|null>} User profile or null.
 */
export async function getMyProfile(token) {
  return apiRequest('GET', '/api/account', {}, null, token);
}

/**
 * Get the email address of the logged-in user.
 * @param {string} token - OAuth token.
 * @returns {Promise<Object|null>} Email object or null.
 */
export async function getMyEmail(token) {
  return apiRequest('GET', '/api/account/email', {}, null, token);
}

/**
 * Get preferences of the logged-in user.
 * @param {string} token - OAuth token.
 * @returns {Promise<Object|null>} Preferences or null.
 */
export async function getMyPreferences(token) {
  return apiRequest('GET', '/api/account/preferences', {}, null, token);
}

/**
 * Get kid mode status of the logged-in user.
 * @param {string} token - OAuth token.
 * @returns {Promise<Object|null>} Kid mode status or null.
 */
export async function getMyKidMode(token) {
  return apiRequest('GET', '/api/account/kid', {}, null, token);
}

/**
 * Set kid mode status of the logged-in user.
 * @param {boolean} v - Kid mode status.
 * @param {string} token - OAuth token.
 * @returns {Promise<Object|null>} Response or null.
 */
export async function setMyKidMode(v, token) {
  return apiRequest('POST', '/api/account/kid', { v }, null, token, 'form');
}

/**
 * Get timeline events of the logged-in user.
 * @param {number} [since] - Timestamp to show events since.
 * @param {number} [nb=15] - Max number of events (1-30).
 * @param {string} token - OAuth token.
 * @returns {Promise<Object|null>} Timeline events or null.
 */
export async function getMyTimeline(since, nb = 15, token) {
  return apiRequest('GET', '/api/timeline', { since, nb }, null, token);
}

// Users Endpoints

/**
 * Get real-time status of multiple users (online, playing, etc.).
 * @param {string} ids - Comma-separated user IDs (up to 100).
 * @param {boolean} [withSignal=false] - Include network signal.
 * @param {boolean} [withGameIds=false] - Include game IDs.
 * @param {boolean} [withGameMetas=false] - Include game metas.
 * @returns {Promise<Array<Object>|null>} User statuses or null.
 */
export async function getUsersStatus(ids, withSignal = false, withGameIds = false, withGameMetas = false) {
  return apiRequest('GET', '/api/users/status', { ids, withSignal, withGameIds, withGameMetas });
}

/**
 * Get top 10 players for each variant/speed.
 * @returns {Promise<Object|null>} Leaderboards or null.
 */
export async function getTopPlayers() {
  return apiRequest('GET', '/api/player');
}

/**
 * Get leaderboard for a specific perf type.
 * @param {number} nb - Number of users (1-200).
 * @param {string} perfType - Perf type (e.g., 'bullet').
 * @returns {Promise<Object|null>} Leaderboard or null.
 */
export async function getLeaderboard(nb, perfType) {
  return apiRequest('GET', `/api/player/top/${nb}/${perfType}`);
}

/**
 * Get public data for a user.
 * @param {string} username - Username.
 * @param {boolean} [trophies=false] - Include trophies.
 * @returns {Promise<Object|null>} User data or null.
 */
export async function fetchUserProfile(username, trophies = false) {
  return apiRequest('GET', `/api/user/${username}`, { trophies });
}

/**
 * Get rating history of a user.
 * @param {string} username - Username.
 * @returns {Promise<Array<Object>|null>} Rating history or null.
 */
export async function getUserRatingHistory(username) {
  return apiRequest('GET', `/api/user/${username}/rating-history`);
}

/**
 * Get performance statistics for a user in a perf type.
 * @param {string} username - Username.
 * @param {string} perf - Perf type.
 * @returns {Promise<Object|null>} Stats or null.
 */
export async function getUserPerfStats(username, perf) {
  return apiRequest('GET', `/api/user/${username}/perf/${perf}`);
}

/**
 * Get activity feed data for a user.
 * @param {string} username - Username.
 * @returns {Promise<Object|null>} Activity data or null.
 */
export async function getUserActivity(username) {
  return apiRequest('GET', `/api/user/${username}/activity`);
}

/**
 * Get multiple users by IDs (up to 300).
 * @param {string} ids - Comma-separated IDs.
 * @returns {Promise<Array<Object>|null>} Users or null.
 */
export async function getUsersByIds(ids) {
  return apiRequest('POST', '/api/users', {}, ids, null, 'text');
}

/**
 * Get currently streaming users.
 * @returns {Promise<Array<Object>|null>} Streamers or null.
 */
export async function getLiveStreamers() {
  return apiRequest('GET', '/api/streamer/live');
}

/**
 * Get crosstable between two users.
 * @param {string} user1 - First username.
 * @param {string} user2 - Second username.
 * @param {boolean} [matchup=false] - Include current matchup.
 * @returns {Promise<Object|null>} Crosstable or null.
 */
export async function getCrosstable(user1, user2, matchup = false) {
  return apiRequest('GET', `/api/crosstable/${user1}/${user2}`, { matchup });
}

/**
 * Autocomplete usernames.
 * @param {string} term - Search term (min 3 chars).
 * @param {boolean} [object=false] - Return object format.
 * @param {boolean} [names=false] - Return names only.
 * @param {boolean} [friend=false] - Friends only (requires auth).
 * @param {string} [team] - Team ID.
 * @param {string} [tour] - Tournament ID.
 * @param {string} [swiss] - Swiss ID.
 * @param {string} [token] - OAuth token if needed.
 * @returns {Promise<Object|null>} Autocomplete results or null.
 */
export async function autocompletePlayers(term, object = false, names = false, friend = false, team, tour, swiss, token) {
  return apiRequest('GET', '/api/player/autocomplete', { term, object, names, friend, team, tour, swiss }, null, token);
}

/**
 * Add a note to a user.
 * @param {string} username - Username.
 * @param {string} text - Note text.
 * @param {string} token - OAuth token.
 * @returns {Promise<Object|null>} Response or null.
 */
export async function addUserNote(username, text, token) {
  return apiRequest('POST', `/api/user/${username}/note`, {}, { text }, token, 'form');
}

/**
 * Get notes for a user.
 * @param {string} username - Username.
 * @param {string} token - OAuth token.
 * @returns {Promise<Array<Object>|null>} Notes or null.
 */
export async function getUserNotes(username, token) {
  return apiRequest('GET', `/api/user/${username}/note`, {}, null, token);
}

/**
 * Get followed users (streamed as NDJSON text).
 * @param {string} token - OAuth token.
 * @returns {Promise<string|null>} NDJSON text or null.
 */
export async function getFollowing(token) {
  return apiRequest('GET', '/api/user/following', {}, null, token);
}

/**
 * Follow a user.
 * @param {string} username - Username.
 * @param {string} token - OAuth token.
 * @returns {Promise<Object|null>} Response or null.
 */
export async function followUser(username, token) {
  return apiRequest('POST', `/api/user/${username}/follow`, {}, null, token);
}

/**
 * Unfollow a user.
 * @param {string} username - Username.
 * @param {string} token - OAuth token.
 * @returns {Promise<Object|null>} Response or null.
 */
export async function unfollowUser(username, token) {
  return apiRequest('POST', `/api/user/${username}/unfollow`, {}, null, token);
}

/**
 * Block a user.
 * @param {string} username - Username.
 * @param {string} token - OAuth token.
 * @returns {Promise<Object|null>} Response or null.
 */
export async function blockUser(username, token) {
  return apiRequest('POST', `/api/user/${username}/block`, {}, null, token);
}

/**
 * Unblock a user.
 * @param {string} username - Username.
 * @param {string} token - OAuth token.
 * @returns {Promise<Object|null>} Response or null.
 */
export async function unblockUser(username, token) {
  return apiRequest('POST', `/api/user/${username}/unblock`, {}, null, token);
}

// Teams Endpoints

/**
 * Get team info.
 * @param {string} teamId - Team ID.
 * @returns {Promise<Object|null>} Team info or null.
 */
export async function getTeam(teamId) {
  return apiRequest('GET', `/api/team/${teamId}`);
}

/**
 * Get popular teams (paginated).
 * @param {number} [page=1] - Page number.
 * @returns {Promise<Object|null>} Teams paginator or null.
 */
export async function getPopularTeams(page = 1) {
  return apiRequest('GET', '/api/team/all', { page });
}

/**
 * Get teams of a user.
 * @param {string} username - Username.
 * @returns {Promise<Array<Object>|null>} Teams or null.
 */
export async function getUserTeams(username) {
  return apiRequest('GET', `/api/team/of/${username}`);
}

/**
 * Search teams.
 * @param {string} text - Search text.
 * @param {number} [page=1] - Page number.
 * @returns {Promise<Object|null>} Search results or null.
 */
export async function searchTeams(text, page = 1) {
  return apiRequest('GET', '/api/team/search', { text, page });
}

/**
 * Get team members (NDJSON text).
 * @param {string} teamId - Team ID.
 * @param {boolean} [full=false] - Full user docs.
 * @param {string} [token] - OAuth token if private.
 * @returns {Promise<string|null>} NDJSON text or null.
 */
export async function getTeamMembers(teamId, full = false, token) {
  return apiRequest('GET', `/api/team/${teamId}/users`, { full }, null, token);
}

/**
 * Get arena tournaments for team (NDJSON text).
 * @param {string} teamId - Team ID.
 * @param {number} [max=100] - Max tournaments.
 * @param {string} [status] - Status filter.
 * @param {string} [createdBy] - Creator filter.
 * @param {string} [name] - Name filter.
 * @returns {Promise<string|null>} NDJSON text or null.
 */
export async function getTeamArenas(teamId, max = 100, status, createdBy, name) {
  return apiRequest('GET', `/api/team/${teamId}/arena`, { max, status, createdBy, name });
}

/**
 * Join a team.
 * @param {string} teamId - Team ID.
 * @param {string} [message] - Message if required.
 * @param {string} [password] - Password if required.
 * @param {string} token - OAuth token.
 * @returns {Promise<Object|null>} Response or null.
 */
export async function joinTeam(teamId, message, password, token) {
  return apiRequest('POST', `/api/team/${teamId}/join`, {}, { message, password }, token, 'form');
}

/**
 * Quit a team.
 * @param {string} teamId - Team ID.
 * @param {string} token - OAuth token.
 * @returns {Promise<Object|null>} Response or null.
 */
export async function quitTeam(teamId, token) {
  return apiRequest('POST', `/api/team/${teamId}/quit`, {}, null, token);
}

/**
 * Get pending join requests for team.
 * @param {string} teamId - Team ID.
 * @param {boolean} [declined=false] - Include declined.
 * @param {string} token - OAuth token.
 * @returns {Promise<Array<Object>|null>} Requests or null.
 */
export async function getTeamJoinRequests(teamId, declined = false, token) {
  return apiRequest('GET', `/api/team/${teamId}/requests`, { declined }, null, token);
}

/**
 * Accept a join request.
 * @param {string} teamId - Team ID.
 * @param {string} userId - User ID.
 * @param {string} token - OAuth token.
 * @returns {Promise<Object|null>} Response or null.
 */
export async function acceptTeamJoinRequest(teamId, userId, token) {
  return apiRequest('POST', `/api/team/${teamId}/request/${userId}/accept`, {}, null, token);
}

/**
 * Decline a join request.
 * @param {string} teamId - Team ID.
 * @param {string} userId - User ID.
 * @param {string} token - OAuth token.
 * @returns {Promise<Object|null>} Response or null.
 */
export async function declineTeamJoinRequest(teamId, userId, token) {
  return apiRequest('POST', `/api/team/${teamId}/request/${userId}/decline`, {}, null, token);
}

/**
 * Kick a user from team.
 * @param {string} teamId - Team ID.
 * @param {string} userId - User ID.
 * @param {string} token - OAuth token.
 * @returns {Promise<Object|null>} Response or null.
 */
export async function kickFromTeam(teamId, userId, token) {
  return apiRequest('POST', `/api/team/${teamId}/kick/${userId}`, {}, null, token);
}

/**
 * Send message to all team members.
 * @param {string} teamId - Team ID.
 * @param {string} message - Message text.
 * @param {string} token - OAuth token.
 * @returns {Promise<Object|null>} Response or null.
 */
export async function messageTeam(teamId, message, token) {
  return apiRequest('POST', `/api/team/${teamId}/pm-all`, {}, { message }, token, 'form');
}

/**
 * Get Swiss tournaments for team (NDJSON text).
 * @param {string} teamId - Team ID.
 * @param {number} [max=100] - Max tournaments.
 * @returns {Promise<string|null>} NDJSON text or null.
 */
export async function getTeamSwiss(teamId, max = 100) {
  return apiRequest('GET', `/api/team/swiss/${teamId}`, { max });
}

// Games Endpoints (including original functions adapted)

/**
 * Fetches a game in PGN format from Lichess by game ID.
 * @param {string} gameId - The ID of the game.
 * @param {boolean} [clocks=false] - Include clocks.
 * @param {boolean} [evals=false] - Include evals.
 * @param {boolean} [moves=true] - Include moves.
 * @param {boolean} [pgnInJson=true] - PGN in JSON.
 * @returns {Promise<string|null>} The PGN string or null.
 */
export async function fetchLichessPgn(gameId, clocks = true, evals = true, moves = true) {
  log.debug(`Fetching Lichess PGN for game ID: ${gameId}`);
  return apiRequest('GET', `/game/export/${gameId}.pgn`, { clocks, evals, moves }, 'string', null, 'pgn'); 
}

/**
 * Fetches a game as JSON from Lichess by game ID.
 * @param {string} gameId - The ID of the game.
 * @returns {Promise<Object|null>} The game object or null.
 */
export async function fetchGameJson(gameId) {
  return apiRequest('GET', `/api/game/${gameId}`);
}

/**
 * Fetches a user's games as NDJSON.
 * @param {string} username - Username.
 * @param {number} [max=10] - Max games.
 * @param {boolean} [pgnInJson=false] - PGN in JSON.
 * @returns {Promise<string|null>} NDJSON text or null.
 */
export async function fetchUserGames(username, max = 10, pgnInJson = false) {
  return apiRequest('GET', `/games/user/${username}`, { max, pgnInJson });
}

/**
 * Fetches a user's games in PGN format.
 * @param {string} username - Username.
 * @param {number} [max=10] - Max games.
 * @returns {Promise<string|null>} PGN text (multi-game) or null.
 */
export async function fetchUserGamesPgn(username, max = 10) {
  return apiRequest('GET', `/games/user/${username}`, { max });
}


/**
 * Extracts the game ID from a Lichess URL.
 * @param {string} url - The Lichess URL.
 * @returns {string|null} The game ID or null.
 */
export async function extractLichessId(url) {
	const m = url.match(/lichess\.org\/([a-z0-9\-]{6,})/i);
	return m ? m[1] : null;
}

/**
 * Trims a game ID to 8 characters.
 * @param {string} id - The ID.
 * @returns {string|null} Trimmed ID or null.
 */
export function trimGameId(id) {
  if (typeof id !== 'string') return null;
  const trimmed = id.substring(0, 8);
  return isValidGameId(trimmed) ? trimmed : null;
}

/**
 * Validates a Lichess game ID.
 * @param {string} gameId - The game ID.
 * @returns {boolean} True if valid.
 */
export function isValidGameId(gameId) {
  return /^[a-z0-9\-]{6,}$/.test(gameId);
}