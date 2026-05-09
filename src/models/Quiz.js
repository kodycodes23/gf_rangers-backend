const mongoose = require('mongoose')

const optionSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      trim: true,
      default: '',
      maxlength: 300,
    },
    imageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MediaAsset',
      default: null,
    },
  },
  { _id: false }
)

const questionSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      trim: true,
      default: '',
      maxlength: 400,
    },
    imageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MediaAsset',
      default: null,
    },
    options: {
      type: [optionSchema],
      required: true,
      validate: {
        validator(options) {
          return (
            Array.isArray(options) &&
            options.length === 4 &&
            options.every((opt) => {
              if (!opt || typeof opt !== 'object') return false
              const hasText = typeof opt.text === 'string' && opt.text.trim().length > 0
              return hasText || !!opt.imageId
            })
          )
        },
        message: 'Each question must contain exactly 4 options, each with text or an image.',
      },
    },
    correctAnswer: {
      type: Number,
      required: true,
      min: 0,
      max: 3,
    },
  },
  { _id: false }
)

questionSchema.path('text').validate(function validateQuestionPrompt(value) {
  const hasText = typeof value === 'string' && value.trim().length >= 3
  return hasText || !!this.imageId
}, 'Each question must include text (at least 3 chars) or an image.')

const quizSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 200,
    },
    gamePin: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      match: /^\d{6}$/,
    },
    status: {
      type: String,
      enum: ['draft', 'active', 'archived'],
      default: 'draft',
      required: true,
    },
    questionDurationSeconds: {
      type: Number,
      required: true,
      min: 3,
      max: 300,
      default: 10,
    },
    startedAt: {
      type: Date,
      default: null,
    },
    endedAt: {
      type: Date,
      default: null,
    },
    questions: {
      type: [questionSchema],
      required: true,
      validate: {
        validator(questions) {
          return Array.isArray(questions) && questions.length > 0
        },
        message: 'Quiz must include at least one question.',
      },
    },
  },
  { timestamps: true }
)

module.exports = mongoose.model('Quiz', quizSchema)
