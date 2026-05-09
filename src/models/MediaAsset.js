const mongoose = require('mongoose')

const mediaAssetSchema = new mongoose.Schema(
  {
    mimeType: {
      type: String,
      required: true,
      enum: ['image/webp'],
    },
    size: {
      type: Number,
      required: true,
      min: 1,
      max: 3 * 1024 * 1024,
    },
    data: {
      type: Buffer,
      required: true,
    },
    uploadedBy: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { timestamps: true }
)

module.exports = mongoose.model('MediaAsset', mediaAssetSchema)
