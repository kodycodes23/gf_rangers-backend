const jwt = require('jsonwebtoken')

function getTutorConfig() {
  return {
    username: process.env.TUTOR_USERNAME || 'gfadmin',
    password: process.env.TUTOR_PASSWORD || 'adminpw',
    jwtSecret: process.env.TUTOR_JWT_SECRET || 'gf-rangers-tutor-secret',
  }
}

function signTutorToken(payload) {
  const { jwtSecret } = getTutorConfig()
  return jwt.sign(payload, jwtSecret, { expiresIn: '8h' })
}

function verifyTutorToken(token) {
  const { jwtSecret } = getTutorConfig()
  return jwt.verify(token, jwtSecret)
}

module.exports = {
  getTutorConfig,
  signTutorToken,
  verifyTutorToken,
}
