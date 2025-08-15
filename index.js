import { Client, GatewayIntentBits } from 'discord.js'
import config from './config.js'
import { version, contributors} from './package.json'
import { initClient, log } from './src/init.js'
import { authServer } from './src/utils/authServer.js'
const contributers = contributors.map(a => a.name).join(", ")
log.info(`${config.name} | ${version} - ${contributers}`)
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