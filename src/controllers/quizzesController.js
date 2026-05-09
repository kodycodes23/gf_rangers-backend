const mongoose = require('mongoose')
const Quiz = require('../models/Quiz')
const Student = require('../models/Student')
const Submission = require('../models/Submission')
const HttpError = require('../utils/httpError')
const { generateUniqueGamePin } = require('../utils/pin')
const { signQuizAccessToken } = require('../utils/quizAccess')
const { getCacheEntry, setCacheEntry, deleteCacheByPrefix } = require('../utils/cache')

const QUIZ_PIN_CACHE_TTL_MS = 10 * 1000

function normalizeOption(option) {
  if (typeof option === 'string') {
    return {
      text: option.trim(),
      imageId: null,
    }
  }

  if (!option || typeof option !== 'object') {
    return {
      text: '',
      imageId: null,
    }
  }

  return {
    text: typeof option.text === 'string' ? option.text.trim() : '',
    imageId: option.imageId || null,
  }
}

function normalizeQuestion(question) {
  const options = Array.isArray(question?.options) ? question.options.map(normalizeOption) : []

  return {
    text: typeof question?.text === 'string' ? question.text.trim() : '',
    imageId: question?.imageId || null,
    options,
    correctAnswer: question?.correctAnswer,
  }
}

function validateQuestion(question, index) {
  if (!question || typeof question !== 'object') {
    throw new HttpError(400, `Question at index ${index} is invalid.`)
  }

  const normalizedQuestion = normalizeQuestion(question)
  const { text, imageId, options, correctAnswer } = normalizedQuestion

  const hasQuestionText = typeof text === 'string' && text.trim().length >= 3
  const hasQuestionImage = !!imageId

  if (!hasQuestionText && !hasQuestionImage) {
    throw new HttpError(400, `Question ${index + 1}: include text (min 3 chars) or an image.`)
  }

  if (imageId && !mongoose.Types.ObjectId.isValid(imageId)) {
    throw new HttpError(400, `Question ${index + 1}: imageId is invalid.`)
  }

  if (!Array.isArray(options) || options.length !== 4) {
    throw new HttpError(400, `Question ${index + 1}: exactly 4 options are required.`)
  }

  const invalidOption = options.some((option, optionIndex) => {
    const hasText = typeof option.text === 'string' && option.text.trim().length > 0
    const hasImage = !!option.imageId

    if (option.imageId && !mongoose.Types.ObjectId.isValid(option.imageId)) {
      throw new HttpError(400, `Question ${index + 1} option ${optionIndex + 1}: imageId is invalid.`)
    }

    return !hasText && !hasImage
  })

  if (invalidOption) {
    throw new HttpError(400, `Question ${index + 1}: each option must include text or an image.`)
  }

  if (!Number.isInteger(correctAnswer) || correctAnswer < 0 || correctAnswer > 3) {
    throw new HttpError(400, `Question ${index + 1}: correctAnswer must be an integer between 0 and 3.`)
  }

  return normalizedQuestion
}

function normalizeGamePin(gamePin) {
  if (typeof gamePin !== 'string') return null
  const cleaned = gamePin.trim()
  if (!/^\d{6}$/.test(cleaned)) {
    throw new HttpError(400, 'gamePin must be a 6-digit numeric string.')
  }
  return cleaned
}

async function resolveGamePin(requestedPin, ignoreQuizId = null) {
  if (!requestedPin) {
    return generateUniqueGamePin()
  }

  const existingQuiz = await Quiz.findOne({ gamePin: requestedPin }).select('_id').lean()
  if (existingQuiz && String(existingQuiz._id) !== String(ignoreQuizId || '')) {
    throw new HttpError(409, 'This game pin is already in use by another quiz.')
  }

  return requestedPin
}

