const jwt = require('jsonwebtoken')

function getQuizAccessSecret() {
  return process.env.QUIZ_ACCESS_SECRET || process.env.TUTOR_JWT_SECRET || 'gf-rangers-quiz-access-secret'
}

function signQuizAccessToken(payload) {
  return jwt.sign(payload, getQuizAccessSecret(), { expiresIn: '6h' })
}

function verifyQuizAccessToken(token) {
  return jwt.verify(token, getQuizAccessSecret())
}

module.exports = {
  signQuizAccessToken,
  verifyQuizAccessToken,
}
