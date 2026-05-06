const mongoose = require('mongoose')
const Student = require('../models/Student')
const Submission = require('../models/Submission')

async function connectToDatabase() {
  const mongoUri = process.env.MONGO_URI

  if (!mongoUri) {
    throw new Error('MONGO_URI is not set. Add it to your environment variables.')
  }

  await mongoose.connect(mongoUri)

  // Keep student username uniqueness scoped to school by syncing schema indexes.
  await Promise.all([
    Student.syncIndexes(),
    Submission.syncIndexes(),
  ])
}

module.exports = { connectToDatabase }
