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
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug'
})

function getAllJsFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir)
  
  for (const file of files) {
    const fullPath = path.join(dir, file)
    const stat = fs.statSync(fullPath)
    
    if (stat.isDirectory()) {
      getAllJsFiles(fullPath, fileList)
    } else if (file.endsWith('.js')) {
      fileList.push(fullPath)
    }
  }
  
  return fileList
}

export async function initClient(client) {
  client.commands = new Collection()

  const cmdsPath = path.join(process.cwd(), 'src', 'cmds')
  const cmdFiles = getAllJsFiles(cmdsPath)
  const cmdData = []

  for (const filePath of cmdFiles) {
    const relativePath = path.relative(path.join(process.cwd(), 'src'), filePath)
    const importPath = `./${relativePath.replace(/\\/g, '/')}`
    
    const cmd = (await import(importPath)).default
    client.commands.set(cmd.data.name, cmd)
    cmdData.push(cmd.data.toJSON())
    log.debug(`loaded command: ${cmd.data.name} from ${relativePath}`)
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
    const event = (await import(`./events/${file}`)).default
    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args, client))
    } else {
      client.on(event.name, (...args) => event.execute(...args, client))
    }
  }
}