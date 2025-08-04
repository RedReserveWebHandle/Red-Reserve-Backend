const mongoose = require('mongoose')

// Donor Schema
const DonorSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    profile: {
        firstname: String,
        lastname: String,
        phone: Number,
        pincode: Number,
        lasthospital: String,
        lastdonationdate: Date,
        gender: { type: String, enum: ['male', 'female'] },
        age: Number,
        bloodgroup: String
    }
})

// Blood Request Schema
const BloodRequestSchema = new mongoose.Schema({
    hospitalname: String,
    requiredbloodtype: String,
    eligiblebloodtypes: [String],
    unitsrequired: Number,
    contact: String,
    fulfilled: { type: Boolean, default: false },
    creationdate: { type: Date, default: Date.now },
    responses: [String] // list of donor emails
})

const HospitalSchema = new mongoose.Schema({
    name: String,
    license: String,
    contact: Number,
    pincode: Number,
    address: String,
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true }
})

const Hospital = mongoose.model('Hospital', HospitalSchema)
const Donor = mongoose.model('Donor', DonorSchema)
const BloodRequest = mongoose.model('BloodRequest', BloodRequestSchema)

module.exports = { Donor, BloodRequest, Hospital }
