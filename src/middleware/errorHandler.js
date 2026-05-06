const HttpError = require('../utils/httpError')

function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error)
  }

  // Log unexpected failures so API 500 responses are traceable in server logs.
  if (!(error instanceof HttpError) && error.name !== 'ValidationError' && error.code !== 11000) {
    console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`)
    console.error(error)
  }

  if (error instanceof HttpError) {
    return res.status(error.statusCode).json({
      success: false,
      error: {
        message: error.message,
        details: error.details,
      },
    })
  }

  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: {
        message: 'Validation failed.',
        details: Object.values(error.errors).map((entry) => entry.message),
      },
    })
  }

  if (error.code === 11000) {
    const duplicateField = Object.keys(error.keyPattern ?? {})[0] ?? 'field'
    return res.status(409).json({
      success: false,
      error: {
        message: `${duplicateField} already exists. It must be unique.`,
      },
    })
  }

  return res.status(500).json({
    success: false,
    error: {
      message: process.env.NODE_ENV === 'production'
        ? 'Internal server error.'
        : error.message || 'Internal server error.',
    },
  })
}

module.exports = errorHandler
