const express = require('express')
const router = express.Router()
const jwt = require('jsonwebtoken')
const bcryptjs = require('bcryptjs')
const { Donor, BloodRequest } = require('../models')

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

//test
router.get('/test', async (req, res) => {
    res.json({ message: 'Test successful' })
})


// Signup
router.post('/signup', async (req, res) => {
    const { email, password } = req.body
    if (!email || !password) return res.status(400).json({ message: 'Bad request [400]' })

    const exists = await Donor.findOne({ email })
    if (exists) return res.status(409).json({ message: 'Email already used [409]' })

    const hashedPassword = await bcryptjs.hash(password, 10)
    await Donor.create({ email, password: hashedPassword })
    res.status(201).json({ message: 'Success [201]' })
})

// Login
router.post('/login', async (req, res) => {
    const { email, password } = req.body
    if (!email || !password) return res.status(400).json({ message: 'Bad request [400]' })

    const donor = await Donor.findOne({ email })
    if (!donor || !(await bcryptjs.compare(password, donor.password))) {
        return res.status(401).json({ message: 'Incorrect credentials [401]' })
    }

    const token = jwt.sign({ email: donor.email }, process.env.KEY)
    res.json({ message: 'Success', token })
})

// Create Profile
router.post('/createprofile', verifyToken, async (req, res) => {
    const updates = req.body
    const donor = await Donor.findOne({ email: req.user.email })
    if (!donor) return res.status(404).json({ message: 'Donor not found [404]' })

    donor.profile = updates
    await donor.save()
    res.json({ message: 'Success' })
})

// Update Profile
router.post('/updateprofile', verifyToken, async (req, res) => {
    const updates = req.body
    const donor = await Donor.findOne({ email: req.user.email })
    if (!donor) return res.status(404).json({ message: 'Donor not found [404]' })

    donor.profile = { ...donor.profile, ...updates }
    await donor.save()
    res.json({ message: 'Success' })
})

// Get Profile
router.get('/profile', verifyToken, async (req, res) => {
    const donor = await Donor.findOne({ email: req.user.email })
    if (!donor || !donor.profile) return res.status(404).json({ message: 'Profile does not exist [404]' })
    res.json(donor.profile)
})

// Get Requests
router.get('/requests', verifyToken, async (req, res) => {
    const donor = await Donor.findOne({ email: req.user.email })
    if (!donor || !donor.profile) return res.status(400).json({ message: 'Profile incomplete [400]' })

    const requests = await BloodRequest.find({
        requiredbloodtype: donor.profile.bloodgroup.toUpperCase(),
        fulfilled: false
    })
    res.json(requests)
})

// Accept Request
router.post('/accept', verifyToken, async (req, res) => {
    const donor = await Donor.findOne({ email: req.user.email })
    if (!donor) return res.status(404).json({ message: 'Donor not found [404]' })

    const cooldownEnd = new Date(donor.profile.lastdonationdate || 0)
    cooldownEnd.setDate(cooldownEnd.getDate() + 14)

    if (new Date() < cooldownEnd) {
        return res.status(403).json({ message: `In cooldown until ${cooldownEnd.toDateString()} [403]` })
    }
    const request = await BloodRequest.findById(req.body.requestId)
    if (request) {
        donor.profile.lastdonationdate = new Date()
        donor.profile.lasthospital = request.hospitalname || 'Unknown Hospital'
        await donor.save()
        request.responses.push(donor.email)
        await request.save()
    }

    res.json({ message: 'Success' })
})

// Last Donation
router.get('/lastdonation', verifyToken, async (req, res) => {
    const donor = await Donor.findOne({ email: req.user.email })
    if (!donor || !donor.profile) return res.status(404).json({ message: 'Donor not found or profile missing [404]' })

    const lastDonationDate = donor.profile.lastdonationdate
    if (!lastDonationDate) {
        return res.json({ lastdonation: null, message: 'No donation record found' })
    }

    res.json({
        lastdonation: lastDonationDate,
        hospital: donor.profile.lasthospital || 'Unknown',
        message: 'Last donation retrieved successfully'
    })
})

// Cooldown
router.get('/cooldown', verifyToken, async (req, res) => {
    const donor = await Donor.findOne({ email: req.user.email })
    if (!donor || !donor.profile || !donor.profile.lastdonationdate) {
        return res.json({ cooldown: null })
    }
    const cooldown = new Date(donor.profile.lastdonationdate)
    cooldown.setDate(cooldown.getDate() + 14)
    res.json({ cooldown })
})

module.exports = router