import fetch from 'node-fetch';
import { log } from '../init';

const BASE_URL = 'https://lichess.org';

/**
 * Fetches a game in PGN format from Lichess by game ID.
 * @param {string} gameId - The ID of the game.
 * @returns {Promise<string|null>} The PGN string or null if not found.
 */
export async function fetchGamePgn(gameId) {
  // Validate game ID first
  if (!isValidGameId(gameId)) {
    console.error('Invalid game ID format:', gameId);
    console.log('Game IDs should be exactly 8 characters (letters and numbers)');
    return null;
  }
  
  const url = `${BASE_URL}/game/export/${gameId}?clocks=false&evals=false&moves=true&pgnInJson=true`;
  log.debug('Fetching from URL:', url);
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch game: ${response.status} ${response.statusText}`);
    }
    // The response is plain text PGN, not JSON
    const pgn = await response.text();
    return pgn || null;
  } catch (error) {
    log.error('Error fetching game PGN:', error);
    return null;
  }
}

/**
 * Fetches a game as JSON object from Lichess by game ID.
 * @param {string} gameId - The ID of the game.
 * @returns {Promise<Object|null>} The game object or null if not found.
 */
export async function fetchGameJson(gameId) {
  const url = `${BASE_URL}/game/${gameId}`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch game: ${response.status} ${response.statusText}`);
    }
    const game = await response.json();
    return game;
  } catch (error) {
    log.error('Error fetching game JSON:', error);
    return null;
  }
}

/**
 * Extracts the game ID from a Lichess URL.
 * Handles both game URLs and study/analysis URLs.
 * @param {string} url - The Lichess URL.
 * @returns {string|null} The game ID or null if invalid URL.
 */
export function extractGameId(url) {
  // Remove any whitespace and ensure we have a string
  url = String(url).trim();
  
  // Handle different Lichess URL formats:
  // 1. Game URLs: lichess.org/yWBflPDo or lichess.org/yWBflPDo/black
  // 2. Study/Analysis URLs: lichess.org/yWBflPDo2gag (where 2gag is position data)
  // 3. Export URLs: lichess.org/game/export/yWBflPDo
  
  let match;
  
  // Try to match game export URLs first
  match = url.match(/lichess\.org\/game\/export\/([a-zA-Z0-9]{8})/);
  if (match) return match[1];
  
  // Try to match regular game/study URLs
  // This captures exactly 8 characters after lichess.org/
  match = url.match(/lichess\.org\/([a-zA-Z0-9]{8})/);
  if (match) return match[1];
  
  // If no match found, return null
  return null;
}

/**
 * Trims a potential game ID to exactly 8 characters.
 * Useful when you have a longer ID from analysis URLs.
 * @param {string} id - The ID to trim.
 * @returns {string|null} The trimmed 8-character ID or null if invalid.
 */
export function trimGameId(id) {
  if (typeof id !== 'string') return null;
  
  // Take first 8 characters and validate
  const trimmed = id.substring(0, 8);
  return isValidGameId(trimmed) ? trimmed : null;
}

/**
 * Validates if a string looks like a valid Lichess game ID.
 * @param {string} gameId - The game ID to validate.
 * @returns {boolean} True if the ID looks valid.
 */
export function isValidGameId(gameId) {
  return /^[a-zA-Z0-9]{8}$/.test(gameId);
}

/**
 * Fetches a user's games from Lichess.
 * @param {string} username - The Lichess username.
 * @param {number} [max=10] - The maximum number of games to fetch.
 * @returns {Promise<Object[]>} An array of game objects.
 */
export async function fetchUserGames(username, max = 10) {
  const url = `${BASE_URL}/games/user/${username}?max=${max}&pgnInJson=false`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch user games: ${response.status} ${response.statusText}`);
    }
    
    const text = await response.text();
    // The response is NDJSON (newline-delimited JSON)
    const games = text.trim().split('\n').map(line => JSON.parse(line));
    return games;
  } catch (error) {
    console.error('Error fetching user games:', error);
    return [];
  }
}

/**
 * Fetches a user's games in PGN format.
 * @param {string} username - The Lichess username.
 * @param {number} [max=10] - The maximum number of games to fetch.
 * @returns {Promise<string[]>} An array of PGN strings.
 */
export async function fetchUserGamesPgn(username, max = 10) {
  const url = `${BASE_URL}/games/user/${username}?max=${max}`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch user games: ${response.status} ${response.statusText}`);
    }
    
    const text = await response.text();
    // Split PGN games (they're separated by double newlines)
    const games = text.split('\n\n\n').filter(game => game.trim());
    return games;
  } catch (error) {
    console.error('Error fetching user games PGN:', error);
    return [];
  }
}

/**
 * Fetches a user's profile information.
 * @param {string} username - The Lichess username.
 * @returns {Promise<Object|null>} The user profile object or null if not found.
 */
export async function fetchUserProfile(username) {
  const url = `${BASE_URL}/user/${username}`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch user profile: ${response.status} ${response.statusText}`);
    }
    const profile = await response.json();
    return profile;
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }
}