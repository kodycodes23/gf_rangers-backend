const express = require('express')
const asyncHandler = require('../utils/asyncHandler')
const { getDashboard, login, signup } = require('../controllers/studentsController')

const router = express.Router()

router.post('/signup', asyncHandler(signup))
router.post('/login', asyncHandler(login))
router.get('/:username/dashboard', asyncHandler(getDashboard))

module.exports = router