async function createQuiz(req, res) {
  const { title, status = 'draft', questions, questionDurationSeconds = 10, gamePin } = req.body || {}

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

  const normalizedQuestions = questions.map((question, index) => validateQuestion(question, index))

  const normalizedGamePin = normalizeGamePin(gamePin)
  const pinToUse = await resolveGamePin(normalizedGamePin)

  const quiz = await Quiz.create({
    title: title.trim(),
    status,
    gamePin: pinToUse,
    questionDurationSeconds,
    startedAt: status === 'active' ? new Date() : null,
    endedAt: status === 'archived' ? new Date() : null,
    questions: normalizedQuestions.map((question) => ({
      text: question.text,
      imageId: question.imageId,
      options: question.options.map((option) => ({
        text: option.text,
        imageId: option.imageId,
      })),
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
        imageId: question.imageId || null,
        options: (question.options || []).map((option) => {
          const normalizedOption = normalizeOption(option)
          return {
            text: normalizedOption.text,
            imageId: normalizedOption.imageId,
          }
        }),
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

async function updateQuiz(req, res) {
  const quizId = req.params.quizId?.trim()
  const {
    title,
    status = 'draft',
    questions,
    questionDurationSeconds = 10,
    gamePin,
  } = req.body || {}

  if (!quizId) {
    throw new HttpError(400, 'quizId is required in route parameters.')
  }

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

  const quiz = await Quiz.findById(quizId)
  if (!quiz) {
    throw new HttpError(404, 'Quiz not found.')
  }

  const normalizedQuestions = questions.map((question, index) => validateQuestion(question, index))
  const normalizedGamePin = normalizeGamePin(gamePin)
  const pinToUse = await resolveGamePin(normalizedGamePin || quiz.gamePin, quiz._id)
  const oldPin = quiz.gamePin

  quiz.title = title.trim()
  quiz.status = status
  quiz.gamePin = pinToUse
  quiz.questionDurationSeconds = questionDurationSeconds
  quiz.questions = normalizedQuestions.map((question) => ({
    text: question.text,
    imageId: question.imageId,
    options: question.options.map((option) => ({
      text: option.text,
      imageId: option.imageId,
    })),
    correctAnswer: question.correctAnswer,
  }))

  if (status === 'active') {
    quiz.startedAt = quiz.startedAt || new Date()
    quiz.endedAt = null
  }

  if (status === 'archived') {
    quiz.endedAt = quiz.endedAt || new Date()
  }

  if (status === 'draft') {
    quiz.startedAt = null
    quiz.endedAt = null
  }

  await quiz.save()

  deleteCacheByPrefix(`quiz:pin:${oldPin}`)
  deleteCacheByPrefix(`quiz:pin:${quiz.gamePin}`)
  deleteCacheByPrefix('tutor:quizzes')
  deleteCacheByPrefix('tutor:dashboard')

  return res.status(200).json({
    success: true,
    data: quiz,
  })
}

async function deleteQuiz(req, res) {
  const quizId = req.params.quizId?.trim()

  if (!quizId) {
    throw new HttpError(400, 'quizId is required in route parameters.')
  }

  const quiz = await Quiz.findById(quizId).select('_id gamePin title').lean()
  if (!quiz) {
    throw new HttpError(404, 'Quiz not found.')
  }

  const [submissionResult] = await Promise.all([
    Submission.deleteMany({ quizId: quiz._id }),
    Quiz.deleteOne({ _id: quiz._id }),
  ])

  deleteCacheByPrefix(`quiz:pin:${quiz.gamePin}`)
  deleteCacheByPrefix('tutor:quizzes')
  deleteCacheByPrefix('tutor:dashboard')

  return res.status(200).json({
    success: true,
    data: {
      deletedQuizId: String(quiz._id),
      deletedSubmissions: submissionResult.deletedCount || 0,
    },
    message: 'Quiz deleted successfully.',
  })
}

module.exports = {
  createQuiz,
  getQuizByPin,
  updateQuiz,
  updateQuizStatus,
  deleteQuiz,
}
