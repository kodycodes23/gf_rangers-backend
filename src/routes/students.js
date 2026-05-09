const express = require('express')
const asyncHandler = require('../utils/asyncHandler')
const { getDashboard, login, signup, updateUsername } = require('../controllers/studentsController')

const router = express.Router()

router.post('/signup', asyncHandler(signup))
router.post('/login', asyncHandler(login))
router.patch('/:studentId/username', asyncHandler(updateUsername))
router.get('/:username/dashboard', asyncHandler(getDashboard))

module.exports = router
