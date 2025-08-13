import { log } from '../../init.js';
import { lichessAuth } from './lichessAuth.js';
import { userManager } from '../../data/userData.js';
import config from '../../../config.js';

const BASE_URL = 'https://lichess.org';
const API_NAME = config.api_name.lichess;

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
  log.debug(`${API_NAME}: ${method} ${path}`)
  const mergedHeaders = { ...headers };
  if (token) {
    mergedHeaders['Authorization'] = `Bearer ${token}`;
  }

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
    log.debug(`${API_NAME}: ${response.status} ${response.statusText}, Content-Type: ${contentType}`);
    
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
export async function auth_fetchUserProfile(username, userId = null) {
  if (userId) {
    const profile = await userManager.getProfile(userId);
    if (profile.lichess?.token && profile.lichess.username === username) {

      return await lichessAuth.getUserProfile(profile.lichess.token);
    }
  }
  return await fetchUserProfile(username);
}

export async function auth_fetchUserGames(username, userId = null, options = {}) {
  if (userId) {
    const profile = await userManager.getProfile(userId);
    if (profile.lichess?.token && profile.lichess.username === username) {
      return await lichessAuth.getUserGames(username, profile.lichess.token, options);
    }
  }
  return await fetchUserGames(username, options.max || 10, options.pgnInJson);
}

export async function getMyGames(userId, options = {}) {
  const profile = await userManager.getProfile(userId);
  if (!profile.lichess?.token) {
    throw new Error('No authenticated Lichess account');
  }
  return await lichessAuth.getMyGames(profile.lichess.token, options);
}

export async function createChallenge(userId, targetUsername, options = {}) {
  const profile = await userManager.getProfile(userId);
  if (!profile.lichess?.token) {
    throw new Error('No authenticated Lichess account');
  }
  return await lichessAuth.createChallenge(targetUsername, profile.lichess.token, options);
}


export async function fetchUserProfile(username, trophies = false) {
  return apiRequest('GET', `/api/user/${username}`, { trophies });
}

export async function getUserRatingHistory(username) {
  return apiRequest('GET', `/api/user/${username}/rating-history`);
}

export async function getUserPerfStats(username, perf) {
  return apiRequest('GET', `/api/user/${username}/perf/${perf}`);
}

export async function getUserActivity(username) {
  return apiRequest('GET', `/api/user/${username}/activity`);
}

export async function fetchUserGames(username, max = 10, pgnInJson = false) {
  return apiRequest('GET', `/api/games/user/${username}`, { max, pgnInJson });
}

export async function fetchUserGamesPgn(username, max = 10) {
  return apiRequest('GET', `/api/games/user/${username}`, { max });
}

export async function fetchLichessPgn(gameId, clocks = true, evals = true, moves = true) {
  log.debug(`Fetching Lichess PGN for game ID: ${gameId}`);
  return apiRequest('GET', `/game/export/${gameId}.pgn`, { clocks, evals, moves }, null, null, 'pgn');
}

export async function fetchGameJson(gameId) {
  return apiRequest('GET', `/api/game/${gameId}`);
}

export async function extractLichessId(url) {
  const m = url.match(/lichess\.org\/([a-z0-9\-]{6,})/i);
  return m ? m[1] : null;
}

export function trimGameId(id) {
  if (typeof id !== 'string') return null;
  const trimmed = id.substring(0, 8);
  return isValidGameId(trimmed) ? trimmed : null;
}

export function isValidGameId(gameId) {
  return /^[a-z0-9\-]{6,}$/.test(gameId);
}


export async function getMyProfile(userId) {
  const profile = await userManager.getProfile(userId);
  if (!profile.lichess?.token) {
    throw new Error('No authenticated Lichess account');
  }
  return await lichessAuth.getUserProfile(profile.lichess.token);
}

export async function testLichessToken(userId) {
  const profile = await userManager.getProfile(userId);
  if (!profile.lichess?.token) {
    return false;
  }
  return await lichessAuth.testToken(profile.lichess.token);
}