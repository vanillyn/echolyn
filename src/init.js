import fs from 'node:fs'
import path from 'node:path'
import { Collection, REST, Routes } from 'discord.js'
import config from '../config.js'
import pino from 'pino'

export const log = pino({
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard'
    }
  },
  level: 'info'
})

export async function initClient(client) {
  client.commands = new Collection()

  const cmdsPath = path.join(process.cwd(), 'src', 'cmds')
  const cmdFiles = fs.readdirSync(cmdsPath).filter(f => f.endsWith('.js'))
  const cmdData = []

  for (const file of cmdFiles) {
    const cmd = (await import(`../cmds/${file}`)).default
    client.commands.set(cmd.data.name, cmd)
    cmdData.push({ name: cmd.data.name, description: cmd.data.description })
  }

  const rest = new REST({ version: '10' }).setToken(config.token)
  try {
    await rest.put(Routes.applicationCommands(config.clientId), { body: cmdData })
    log.info('commands registered')
  } catch (err) {
    log.error({ err }, 'error registering commands')
  }

  const eventsPath = path.join(process.cwd(), 'src', 'events')
  const eventFiles = fs.readdirSync(eventsPath).filter(f => f.endsWith('.js'))

  for (const file of eventFiles) {
    const event = (await import(`../events/${file}`)).default
    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args, client))
    } else {
      client.on(event.name, (...args) => event.execute(...args, client))
    }
  }
}
