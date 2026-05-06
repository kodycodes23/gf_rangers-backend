const Submission = require('../models/Submission')

async function recalculateQuizRanks(quizId) {
  const submissions = await Submission.find({ quizId }).sort({ score: -1, createdAt: 1, _id: 1 })

  let currentRank = 0
  let previousScore = null

  const updates = submissions.map((submission, index) => {
    if (previousScore !== submission.score) {
      currentRank = index + 1
      previousScore = submission.score
    }

    return {
      updateOne: {
        filter: { _id: submission._id },
        update: { $set: { rank: currentRank } },
      },
    }
  })

  if (updates.length > 0) {
    await Submission.bulkWrite(updates)
  }
}

module.exports = { recalculateQuizRanks }
