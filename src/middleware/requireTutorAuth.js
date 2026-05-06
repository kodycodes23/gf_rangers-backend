const HttpError = require('../utils/httpError')
const { verifyTutorToken } = require('../utils/tutorAuth')

function requireTutorAuth(req, res, next) {
  const authHeader = req.headers.authorization || ''
  const [scheme, token] = authHeader.split(' ')

  if (scheme !== 'Bearer' || !token) {
    throw new HttpError(401, 'Tutor authentication is required.')
  }

  try {
    const decoded = verifyTutorToken(token)

    if (decoded.role !== 'tutor') {
      throw new HttpError(403, 'Tutor role is required for this action.')
    }

    req.tutor = decoded
    next()
  } catch (error) {
    if (error instanceof HttpError) {
      throw error
    }

    throw new HttpError(401, 'Tutor session is invalid or expired.')
  }
}

module.exports = requireTutorAuth
