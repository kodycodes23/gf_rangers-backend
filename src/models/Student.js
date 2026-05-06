const mongoose = require('mongoose')
const { SCHOOL_OPTIONS } = require('../utils/studentSchools')

const studentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 80,
    },
    username: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
    },
    age: {
      type: Number,
      required: true,
      min: 3,
      max: 100,
    },
    school: {
      type: String,
      required: true,
      enum: SCHOOL_OPTIONS,
    },
    avatarSeed: {
      type: String,
      trim: true,
      default: '',
      maxlength: 100,
    },
    results: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Submission',
      },
    ],
  },
  { timestamps: true }
)

studentSchema.index({ username: 1, school: 1 }, { unique: true })

module.exports = mongoose.model('Student', studentSchema)
