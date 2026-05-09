const express = require('express')
const asyncHandler = require('../utils/asyncHandler')
const { createQuiz, deleteQuiz, getQuizByPin, updateQuiz, updateQuizStatus } = require('../controllers/quizzesController')
const requireTutorAuth = require('../middleware/requireTutorAuth')

const router = express.Router()

router.post('/', asyncHandler(requireTutorAuth), asyncHandler(createQuiz))
router.patch('/:quizId', asyncHandler(requireTutorAuth), asyncHandler(updateQuiz))
router.delete('/:quizId', asyncHandler(requireTutorAuth), asyncHandler(deleteQuiz))
router.patch('/:quizId/status', asyncHandler(requireTutorAuth), asyncHandler(updateQuizStatus))
router.get('/:pin', asyncHandler(getQuizByPin))

module.exports = router
