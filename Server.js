const express = require('express')
const mongoose = require('mongoose')
const jwt = require('jsonwebtoken')
const cookieParser = require('cookie-parser')
const bcryptjs = require('bcryptjs')
require('dotenv').config()
const cors = require('cors')

const app = express()
const port = process.env.PORT || 3000
const URL = process.env.MONGOURL

// Middlewares
app.use(express.json())
app.use(cookieParser())
app.use(express.urlencoded({ extended: true }))
app.use(cors({ origin: '*', credentials: true }))

// MongoDB connection
mongoose.connect(URL)
const db = mongoose.connection

db.once('open', () => console.log("✅ Connected to MongoDB"))
db.on('error', (err) => console.error('❌ MongoDB connection error:', err))

// Schemas
const DonorSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    profile: {
        firstname: String,
        lastname: String,
        phone: Number,
        pincode: Number,
        lastdonationdate: Date,
        gender: { type: String, enum: ['male', 'female'] },
        age: Number,
        bloodgroup: String
    }
})

const RequestSchema = new mongoose.Schema({
    hospitalname: String,
    requiredbloodtype: String,
    eligiblebloodtypes: [String],
    unitsrequired: Number,
    contact: String
})

const Donor = mongoose.model('Donor', DonorSchema)
const BloodRequest = mongoose.model('BloodRequest', RequestSchema)

// JWT middleware
function verifyToken(req, res, next) {
    const authHeader = req.headers['authorization']
    if (!authHeader) return res.status(403).json({ message: 'Token required [403]' })

    const token = authHeader.split(' ')[1]
    if (!token) return res.status(403).json({ message: 'Token required [403]' })

    jwt.verify(token, process.env.KEY, (err, decoded) => {
        if (err) return res.status(401).json({ message: 'Invalid token [401]' })
        req.user = decoded
        next()
    })
}

// Auth Routes
app.post('/api/donor/signup', async (req, res) => {
    const { email, password } = req.body
    if (!email || !password) return res.status(400).json({ message: 'Bad request [400]' })

    const exists = await Donor.findOne({ email })
    if (exists) return res.status(409).json({ message: 'Email already used [409]' })

    const hashedPassword = await bcryptjs.hash(password, 10)
    await Donor.create({ email, password: hashedPassword })
    res.status(201).json({ message: 'Success [201]' })
})

app.post('/api/donor/login', async (req, res) => {
    const { email, password } = req.body
    if (!email || !password) return res.status(400).json({ message: 'Bad request [400]' })

    const donor = await Donor.findOne({ email })
    if (!donor || !(await bcryptjs.compare(password, donor.password))) {
        return res.status(401).json({ message: 'Incorrect credentials [401]' })
    }

    const token = jwt.sign({ email: donor.email }, process.env.KEY)
    res.json({ message: 'Success', token })
})

// Profile Routes
app.post('/api/donor/createprofile', verifyToken, async (req, res) => {
    const updates = req.body
    const donor = await Donor.findOne({ email: req.user.email })
    if (!donor) return res.status(404).json({ message: 'Donor not found [404]' })

    donor.profile = updates
    await donor.save()
    res.json({ message: 'Success' })
})

app.post('/api/donor/updateprofile', verifyToken, async (req, res) => {
    const updates = req.body
    const donor = await Donor.findOne({ email: req.user.email })
    if (!donor) return res.status(404).json({ message: 'Donor not found [404]' })

    donor.profile = { ...donor.profile, ...updates }
    await donor.save()
    res.json({ message: 'Success' })
})

app.get('/api/donor/profile', verifyToken, async (req, res) => {
    const donor = await Donor.findOne({ email: req.user.email })
    if (!donor || !donor.profile) return res.status(404).json({ message: 'Profile does not exist [404]' })
    res.json(donor.profile)
})

// Request Matching
app.get('/api/donor/requests', verifyToken, async (req, res) => {
    const donor = await Donor.findOne({ email: req.user.email })
    if (!donor || !donor.profile) return res.status(400).json({ message: 'Profile incomplete [400]' })

    const requests = await BloodRequest.find({
        eligiblebloodtypes: donor.profile.bloodgroup
    })
    res.json(requests)
})

// Accept Donation
app.post('/api/donor/accept', verifyToken, async (req, res) => {
    const donor = await Donor.findOne({ email: req.user.email })
    if (!donor) return res.status(404).json({ message: 'Donor not found [404]' })

    const cooldownEnd = new Date(donor.profile.lastdonationdate || 0)
    cooldownEnd.setDate(cooldownEnd.getDate() + 14)

    if (new Date() < cooldownEnd) {
        return res.status(403).json({ message: `In cooldown until ${cooldownEnd.toDateString()} [403]` })
    }

    donor.profile.lastdonationdate = new Date()
    await donor.save()
    res.json({ message: 'Success' })
})

// Cooldown Check
app.get('/api/donor/cooldown', verifyToken, async (req, res) => {
    const donor = await Donor.findOne({ email: req.user.email })
    if (!donor || !donor.profile || !donor.profile.lastdonationdate) {
        return res.json({ cooldown: null })
    }
    const cooldown = new Date(donor.profile.lastdonationdate)
    cooldown.setDate(cooldown.getDate() + 14)
    res.json({ cooldown })
})

// Start Server
app.listen(port, () => {
    console.log(`🚀 Server running on port ${port}`)
})
