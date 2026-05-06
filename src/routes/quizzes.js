const express = require('express')
const asyncHandler = require('../utils/asyncHandler')
const { createQuiz, getQuizByPin, updateQuizStatus } = require('../controllers/quizzesController')
const requireTutorAuth = require('../middleware/requireTutorAuth')

const router = express.Router()

router.post('/', asyncHandler(requireTutorAuth), asyncHandler(createQuiz))
router.patch('/:quizId/status', asyncHandler(requireTutorAuth), asyncHandler(updateQuizStatus))
router.get('/:pin', asyncHandler(getQuizByPin))

module.exports = router
