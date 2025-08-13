import { Client, GatewayIntentBits } from 'discord.js'
import config from './config.js'
import { initClient, log } from './src/init.js'
import { authServer } from './src/utils/authServer.js'

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
})

await initClient(client)

authServer.start()

client.login(config.token)
log.debug('bot starting...')

process.on('SIGINT', () => {
  log.info('Received SIGINT, shutting down gracefully...')
  authServer.stop()
  client.destroy()
  process.exit(0)
})

process.on('SIGTERM', () => {
  log.info('Received SIGTERM, shutting down gracefully...')
  authServer.stop()
  client.destroy()
  process.exit(0)
})