const express = require('express')
const asyncHandler = require('../utils/asyncHandler')
const { postSubmission } = require('../controllers/submissionsController')

const router = express.Router()

router.post('/', asyncHandler(postSubmission))

module.exports = router
