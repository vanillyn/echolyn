import http from 'http'
import url from 'url'
import { lichessAuth } from './api/lichessAuth.js'
import { log } from '../init.js'
import config from '../../config.js'

export class AuthServer {
  constructor() {
    this.server = null
    this.port = process.env.OAUTH_PORT || 3000
  }

  start() {
    if (this.server) return

    this.server = http.createServer(async (req, res) => {
      const parsedUrl = url.parse(req.url, true)
      
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
      
      if (req.method === 'OPTIONS') {
        res.writeHead(200)
        res.end()
        return
      }

      if (parsedUrl.pathname === '/auth/lichess/callback') {
        await this.handleLichessCallback(req, res, parsedUrl.query)
      } else if (parsedUrl.pathname === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(`
          <html>
            <head><title>${config.name} oauth</title></head>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #1e1e2e; color: #cdd6f4;">
              <h1>oauth server</h1>
              <p>This server handles OAuth callbacks for <a href="https://lichess.org">Lichess</a> and <a href="https://chess.com">Chess.com</a></p>
              <p>The server is running fine.</p>
              <hr>
              <h2> server info </h2>
                <ul style="list-style: none; padding: 0; text-align: left; display: inline-block;">
                    <li><strong>Server Port:</strong> ${this.port}</li>
                    <li><strong>OAuth Providers:</strong> Lichess, Chess.com</li>
                    <li><strong>Callback Endpoints:</strong>
                        <ul style="margin-left: 20px;">
                            <li><code>/auth/lichess/callback</code></li>
                            <li><code>/auth/chesscom/callback</code> (coming soon)</li>
                        </ul>
                    </li>
                    <li><strong>CORS Enabled:</strong> Yes</li>
                    <li><strong>App Name:</strong> ${config.name}</li>
                </ul>
            </body>
          </html>
        `)
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' })
        res.end('Not Found')
      }
    })

    this.server.listen(this.port, () => {
      log.info(`OAuth callback server running on http://localhost:${this.port}`)
    })
  }

  async handleLichessCallback(req, res, query) {
    try {
      const { code, state, error } = query

      if (error) {
        throw new Error(`OAuth error: ${error}`)
      }

      if (!code || !state) {
        throw new Error('Missing code or state parameter')
      }

      const result = await lichessAuth.exchangeCodeForToken(code, state)
      
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end(`
        <html>
          <head>
            <title>Lichess Authorization Complete</title>
            <style>
              body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #1e1e2e; color: #cdd6f4; }
              .success { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); max-width: 500px; margin: 0 auto; }
              .checkmark { color: #4CAF50; font-size: 48px; }
              .username { color: #666; margin: 20px 0; }
              .close-text { color: #999; margin-top: 20px; }
            </style>
          </head>
          <body>
            <div class="success">
              <div class="checkmark">✓</div>
              <h1>Authorization Successful!</h1>
              <p>Your Lichess account <strong>${result.profile.id}</strong> has been successfully linked to Echolyn.</p>
              <div class="username">Welcome, ${result.profile.username || result.profile.id}!</div>
              <p>You can now close this tab and return to Discord.</p>
              <div class="close-text">This window will close automatically in 5 seconds.</div>
            </div>
            <script>
              setTimeout(() => window.close(), 5000);
            </script>
          </body>
        </html>
      `)

      log.info(`OAuth success for user ${result.userId}: linked to Lichess user ${result.profile.id}`)

    } catch (error) {
      log.error('OAuth callback error:', error)
      
      res.writeHead(400, { 'Content-Type': 'text/html' })
      res.end(`
        <html>
          <head>
            <title>Authorization Failed</title>
            <style>
              body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #1e1e2e; color: #cdd6f4; }
              .x-mark { color: #f38ba8; font-size: 48px; }
            </style>
          </head>
          <body>
            <div>
              <div class="x-mark">failed</div>
              <h1>Authorization Failed</h1>
              <p>There was an error linking your Lichess account:</p>
              <p><strong>${error.message}</strong></p>
              <p>Please try again using the <code>/login lichess</code> command in Discord.</p>
            </div>
          </body>
        </html>
      `)
    }
  }

  stop() {
    if (this.server) {
      this.server.close()
      this.server = null
      log.info('OAuth callback server stopped')
    }
  }
}

export const authServer = new AuthServer()