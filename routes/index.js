var express = require('express');
var router = express.Router();
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {

    const filename = `${file.originalname}`;
    cb(null, filename);
  }
});


const upload = multer({ storage: storage });

const jwt = require('jsonwebtoken');
const { connectToDB, ObjectId } = require("../utils/db");
const { generateToken } = require("../utils/auth");

/* GET home page. */
router.get('/', function (req, res, next) {
  res.render('index', { title: 'Express' });
});

router.post('/api/register', async (req, res) => {
  const db = await connectToDB();
  try {
    const english_name = req.body.english_name;
    const student_id = req.body.student_id;
    const email = req.body.email;
    const password = req.body.password;
    const gender = req.body.gender;

    // Check if the registration data is valid
    if (!english_name || !student_id || !email || !password || !gender) {
      return res.status(400).send('Bad Request');
    }

    // Check if the email is already registered
    let user = await db.collection("users").findOne({ email: email });
    if (user) {
      return res.status(400).send('Email already registered');
    }

    // Create a new user
    let userdata = {
      english_name: english_name,
      student_id: student_id,
      email: email,
      password: password,
      gender: gender,
      createdAt: new Date(),
      modifiedAt: new Date(),
    };
    let result = await db.collection("users").insertOne(userdata);
    res.status(201).json({ id: result.insertedId });
    console.log(result);
  } catch (err) {
    res.status(400).json({ message: err.message });
  } finally {
    await db.client.close();
  }
});


router.post('/api/login', async (req, res) => {
  const db = await connectToDB();
  try {
    const email = req.body.email;
    const password = req.body.password;

    // Check if the login data is valid
    if (!email || !password) {
      return res.status(400).send('Bad Request');
    }

    // Check if the email is already registered
    let user = await db.collection("users").findOne({ email: email });
    if (!user) {
      return res.status(404).send('User not found');
    }

    // Check if the password is correct
    if (user.password !== password) {
      return res.status(401).send('Unauthorized');
    }

    delete user.password;
    delete user.ip_address;

    const token = generateToken({ user });

    res.status(200).json({ token: token });
  } catch (err) {
    res.status(400).json({ message: err.message });
  } finally {
    await db.client.close();
  }
});





router.post('/api/eventnew', upload.single('eventPoster'), async (req, res) => {
  const db = await connectToDB();
  try {
    // Get the file data
    const file = req.file;

    // Get the other form data
    const eventName = req.body.eventName;
    const eventDescription = req.body.eventDescription;
    const eventDateFrom = req.body.eventDateFrom;
    const eventDateTo = req.body.eventDateTo;
    const eventTimeStart = req.body.eventTimeStart;
    const eventTimeEnd = req.body.eventTimeEnd;
    const eventType = req.body.eventType;
    const eventPrice = req.body.eventPrice;
    const eventVenue = req.body.eventVenue;
    const multipleSection = req.body.multipleSection;
    const sectionNumber = req.body.sectionNumber;
    const sections = JSON.parse(req.body.sections);
    const fileExtension = path.extname(file.originalname);
    const newFilename = `${file.originalname}${fileExtension}`;

    // Create a new event
    let eventdata = {
      eventName: eventName,
      eventDateFrom: eventDateFrom,
      eventDateTo: eventDateTo,
      eventTimeStart: eventTimeStart,
      eventTimeEnd: eventTimeEnd,
      eventType: eventType,
      eventPrice: eventPrice,
      eventDescription: eventDescription,
      eventVenue: eventVenue,
      sectionNumber: sectionNumber,
      multipleSection: multipleSection,
      sections: sections,
      eventPoster: file.filename,
      filePath: file.path,
      fileType: file.mimetype,
      createdAt: new Date(),
      modifiedAt: new Date(),

    };

    // Insert the event data into the database
    let result = await db.collection("events").insertOne(eventdata);
    res.status(201).json({ message: 'Event created successfully' });
  } catch (err) {
    res.status(400).json({ message: err.message });
  } finally {
    await db.client.close();
  }
});

router.get('/api/event/detail/:id', async function (req, res) {
  const db = await connectToDB();
  try {
    const eventId = req.params.id;
    const eventdata = await db.collection("events").findOne({ _id: new ObjectId(eventId) });

    // Construct the image URL
    const imageUrl = `${req.protocol}://${req.get('host')}/${eventdata.eventPoster}`;

    console.log('Image URL:', imageUrl);

    // Include the image URL in the response
    eventdata.eventPosterUrl = imageUrl;

    res.status(200).json(eventdata);
  } catch (err) {
    res.status(400).json({ message: err.message });
  } finally {
    await db.client.close();
  }
});

router.get('/api/events', async function (req, res) {
  const db = await connectToDB();
  try {
    let page = parseInt(req.query.page) || 1; // Page Number
    let perPage = parseInt(req.query.perPage) || 6; // Per Page

    // Input validation
    if (page < 1 || perPage < 1) {
      return res.status(400).json({ message: 'Page and perPage must be positive integers.' });
    }

    let skip = (page - 1) * perPage; // Items to skip

    let result = await db
      .collection("events")
      .find()
      .skip(skip)
      .limit(perPage)
      .toArray();

    let total = await db.collection("events").countDocuments();

    res.status(200).json({
      events: result,
      page: page,
      total: total,
      perPage: perPage,
      totalPages: Math.ceil(total / perPage) // Calculate total pages
    });
  } catch (err) {
    console.error('Error fetching events:', err);
    res.status(500).json({ message: 'Internal server error' });
  } finally {
    await db.client.close();
  }
});

module.exports = router;
