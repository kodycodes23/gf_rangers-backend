const express = require('express')
const cors = require('cors')
const studentsRoutes = require('./routes/students')
const quizzesRoutes = require('./routes/quizzes')
const submissionsRoutes = require('./routes/submissions')
const tutorRoutes = require('./routes/tutor')
const mediaRoutes = require('./routes/media')
const notFound = require('./middleware/notFound')
const errorHandler = require('./middleware/errorHandler')

const app = express()

app.use(cors())
app.use(express.json({ limit: '1mb' }))

app.get('/health', (req, res) => {
  res.status(200).json({ ok: true })
})

app.use('/api/students', studentsRoutes)
app.use('/api/quizzes', quizzesRoutes)
app.use('/api/submissions', submissionsRoutes)
app.use('/api/tutor', tutorRoutes)
app.use('/api/media', mediaRoutes)

app.use(notFound)
app.use(errorHandler)

module.exports = app
