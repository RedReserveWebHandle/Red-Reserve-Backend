// DONOR + HOSPITAL BACKEND ROUTES
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

app.use(cors({
  origin: '*',
  credentials: true,
}));

app.options('*', cors({ 
  origin: '*', 
  credentials: true 
}));

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

// Start Server
app.listen(port, () => {
    console.log(`🚀 Server running on port ${port}`)
})
