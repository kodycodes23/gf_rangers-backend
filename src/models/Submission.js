const mongoose = require('mongoose')

const submissionSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
      index: true,
    },
    quizId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Quiz',
      required: true,
      index: true,
    },
    score: {
      type: Number,
      required: true,
      min: 0,
    },
    rank: {
      type: Number,
      min: 1,
      default: null,
    },
    totalQuestions: {
      type: Number,
      required: true,
      min: 1,
    },
    answers: {
      type: [Number],
      required: true,
      default: [],
    },
  },
  { timestamps: true }
)

submissionSchema.index({ studentId: 1, quizId: 1 }, { unique: true })
submissionSchema.index({ quizId: 1, score: -1, createdAt: 1 })
submissionSchema.index({ studentId: 1, createdAt: -1 })

module.exports = mongoose.model('Submission', submissionSchema)
