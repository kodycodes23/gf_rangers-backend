const Quiz = require('../models/Quiz')
const Student = require('../models/Student')
const Submission = require('../models/Submission')
const HttpError = require('../utils/httpError')
const { generateUniqueGamePin } = require('../utils/pin')
const { signQuizAccessToken } = require('../utils/quizAccess')
const { getCacheEntry, setCacheEntry, deleteCacheByPrefix } = require('../utils/cache')

const QUIZ_PIN_CACHE_TTL_MS = 10 * 1000

function validateQuestion(question, index) {
  if (!question || typeof question !== 'object') {
    throw new HttpError(400, `Question at index ${index} is invalid.`)
  }

  const { text, options, correctAnswer } = question

  if (!text || typeof text !== 'string' || text.trim().length < 3) {
    throw new HttpError(400, `Question ${index + 1}: text is required and must be at least 3 characters.`)
  }

  if (!Array.isArray(options) || options.length !== 4) {
    throw new HttpError(400, `Question ${index + 1}: exactly 4 options are required.`)
  }

  const invalidOption = options.some((option) => !option || typeof option !== 'string' || !option.trim())
  if (invalidOption) {
    throw new HttpError(400, `Question ${index + 1}: all options must be non-empty strings.`)
  }

  if (!Number.isInteger(correctAnswer) || correctAnswer < 0 || correctAnswer > 3) {
    throw new HttpError(400, `Question ${index + 1}: correctAnswer must be an integer between 0 and 3.`)
  }
}

async function createQuiz(req, res) {
  const { title, status = 'draft', questions, questionDurationSeconds = 10 } = req.body || {}

  if (!title || typeof title !== 'string' || title.trim().length < 3) {
    throw new HttpError(400, 'title is required and must be at least 3 characters.')
  }

  if (!['draft', 'active', 'archived'].includes(status)) {
    throw new HttpError(400, "status must be one of 'draft', 'active', or 'archived'.")
  }

  if (!Array.isArray(questions) || questions.length === 0) {
    throw new HttpError(400, 'questions must be a non-empty array.')
  }

  if (!Number.isInteger(questionDurationSeconds) || questionDurationSeconds < 3 || questionDurationSeconds > 300) {
    throw new HttpError(400, 'questionDurationSeconds must be an integer between 3 and 300.')
  }

  questions.forEach((question, index) => validateQuestion(question, index))

  const gamePin = await generateUniqueGamePin()

  const quiz = await Quiz.create({
    title: title.trim(),
    status,
    gamePin,
    questionDurationSeconds,
    startedAt: status === 'active' ? new Date() : null,
    endedAt: status === 'archived' ? new Date() : null,
    questions: questions.map((question) => ({
      text: question.text.trim(),
      options: question.options.map((option) => option.trim()),
      correctAnswer: question.correctAnswer,
    })),
  })

  deleteCacheByPrefix('tutor:quizzes')
  deleteCacheByPrefix('tutor:dashboard')

  return res.status(201).json({
    success: true,
    data: quiz,
  })
}

async function getQuizByPin(req, res) {
  const pin = req.params.pin?.trim()
  const username = req.query.username?.trim().toLowerCase()
  const school = req.query.school?.trim()

  if (!pin || !/^\d{6}$/.test(pin)) {
    throw new HttpError(400, 'pin must be a 6-digit numeric string.')
  }

  if (!username || !school) {
    throw new HttpError(400, 'username and school query parameters are required.')
  }

  const cacheKey = `quiz:pin:${pin}`
  let quiz = getCacheEntry(cacheKey)

  if (!quiz) {
    quiz = await Quiz.findOne({ gamePin: pin })
      .select('title gamePin status questionDurationSeconds questions')
      .lean()

    if (quiz) {
      setCacheEntry(cacheKey, quiz, QUIZ_PIN_CACHE_TTL_MS)
    }
  }

  if (!quiz) {
    throw new HttpError(404, 'No quiz found for the provided game pin.')
  }

  if (quiz.status !== 'active') {
    throw new HttpError(409, `Quiz is ${quiz.status} and cannot be joined right now.`)
  }

  const student = await Student.findOne({ username, school }).select('_id').lean()
  if (!student) {
    throw new HttpError(404, 'Student not found for the selected school.')
  }

  const previousSubmission = await Submission.findOne({
    studentId: student._id,
    quizId: quiz._id,
  }).lean()

  if (previousSubmission) {
    throw new HttpError(409, 'You have already taken this quiz and cannot join again.')
  }

  const joinedAt = new Date().toISOString()
  const accessToken = signQuizAccessToken({
    quizId: String(quiz._id),
    joinedAt,
  })

  return res.status(200).json({
    success: true,
    data: {
      id: quiz._id,
      title: quiz.title,
      gamePin: quiz.gamePin,
      status: quiz.status,
      questionDurationSeconds: quiz.questionDurationSeconds,
      joinedAt,
      accessToken,
      questions: quiz.questions.map((question, index) => ({
        index,
        text: question.text,
        options: question.options,
      })),
    },
  })
}

async function updateQuizStatus(req, res) {
  const quizId = req.params.quizId?.trim()
  const { status } = req.body || {}

  if (!quizId) {
    throw new HttpError(400, 'quizId is required in route parameters.')
  }

  if (!['draft', 'active', 'archived'].includes(status)) {
    throw new HttpError(400, "status must be one of 'draft', 'active', or 'archived'.")
  }

  const quiz = await Quiz.findById(quizId)

  if (!quiz) {
    throw new HttpError(404, 'Quiz not found.')
  }

  quiz.status = status

  if (status === 'active') {
    quiz.startedAt = new Date()
    quiz.endedAt = null
  }

  if (status === 'archived') {
    quiz.endedAt = new Date()
  }

  if (status === 'draft') {
    quiz.startedAt = null
    quiz.endedAt = null
  }

  await quiz.save()

  deleteCacheByPrefix(`quiz:pin:${quiz.gamePin}`)
  deleteCacheByPrefix('tutor:quizzes')
  deleteCacheByPrefix('tutor:dashboard')

  return res.status(200).json({
    success: true,
    data: quiz,
  })
}

module.exports = {
  createQuiz,
  getQuizByPin,
  updateQuizStatus,
}
