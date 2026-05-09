const express = require('express')
const multer = require('multer')
const asyncHandler = require('../utils/asyncHandler')
const requireTutorAuth = require('../middleware/requireTutorAuth')
const { uploadImage, getImage, MAX_UPLOAD_BYTES, ALLOWED_MIME } = require('../controllers/mediaController')

const router = express.Router()

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_UPLOAD_BYTES,
  },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      return cb(new Error('Unsupported image format.'))
    }
    return cb(null, true)
  },
})

router.post('/', asyncHandler(requireTutorAuth), upload.single('image'), asyncHandler(uploadImage))
router.get('/:id', asyncHandler(getImage))

module.exports = router
