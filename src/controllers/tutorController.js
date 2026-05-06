const Student = require('../models/Student')
const Submission = require('../models/Submission')
const Quiz = require('../models/Quiz')
const HttpError = require('../utils/httpError')
const { getTutorConfig, signTutorToken } = require('../utils/tutorAuth')
const { getCacheEntry, setCacheEntry, deleteCacheByPrefix } = require('../utils/cache')

const TUTOR_DASHBOARD_CACHE_TTL_MS = 5 * 1000
const TUTOR_QUIZZES_CACHE_TTL_MS = 10 * 1000

async function loginTutor(req, res) {
  const { username, password } = req.body || {}

  if (!username || !password) {
    throw new HttpError(400, 'username and password are required.')
  }

  const tutorConfig = getTutorConfig()

  if (username !== tutorConfig.username || password !== tutorConfig.password) {
    throw new HttpError(401, 'Invalid tutor credentials.')
  }

  const token = signTutorToken({
    role: 'tutor',
    username: tutorConfig.username,
  })

  return res.status(200).json({
    success: true,
    data: {
      token,
      tutor: {
        username: tutorConfig.username,
      },
    },
  })
}

async function getTutorDashboard(req, res) {
  const cacheKey = 'tutor:dashboard'
  const cached = getCacheEntry(cacheKey)
  if (cached) {
    return res.status(200).json({
      success: true,
      data: cached,
    })
  }

  const [studentsCount, quizzesCount, submissionsCount, recentSubmissions] = await Promise.all([
    Student.countDocuments(),
    Quiz.countDocuments(),
    Submission.countDocuments(),
    Submission.find({})
      .populate('studentId', 'username school')
      .populate('quizId', 'title gamePin')
      .sort({ createdAt: -1 })
      .limit(100),
  ])

  const scoreRows = recentSubmissions.map((submission) => ({
    studentUsername: submission.studentId?.username || 'Unknown Student',
    school: submission.studentId?.school || 'General',
    quizTitle: submission.quizId?.title || 'Unknown Quiz',
    gamePin: submission.quizId?.gamePin || '-',
    score: submission.score,
    totalQuestions: submission.totalQuestions,
    rank: submission.rank,
    submittedAt: submission.createdAt,
  }))

  const responseData = {
    stats: {
      studentsCount,
      quizzesCount,
      submissionsCount,
    },
    scores: scoreRows,
  }

  setCacheEntry(cacheKey, responseData, TUTOR_DASHBOARD_CACHE_TTL_MS)

  return res.status(200).json({
    success: true,
    data: responseData,
  })
}

async function getTutorQuizzes(req, res) {
  const cacheKey = 'tutor:quizzes'
  const cached = getCacheEntry(cacheKey)
  if (cached) {
    return res.status(200).json({
      success: true,
      data: cached,
    })
  }

  const quizzes = await Quiz.find({})
    .select('title gamePin status questionDurationSeconds startedAt endedAt questions createdAt')
    .sort({ createdAt: -1 })
    .lean()

  setCacheEntry(cacheKey, quizzes, TUTOR_QUIZZES_CACHE_TTL_MS)

  return res.status(200).json({
    success: true,
    data: quizzes,
  })
}

function clearTutorDashboardCache() {
  deleteCacheByPrefix('tutor:dashboard')
  deleteCacheByPrefix('tutor:quizzes')
}

module.exports = {
  loginTutor,
  getTutorDashboard,
  getTutorQuizzes,
  clearTutorDashboardCache,
}
