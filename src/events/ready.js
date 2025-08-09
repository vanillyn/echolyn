import { log } from '../utils/init.js'

export default {
  name: 'ready',
  once: true,
  execute(client) {
    log.info(`logged in as ${client.user.tag}`)
  }
}
