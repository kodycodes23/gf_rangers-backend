const Quiz = require('../models/Quiz')

const generateRawPin = () => Math.floor(100000 + Math.random() * 900000).toString()

async function generateUniqueGamePin() {
  let pin = generateRawPin()

  while (await Quiz.exists({ gamePin: pin })) {
    pin = generateRawPin()
  }

  return pin
}

module.exports = { generateUniqueGamePin }
