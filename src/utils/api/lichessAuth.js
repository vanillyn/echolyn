
import crypto from 'crypto'
import { userManager } from '../../data/userData.js'
import { log } from '../../init.js'

export class LichessAuth {
  constructor() {
    this.clientId = process.env.LICHESS_CLIENT_ID || 'echolyn-discord-bot'
    this.redirectUri = process.env.LICHESS_REDIRECT_URI || 'http://localhost:3000/auth/lichess/callback'
    this.scopes = ['preference:read', 'board:play', 'study:read', 'study:write', 'challenge:read', 'challenge:write', 'follow:read', 'follow:write']
  }

  generateAuthUrl(userId) {
    const state = crypto.randomBytes(32).toString('hex')
    const codeVerifier = crypto.randomBytes(32).toString('base64url')
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url')

    userManager.storePendingAuth(state, {
      userId,
      codeVerifier,
      codeChallenge
    })

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: this.scopes.join(' '),
      state: state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256'
    })

    return `https://lichess.org/oauth/authorize?${params.toString()}`
  }

  async exchangeCodeForToken(code, state) {
    const authData = userManager.getPendingAuth(state)
    if (!authData) {
      throw new Error('Invalid or expired auth state')
    }

    try {
      const response = await fetch('https://lichess.org/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          grant_type: 'authorization_code',
          client_id: this.clientId,
          redirect_uri: this.redirectUri,
          code: code,
          code_verifier: authData.codeVerifier
        })
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Token exchange failed: ${response.status} ${error}`)
      }

      const tokenData = await response.json()

      const profile = await this.getUserProfile(tokenData.access_token)
      if (!profile) {
        throw new Error('Failed to get user profile with token')
      }

      await userManager.setLichess(authData.userId, profile.id, tokenData.access_token)

      return {
        token: tokenData.access_token,
        profile: profile,
        userId: authData.userId
      }

    } catch (error) {
      log.error('OAuth token exchange error:', error)
      throw error
    }
  }

  async makeAuthenticatedRequest(endpoint, token, options = {}) {
    try {
      const response = await fetch(`https://lichess.org${endpoint}`, {
        ...options,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          ...options.headers
        }
      })

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`)
      }

      const contentType = response.headers.get('content-type')
      if (contentType?.includes('application/json')) {
        return await response.json()
      } else if (contentType?.includes('application/x-ndjson')) {
        return await response.text()
      } else {
        return await response.text()
      }
    } catch (error) {
      log.error(`Authenticated request error for ${endpoint}:`, error)
      return null
    }
  }

  async getUserProfile(token) {
    return await this.makeAuthenticatedRequest('/api/account', token)
  }

  async getUserGames(username, token, options = {}) {
    const params = new URLSearchParams()
    if (options.max) params.set('max', options.max.toString())
    if (options.pgnInJson) params.set('pgnInJson', 'true')
    if (options.clocks) params.set('clocks', 'true')
    if (options.evals) params.set('evals', 'true')
    
    const endpoint = `/api/games/user/${username}?${params.toString()}`
    return await this.makeAuthenticatedRequest(endpoint, token)
  }

  async createChallenge(username, token, options = {}) {
    const body = new URLSearchParams()
    body.set('rated', options.rated || 'false')
    body.set('clock.limit', options.clockLimit || '300')
    body.set('clock.increment', options.clockIncrement || '5')
    body.set('color', options.color || 'random')
    body.set('variant', options.variant || 'standard')

    return await this.makeAuthenticatedRequest(`/api/challenge/${username}`, token, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: body.toString()
    })
  }

  async getMyGames(token, options = {}) {
    const params = new URLSearchParams()
    if (options.max) params.set('max', options.max.toString())
    if (options.since) params.set('since', options.since.toString())
    if (options.until) params.set('until', options.until.toString())
    if (options.vs) params.set('vs', options.vs)
    if (options.rated !== undefined) params.set('rated', options.rated.toString())
    if (options.perfType) params.set('perfType', options.perfType)
    if (options.color) params.set('color', options.color)
    if (options.analysed !== undefined) params.set('analysed', options.analysed.toString())
    if (options.moves !== undefined) params.set('moves', options.moves.toString())
    if (options.pgnInJson) params.set('pgnInJson', 'true')
    if (options.tags !== undefined) params.set('tags', options.tags.toString())
    if (options.clocks !== undefined) params.set('clocks', options.clocks.toString())
    if (options.evals !== undefined) params.set('evals', options.evals.toString())
    if (options.opening !== undefined) params.set('opening', options.opening.toString())
    
    const endpoint = `/api/games/user/me?${params.toString()}`
    return await this.makeAuthenticatedRequest(endpoint, token)
  }

  async revokeToken(token) {
    try {
      const response = await fetch('https://lichess.org/api/token', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      return response.ok
    } catch (error) {
      log.error('Error revoking token:', error)
      return false
    }
  }

  async testToken(token) {
    const profile = await this.getUserProfile(token)
    return !!profile
  }
}

export const lichessAuth = new LichessAuth()