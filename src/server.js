const dotenv = require('dotenv')
const app = require('./app')
const { connectToDatabase } = require('./config/db')

dotenv.config()

const port = process.env.PORT || 5000

async function startServer() {
  await connectToDatabase()

  app.listen(port, () => {
    console.log(`API server listening on port ${port}`)
  })
}

startServer().catch((error) => {
  console.error('Failed to start server:', error.message)
  process.exit(1)
})
