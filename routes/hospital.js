const express = require('express')
const router = express.Router()
const jwt = require('jsonwebtoken')
const bcryptjs = require('bcryptjs')
const { Hospital, BloodRequest, Donor } = require('../models')

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
    const { name, license, contact, pincode, address, email, password } = req.body
    if (!email || !password || !name || !contact || !pincode || !address)
        return res.status(400).json({ message: 'Bad request [400]' })

    const exists = await Hospital.findOne({ email })
    if (exists) return res.status(409).json({ message: 'Email already used [409]' })

    const hashedPassword = await bcryptjs.hash(password, 10)
    await Hospital.create({ name, license, contact, pincode, address, email, password: hashedPassword })
    res.status(201).json({ message: 'Success [201]' })
})

// Login
router.post('/login', async (req, res) => {
    const { email, password } = req.body
    if (!email || !password) return res.status(400).json({ message: 'Bad request [400]' })

    const hospital = await Hospital.findOne({ email })
    if (!hospital || !(await bcryptjs.compare(password, hospital.password))) {
        return res.status(401).json({ message: 'Incorrect credentials [401]' })
    }

    const token = jwt.sign({ email: hospital.email, name: hospital.name }, process.env.KEY)
    res.json({ message: 'Success', token })
})

// Blood Request
router.post('/bloodrequest', verifyToken, async (req, res) => {
    const { bloodtype, units, eligibletypes, contact } = req.body
    if (!bloodtype || !units || !eligibletypes || !contact) {
        return res.status(400).json({ message: 'Bad request [400]' })
    }

    const hospital = await Hospital.findOne({ email: req.user.email })
    await BloodRequest.create({
        hospitalname: hospital.name,
        requiredbloodtype: bloodtype,
        eligiblebloodtypes: eligibletypes,
        unitsrequired: units,
        contact
    })

    res.json({ message: 'Success' })
})

// Fulfill Request
router.post('/fulfillrequest', verifyToken, async (req, res) => {
    const { id } = req.body
    if (!id) return res.status(400).json({ message: 'Bad request [400]' })

    const request = await BloodRequest.findById(id)
    if (!request) return res.status(404).json({ message: 'Not found [404]' })

    request.fulfilled = true
    await request.save()
    res.json({ message: 'Success' })
})

// Hospital's Requests
router.get('/requests', verifyToken, async (req, res) => {
    const hospital = await Hospital.findOne({ email: req.user.email })
    const requests = await BloodRequest.find({ hospitalname: hospital.name, fulfilled: false })
    res.json(requests)
})

// Responses to a Request
router.post('/responses', verifyToken, async (req, res) => {
    const { id } = req.body
    if (!id) return res.status(400).json({ message: 'Bad request [400]' })

    const request = await BloodRequest.findById(id)
    if (!request) return res.status(404).json({ message: 'Not found [404]' })

    const donors = await Donor.find({ email: { $in: request.responses } })
    const responseDetails = donors.map(d => ({
        name: `${d.profile.firstname} ${d.profile.lastname}`,
        contact: d.profile.phone,
        bloodtype: d.profile.bloodgroup
    }))
    res.json(responseDetails)
})

// Past (fulfilled) Requests
router.get('/history', verifyToken, async (req, res) => {
    const hospital = await Hospital.findOne({ email: req.user.email })
    const history = await BloodRequest.find({ hospitalname: hospital.name, fulfilled: true })
    res.json(history)
})

// Other Hospital Requests
router.get('/others', verifyToken, async (req, res) => {
    const currentHospital = await Hospital.findOne({ email: req.user.email });
    if (!currentHospital) return res.status(404).json({ message: 'Hospital not found [404]' });

    const requests = await BloodRequest.find({
        hospitalname: { $ne: currentHospital.name },
        fulfilled: false
    });

    const hospitalNames = [...new Set(requests.map(r => r.hospitalname))];
    const hospitals = await Hospital.find({ name: { $in: hospitalNames } });

    const hospitalMap = {};
    hospitals.forEach(h => {
        hospitalMap[h.name] = {
            pincode: h.pincode,
            address: h.address
        };
    });

    // Add the extra fields while keeping original request fields intact
    const augmentedRequests = requests.map(req => ({
        ...req._doc, // keep all original fields from MongoDB document
        hospitalpincode: hospitalMap[req.hospitalname]?.pincode || 'NA',
        hospitaladdress: hospitalMap[req.hospitalname]?.address || 'NA'
    }));

    res.json(augmentedRequests);
});


// Fulfill Other Hospital Request
router.post('/fulfillhospital', verifyToken, async (req, res) => {
    const { id } = req.body
    if (!id) return res.status(400).json({ message: 'Bad request [400]' })

    const request = await BloodRequest.findById(id)
    if (!request) return res.status(404).json({ message: 'Not found [404]' })

    request.fulfilled = true
    await request.save()
    res.json({ message: 'Success' })
})

router.get('/names', verifyToken, async (req, res) => {
    try {
        const hospitals = await Hospital.find({}, { name: 1, pincode: 1 });

        // Convert pincodes to lat/lon
        const withCoordinates = await Promise.all(
            hospitals.map(async (hospital) => {
                const url = `https://nominatim.openstreetmap.org/search?postalcode=${hospital.pincode}&country=India&format=json&limit=1`;

                const response = await fetch(url, {
                    headers: { 'User-Agent': 'HospitalLocator/1.0' }
                });

                const data = await response.json();
                if (data.length > 0) {
                    return {
                        ...hospital.toObject(),
                        latitude: parseFloat(data[0].lat),
                        longitude: parseFloat(data[0].lon)
                    };
                }
                return { ...hospital.toObject(), latitude: null, longitude: null };
            })
        );

        res.json(withCoordinates);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});


module.exports = router