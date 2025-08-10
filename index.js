import { Client, GatewayIntentBits } from 'discord.js'
import config from './config.js'
import { initClient, log } from './src/init.js'

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
})

await initClient(client)

client.login(config.token)
log.debug('bot starting...')