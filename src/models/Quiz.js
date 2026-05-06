const mongoose = require('mongoose')

const questionSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 400,
    },
    options: {
      type: [String],
      required: true,
      validate: {
        validator(options) {
          return Array.isArray(options) && options.length === 4 && options.every((opt) => !!opt && opt.trim())
        },
        message: 'Each question must contain exactly 4 non-empty options.',
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
