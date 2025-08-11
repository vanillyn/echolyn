import 'dotenv/config'

export default {
  token: process.env.BOT_TOKEN,
  clientId: process.env.BOT_ID,
  name: process.env.BOT_NAME,
  environment: process.env.NODE_ENV
}
