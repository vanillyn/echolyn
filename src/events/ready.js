import config from '../../config.js'
import { log } from '../init.js'

export default {
  name: 'ready',
  once: true,
  execute(client) {
    log.info(`${config.name} started!`)
  }
}
