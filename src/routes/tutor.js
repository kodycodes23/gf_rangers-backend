const express = require('express')
const asyncHandler = require('../utils/asyncHandler')
const {
  loginTutor,
  getTutorDashboard,
  getTutorQuizzes,
} = require('../controllers/tutorController')
const requireTutorAuth = require('../middleware/requireTutorAuth')

const router = express.Router()

router.post('/login', asyncHandler(loginTutor))
router.get('/dashboard', asyncHandler(requireTutorAuth), asyncHandler(getTutorDashboard))
router.get('/quizzes', asyncHandler(requireTutorAuth), asyncHandler(getTutorQuizzes))

module.exports = router
