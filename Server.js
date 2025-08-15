// DONOR + HOSPITAL BACKEND ROUTES
const express = require('express')
const mongoose = require('mongoose')
const cookieParser = require('cookie-parser')
const router = express.Router()
require('dotenv').config()
const cors = require('cors')


const app = express()

app.use(cors({
  //origin: 'https://red-reserve.vercel.app',
  //credentials: true,
}));

const port = process.env.PORT || 3000
const URL = process.env.MONGOURL

// Middlewares
app.use(express.json())
app.use(cookieParser())
app.use(express.urlencoded({ extended: true }))

// MongoDB connection
mongoose.connect(URL)
const db = mongoose.connection

db.once('open', () => console.log("✅ Connected to MongoDB"))
db.on('error', (err) => console.error('❌ MongoDB connection error:', err))

// DONOR ROUTES
const donorRoutes = require('./routes/donor')
app.use('/api/donor', donorRoutes)

// HOSPITAL ROUTES
const hospitalRoutes = require('./routes/hospital')
app.use('/api/hospital', hospitalRoutes)

//test
app.get('/test', async (req, res) => {
    res.json({ message: 'Test successful' })
})

// Start Server
app.listen(port, () => {
    console.log(`🚀 Server running on port ${port}`)
})
