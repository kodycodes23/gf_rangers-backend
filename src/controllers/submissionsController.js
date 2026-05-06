const mongoose = require('mongoose')
const Quiz = require('../models/Quiz')
const Student = require('../models/Student')
const Submission = require('../models/Submission')
const HttpError = require('../utils/httpError')
const { recalculateQuizRanks } = require('../utils/rank')
const { verifyQuizAccessToken } = require('../utils/quizAccess')
const { deleteCacheByPrefix } = require('../utils/cache')

async function postSubmission(req, res) {
  const { studentId, username, school, quizId, quizPin, answers, quizAccessToken } = req.body

  if (!Array.isArray(answers) || answers.length === 0) {
    throw new HttpError(400, 'answers must be a non-empty array.')
  }

  const studentQuery = {}

  if (studentId) {
    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      throw new HttpError(400, 'studentId is not a valid MongoDB ObjectId.')
    }
    studentQuery._id = studentId
  } else if (username && typeof username === 'string') {
    studentQuery.username = username.trim().toLowerCase()

    if (!school || typeof school !== 'string') {
      throw new HttpError(400, 'school is required when username is provided.')
    }

    studentQuery.school = school
  } else {
    throw new HttpError(400, 'Either studentId or username must be provided.')
  }

  const student = await Student.findOne(studentQuery)

  if (!student) {
    throw new HttpError(404, 'Student not found.')
  }

  const quizQuery = {}

  if (quizId) {
    if (!mongoose.Types.ObjectId.isValid(quizId)) {
      throw new HttpError(400, 'quizId is not a valid MongoDB ObjectId.')
    }
    quizQuery._id = quizId
  } else if (quizPin && /^\d{6}$/.test(quizPin)) {
    quizQuery.gamePin = quizPin
  } else {
    throw new HttpError(400, 'Either quizId or a valid 6-digit quizPin must be provided.')
  }

  const quiz = await Quiz.findOne(quizQuery)

  if (!quiz) {
    throw new HttpError(404, 'Quiz not found.')
  }

  const existingSubmission = await Submission.findOne({
    studentId: student._id,
    quizId: quiz._id,
  }).lean()

  if (existingSubmission) {
    throw new HttpError(409, 'You have already submitted this quiz.')
  }

  if (quiz.status !== 'active') {
    if (quiz.status === 'archived') {
      if (!quizAccessToken || typeof quizAccessToken !== 'string') {
        throw new HttpError(409, 'Quiz has ended. Submission requires a valid join token from before the end.')
      }

      let tokenData = null
      try {
        tokenData = verifyQuizAccessToken(quizAccessToken)
      } catch {
        throw new HttpError(401, 'Invalid or expired quiz join token.')
      }

      if (String(tokenData.quizId) !== String(quiz._id)) {
        throw new HttpError(401, 'Quiz join token does not match this quiz.')
      }

      if (!quiz.endedAt) {
        throw new HttpError(409, 'Quiz has ended and can no longer accept submissions.')
      }

      const joinedAt = new Date(tokenData.joinedAt)
      if (Number.isNaN(joinedAt.getTime()) || joinedAt > quiz.endedAt) {
        throw new HttpError(409, 'This quiz ended before the student joined. Submission not allowed.')
      }
    } else {
      throw new HttpError(409, `Cannot submit answers because quiz is ${quiz.status}.`)
    }
  }

  if (answers.length !== quiz.questions.length) {
    throw new HttpError(400, `answers length must match quiz questions count (${quiz.questions.length}).`)
  }

  answers.forEach((answer, index) => {
    if (!Number.isInteger(answer) || answer < -1 || answer > 3) {
      throw new HttpError(400, `Answer at index ${index} must be an integer between -1 and 3.`)
    }
  })

  const score = quiz.questions.reduce((runningScore, question, index) => {
    return runningScore + (answers[index] === question.correctAnswer ? 1 : 0)
  }, 0)

  let submission = await Submission.create({
    studentId: student._id,
    quizId: quiz._id,
    score,
    totalQuestions: quiz.questions.length,
    answers,
  })

  deleteCacheByPrefix('tutor:dashboard')

  // Run ranking and history-link updates in background to keep submit responses snappy.
  void Promise.all([
    recalculateQuizRanks(quiz._id),
    Student.findByIdAndUpdate(student._id, {
      $push: { results: submission._id },
    }),
  ]).catch((error) => {
    console.error('Post-submission background update failed:', error)
  })

  return res.status(201).json({
    success: true,
    data: {
      submissionId: submission._id,
      studentId: submission.studentId,
      quizId: submission.quizId,
      score: submission.score,
      totalQuestions: submission.totalQuestions,
      rank: submission.rank,
      submittedAt: submission.createdAt,
    },
  })
}

module.exports = {
  postSubmission,
}
