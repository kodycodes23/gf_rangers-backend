const Student = require('../models/Student')
const Submission = require('../models/Submission')
const HttpError = require('../utils/httpError')
const { SCHOOL_OPTIONS } = require('../utils/studentSchools')

function normalizeUsername(username) {
  return username.trim().toLowerCase()
}

function validateSchool(school) {
  if (!school || typeof school !== 'string') {
    throw new HttpError(400, 'school is required and must be a string.')
  }

  if (!SCHOOL_OPTIONS.includes(school)) {
    throw new HttpError(400, `school must be one of: ${SCHOOL_OPTIONS.join(', ')}.`)
  }

  return school
}

async function signup(req, res) {
  const { name, username, age, school } = req.body || {}

  if (!name || typeof name !== 'string') {
    throw new HttpError(400, 'name is required and must be a string.')
  }

  const cleanName = name.trim()
  if (cleanName.length < 2 || cleanName.length > 80) {
    throw new HttpError(400, 'name must be between 2 and 80 characters.')
  }

  if (!username || typeof username !== 'string') {
    throw new HttpError(400, 'username is required and must be a string.')
  }

  const normalizedUsername = normalizeUsername(username)

  if (normalizedUsername.length < 3 || normalizedUsername.length > 30) {
    throw new HttpError(400, 'username must be between 3 and 30 characters.')
  }

  if (!Number.isInteger(age) || age < 3 || age > 100) {
    throw new HttpError(400, 'age must be an integer between 3 and 100.')
  }

  const normalizedSchool = validateSchool(school)

  const existingStudent = await Student.findOne({
    username: normalizedUsername,
    school: normalizedSchool,
  }).select('_id')

  if (existingStudent) {
    throw new HttpError(409, 'This username is already taken in your school.')
  }

  const student = await Student.create({
    name: cleanName,
    username: normalizedUsername,
    age,
    school: normalizedSchool,
    avatarSeed: normalizedUsername,
  })

  return res.status(201).json({
    success: true,
    data: student,
    message: 'Student account created successfully.',
  })
}

async function login(req, res) {
  const { username, school } = req.body || {}

  if (!username || typeof username !== 'string') {
    throw new HttpError(400, 'username is required and must be a string.')
  }

  const normalizedUsername = normalizeUsername(username)

  if (normalizedUsername.length < 3 || normalizedUsername.length > 30) {
    throw new HttpError(400, 'username must be between 3 and 30 characters.')
  }

  const normalizedSchool = validateSchool(school)

  const student = await Student.findOne({
    username: normalizedUsername,
    school: normalizedSchool,
  }).lean()

  if (student) {
    return res.status(200).json({
      success: true,
      data: student,
      message: 'Student logged in successfully.',
    })
  }

  throw new HttpError(404, 'Username does not exist in the selected school.')
}

async function getDashboard(req, res) {
  const username = req.params.username?.trim().toLowerCase()
  const school = req.query.school

  if (!username) {
    throw new HttpError(400, 'username path parameter is required.')
  }

  const normalizedSchool = validateSchool(school)

  const student = await Student.findOne({ username, school: normalizedSchool })
    .select('_id name username age school avatarSeed')
    .lean()

  if (!student) {
    throw new HttpError(404, 'Student not found for the selected school.')
  }

  const submissions = await Submission.find({ studentId: student._id })
    .populate('quizId', 'title gamePin')
    .sort({ createdAt: -1 })
    .lean()

  const history = submissions.map((submission) => ({
    submissionId: submission._id,
    quizId: submission.quizId?._id ?? null,
    quizTitle: submission.quizId?.title ?? 'Unknown Quiz',
    gamePin: submission.quizId?.gamePin ?? null,
    score: submission.score,
    totalQuestions: submission.totalQuestions,
    rank: submission.rank,
    submittedAt: submission.createdAt,
  }))

  return res.status(200).json({
    success: true,
    data: {
      student: {
        id: student._id,
        name: student.name,
        username: student.username,
        age: student.age,
        school: student.school,
        avatarSeed: student.avatarSeed,
      },
      history,
    },
  })
}

async function updateUsername(req, res) {
  const studentId = req.params.studentId?.trim()
  const { username, school } = req.body || {}

  if (!studentId) {
    throw new HttpError(400, 'studentId path parameter is required.')
  }

  if (!username || typeof username !== 'string') {
    throw new HttpError(400, 'username is required and must be a string.')
  }

  const normalizedUsername = normalizeUsername(username)
  if (normalizedUsername.length < 3 || normalizedUsername.length > 30) {
    throw new HttpError(400, 'username must be between 3 and 30 characters.')
  }

  const normalizedSchool = validateSchool(school)

  const student = await Student.findOne({ _id: studentId, school: normalizedSchool })
  if (!student) {
    throw new HttpError(404, 'Student not found for the selected school.')
  }

  if (student.username !== normalizedUsername) {
    const existingStudent = await Student.findOne({
      _id: { $ne: student._id },
      username: normalizedUsername,
      school: normalizedSchool,
    }).select('_id')

    if (existingStudent) {
      throw new HttpError(409, 'This username is already taken in your school.')
    }
  }

  student.username = normalizedUsername
  student.avatarSeed = normalizedUsername
  await student.save()

  return res.status(200).json({
    success: true,
    data: student,
    message: 'Username updated successfully.',
  })
}

module.exports = {
  signup,
  login,
  getDashboard,
  updateUsername,
}
