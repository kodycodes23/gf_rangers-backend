const mongoose = require('mongoose')
const sharp = require('sharp')
const HttpError = require('../utils/httpError')
const MediaAsset = require('../models/MediaAsset')

const MAX_UPLOAD_BYTES = 3 * 1024 * 1024
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

async function uploadImage(req, res) {
  const file = req.file

  if (!file) {
    throw new HttpError(400, 'image file is required.')
  }

  if (!ALLOWED_MIME.has(file.mimetype)) {
    throw new HttpError(400, 'Unsupported image format. Use jpeg, png, webp, or gif.')
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    throw new HttpError(400, 'Image exceeds 3MB upload limit.')
  }

  const processed = await sharp(file.buffer, { failOn: 'none', animated: false })
    .rotate()
    .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer()

  const asset = await MediaAsset.create({
    mimeType: 'image/webp',
    size: processed.length,
    data: processed,
    uploadedBy: req.tutor?.username || 'tutor',
  })

  return res.status(201).json({
    success: true,
    data: {
      id: String(asset._id),
      url: `/api/media/${asset._id}`,
      mimeType: asset.mimeType,
      size: asset.size,
    },
  })
}

async function getImage(req, res) {
  const { id } = req.params

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new HttpError(400, 'Invalid media id.')
  }

  const asset = await MediaAsset.findById(id).select('mimeType data')

  if (!asset) {
    throw new HttpError(404, 'Image not found.')
  }

  res.setHeader('Content-Type', asset.mimeType)
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
  return res.status(200).send(asset.data)
}

module.exports = {
  uploadImage,
  getImage,
  MAX_UPLOAD_BYTES,
  ALLOWED_MIME,
}
