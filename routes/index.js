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
    const role = req.body.role;
    const icon = req.body.icon;

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
      role: role,
      icon: icon,
      access: true,
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
    if (user.access === false) {
      return res.status(403).send('Access denied'); // Forbidden
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

router.delete('/api/event/:id', async (req, res) => {
  const db = await connectToDB();
  const recordId = req.params.id; // Get the record ID from the URL parameters

  try {
      // Convert recordId to ObjectId
      const existingRecord = await db.collection("events").findOne({ _id: new ObjectId(recordId) });
      if (!existingRecord) {
          return res.status(404).json({ message: 'Record not found' });
      }
      console.log('Deleting Record ID:', recordId);

      // Delete the record from the database
      await db.collection("events").deleteOne({ _id: new ObjectId(recordId) });

      res.status(200).json({ message: 'Record deleted successfully' });
  } catch (err) {
      console.error('Error deleting record:', err);
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


router.put('/api/event/:id', upload.single('eventPoster'), async (req, res) => {
  const db = await connectToDB();
  const eventId = req.params.id; // Get the event ID from the URL parameters

  try {
      // Convert eventId to ObjectId
      const existingEvent = await db.collection("events").findOne({ _id: new ObjectId(eventId) }); // Use 'new' here
      if (!existingEvent) {
          return res.status(404).json({ message: 'Event not found' });
      }
      console.log('Event ID:', eventId);
      console.log('Existing Event:', existingEvent);
      
      // Get the file data if a new file was uploaded
      const file = req.file;

      // Get the other form data
      const eventName = req.body.eventName || existingEvent.eventName;
      const eventDescription = req.body.eventDescription || existingEvent.eventDescription;
      const eventDateFrom = req.body.eventDateFrom || existingEvent.eventDateFrom;
      const eventDateTo = req.body.eventDateTo || existingEvent.eventDateTo;
      const eventTimeStart = req.body.eventTimeStart || existingEvent.eventTimeStart;
      const eventTimeEnd = req.body.eventTimeEnd || existingEvent.eventTimeEnd;
      const eventType = req.body.eventType || existingEvent.eventType;
      const eventPrice = req.body.eventPrice || existingEvent.eventPrice;
      const eventVenue = req.body.eventVenue || existingEvent.eventVenue;
      const multipleSection = req.body.multipleSection || existingEvent.multipleSection;
      const sectionNumber = req.body.sectionNumber || existingEvent.sectionNumber;

      // Prepare the updated event data
      const updatedEventData = {
          eventName,
          eventDateFrom,
          eventDateTo,
          eventTimeStart,
          eventTimeEnd,
          eventType,
          eventPrice,
          eventDescription,
          eventVenue,
          sectionNumber,
          multipleSection,
          modifiedAt: new Date(),
      };

      // If a new file was uploaded, update the eventPoster field
      if (file) {
          updatedEventData.eventPoster = file.filename; // Update with new filename
          updatedEventData.filePath = file.path; // Update with new file path
          updatedEventData.fileType = file.mimetype; // Update with new file type
      }

      // Update the event in the database
      await db.collection("events").updateOne({ _id: new ObjectId(eventId) }, { $set: updatedEventData }); // Use 'new' here

      res.status(200).json({ message: 'Event updated successfully' });
  } catch (err) {
      console.error('Error updating event:', err);
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
      .sort({ createdAt: -1 })
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

router.get('/api/homeevent', async function (req, res) {
  const db = await connectToDB();
  try {
    // Fetch the newest three events, sorted by created_at in descending order
    let result = await db
      .collection("events")
      .find()
      .sort({ createdAt: -1 }) // Sort by created_at in descending order
      .limit(3) // Limit to the newest three events
      .toArray();

    res.status(200).json({
      events: result
    });
  } catch (err) {
    console.error('Error fetching home events:', err);
    res.status(500).json({ message: 'Internal server error' });
  } finally {
    await db.client.close();
  }
});
router.get('/api/upcomingevents', async function (req, res) {
  const db = await connectToDB();
  try {
    const currentDate = new Date(); // Get the current date and time
    const formattedCurrentDate = currentDate.toISOString().split('T')[0];

    // Fetch upcoming events where the event date is greater than the current date
    let result = await db
      .collection("events")
      .find({ eventDateFrom: { $gt: formattedCurrentDate } })
      .sort({ eventDateFrom: 1 }) // Sort by eventDate in ascending order
      .toArray();

    res.status(200).json({
      upcomingEvents: result
    });
  } catch (err) {
    console.error('Error fetching upcoming events:', err);
    res.status(500).json({ message: 'Internal server error' });
  } finally {
    await db.client.close();
  }
});
router.get('/api/registrations/:id', async function (req, res) {
  const student_id = req.params.id;

  if (!student_id) {
    return res.status(400).json({ message: 'Student ID is required' });
  }
  const db = await connectToDB();

  try {
    const registrations = await db.collection("registerEvents").find({ student_id }).toArray(); // Convert cursor to array
    res.status(200).json(registrations); // Use 200 OK for successful response
    console.log(registrations); 

  } catch (error) {
    console.error('Error fetching registrations:', error);
    res.status(500).json({ message: 'Internal server error' });
  } finally {
    await db.client.close(); // Ensure the database connection is closed
  }
});
router.get('/api/admincheckregistrations/:id', async function (req, res) {
  const event_id = req.params.id;

  if (!event_id) {
    return res.status(400).json({ message: 'Student ID is required' });
  }
  const db = await connectToDB();

  try {
    const registrations = await db.collection("registerEvents").find({ event_id }).toArray(); // Convert cursor to array
    res.status(200).json(registrations); // Use 200 OK for successful response
    console.log(registrations); 

  } catch (error) {
    console.error('Error fetching registrations:', error);
    res.status(500).json({ message: 'Internal server error' });
  } finally {
    await db.client.close(); // Ensure the database connection is closed
  }
});
router.post('/api/eventregister', upload.single('fpsPaymentPhoto'), async (req, res) => {
  const db = await connectToDB();
  try {
      const student_id = req.body.student_id;
      const selectedSession = req.body.selectedSession;
      const multipleSection = req.body.multipleSection;
      const event_id = req.body.event_id;
      const attendance = req.body.attendance;
      const eventDateFrom = req.body.eventDateFrom; // Changed to match the frontend
      const eventName = req.body.eventName;
      const paymentMethod = req.body.paymentMethod;

      // Optional: Handle uploaded file
      let fpsPaymentPhoto = req.file ? req.file.filename : null; // Get the filename of the uploaded photo

      let registrationData = {
          student_id: student_id,
          selectedSession: selectedSession,
          multipleSection: multipleSection,
          event_id: event_id,
          attendance: attendance,
          eventDateFrom: eventDateFrom,
          eventName: eventName,
          paymentMethod: paymentMethod,
          fpsPaymentPhoto: fpsPaymentPhoto, // Add the photo filename to the registration data
          confirm: false,
          createdAt: new Date(),
          modifiedAt: new Date(),
      };

      let result = await db.collection("registerEvents").insertOne(registrationData);
      res.status(201).json({ id: result.insertedId });
      console.log(result);
  } catch (err) {
      res.status(400).json({ message: err.message });
  } finally {
      await db.client.close();
  }
});
// Assuming you're using Express.js
router.delete('/api/registrations/:student_id/:event_id', async (req, res) => {
  const db = await connectToDB();
  const { student_id, event_id } = req.params;

  try {
      // Find and delete the registration document
      const result = await db.collection("registerEvents").deleteOne({
          student_id: student_id,
          event_id: event_id
      });

      if (result.deletedCount === 0) {
          return res.status(404).json({ message: 'Registration not found' });
      }

      res.status(200).json({ message: 'Registration deleted successfully' });
  } catch (err) {
      console.error('Error deleting registration:', err);
      res.status(500).json({ message: 'Internal Server Error' });
  } finally {
      await db.client.close();
  }
});


router.post('/api/createclub', upload.fields([
  { name: 'poster1' },
  { name: 'poster2' },
  { name: 'poster3' },
  { name: 'webIcon' },
  { name: 'backgroundImage' },
  { name: 'logoImage' },
  { name: 'aboutImage' }
]), async (req, res) => {
  const db = await connectToDB();
  try {
    // Get the file data
    const files = req.files;
    console.log(req.files);

    // Get the other form data
    const clubName = req.body.clubName;
    const description = req.body.description;
    const philosophy = req.body.philosophy;
    const logomeaning = req.body.logomeaning;
    const fpsPaymentNumber = req.body.fpsPaymentNumber;

    // Create a new club data object
    let clubdata = {
      clubName: clubName,
      description: description,
      philosophy: philosophy,
      logomeaning: logomeaning,
      eventPoster1: files.poster1 ? files.poster1[0].filename : null,
      eventPoster2: files.poster2 ? files.poster2[0].filename : null,
      eventPoster3: files.poster3 ? files.poster3[0].filename : null,
      webIcon: files.webIcon ? files.webIcon[0].filename : null,
      backgroundImage: files.backgroundImage ? files.backgroundImage[0].filename : null,
      logoImage: files.logoImage ? files.logoImage[0].filename : null,
      aboutImage: files.aboutImage ? files.aboutImage[0].filename : null,
      fpsPaymentNumber: fpsPaymentNumber,
      createdAt: new Date(),
      modifiedAt: new Date(),
    };

    // Insert the club data into the database
    let result = await db.collection("clubs").insertOne(clubdata);
    res.status(201).json({ message: 'Club created successfully' });
  } catch (err) {
    res.status(400).json({ message: err.message });
  } finally {
    await db.client.close();
  }
});


router.get('/api/homecontent/:id', async function (req, res) {
  const db = await connectToDB();
  try {
    const eventId = req.params.id;
    const eventdata = await db.collection("clubs").findOne({ _id: new ObjectId(eventId) });

    // Construct the image URL
    const imageUrl1 = `${req.protocol}://${req.get('host')}/${eventdata.eventPoster1}`;
    const imageUrl2 = `${req.protocol}://${req.get('host')}/${eventdata.eventPoster2}`;
    const imageUrl3 = `${req.protocol}://${req.get('host')}/${eventdata.eventPoster3}`;


    // Include the image URL in the response
    eventdata.eventPosterUrl1 = imageUrl1;
    eventdata.eventPosterUrl2 = imageUrl2;
    eventdata.eventPosterUrl3 = imageUrl3;


    res.status(200).json(eventdata);
  } catch (err) {
    res.status(400).json({ message: err.message });
  } finally {
    await db.client.close();
  }
});

router.get('/api/club/detail/:id', async function (req, res) {
  const db = await connectToDB();
  try {
    const eventId = req.params.id;
    const eventdata = await db.collection("clubs").findOne({ _id: new ObjectId(eventId) });

 
    res.status(200).json(eventdata);
  } catch (err) {
    res.status(400).json({ message: err.message });
  } finally {
    await db.client.close();
  }
});

router.put('/api/editclubhome/:id', upload.fields([{ name: 'eventPoster1' }, { name: 'eventPoster2' }, { name: 'eventPoster3' }]), async (req, res) => {
  const db = await connectToDB();
  const clubId = req.params.id; // Get the club ID from the URL parameters

  try {
      // Convert clubId to ObjectId
      const existingClub = await db.collection("clubs").findOne({ _id: new ObjectId(clubId) });
      if (!existingClub) {
          return res.status(404).json({ message: 'Club not found' });
      }
      console.log('Club ID:', clubId);
      console.log('Existing Club:', existingClub);
      
      // Get the file data if new files were uploaded
      const files = req.files;

      // Get the other form data
      const description = req.body.description || existingClub.description;

      // Prepare the updated club data
      const updatedClubData = {
          description,
          modifiedAt: new Date(),
      };

      // If new files were uploaded, update the corresponding fields
      if (files) {
          if (files.eventPoster1) {
              updatedClubData.eventPoster1 = files.eventPoster1[0].filename; // Update with new filename
          }
          if (files.eventPoster2) {
              updatedClubData.eventPoster2 = files.eventPoster2[0].filename; // Update with new filename
          }
          if (files.eventPoster3) {
              updatedClubData.eventPoster3 = files.eventPoster3[0].filename; // Update with new filename
          }
      }

      // Update the club in the database
      await db.collection("clubs").updateOne({ _id: new ObjectId(clubId) }, { $set: updatedClubData });

      res.status(200).json({ message: 'Club updated successfully' });
  } catch (err) {
      console.error('Error updating club:', err);
      res.status(400).json({ message: err.message });
  } finally {
      await db.client.close();
  }
});


// Define the route for editing the About Us page
router.put('/api/editaboutus/:id', upload.fields([{ name: 'aboutImage' }, { name: 'logoImage' }]), async (req, res) => {
    const db = await connectToDB();
    const clubId = req.params.id; // Get the club ID from the URL parameters

    try {
        // Convert clubId to ObjectId
        const existingClub = await db.collection("clubs").findOne({ _id: new ObjectId(clubId) });
        if (!existingClub) {
            return res.status(404).json({ message: 'Club not found' });
        }

        // Get the file data if new files were uploaded
        const files = req.files;

        // Get the other form data
        const philosophy = req.body.philosophy || existingClub.philosophy;
        const logoMeaning = req.body.logomeaning || existingClub.logoMeaning;

        // Prepare the updated club data
        const updatedClubData = {
            philosophy,
            logoMeaning,
            modifiedAt: new Date(),
        };

        // If new files were uploaded, update the corresponding fields
        if (files) {
            if (files.aboutImage) {
                updatedClubData.aboutImage = files.aboutImage[0].filename; // Update with new filename
            }
            if (files.logoImage) {
                updatedClubData.logoImage = files.logoImage[0].filename; // Update with new filename
            }
        }

        // Update the club in the database
        await db.collection("clubs").updateOne({ _id: new ObjectId(clubId) }, { $set: updatedClubData });

        res.status(200).json({ message: 'About Us page updated successfully' });
    } catch (err) {
        console.error('Error updating About Us page:', err);
        res.status(400).json({ message: err.message });
    } finally {
        await db.client.close();
    }
});
router.put('/api/editicon/:id', upload.fields([{ name: 'webIcon' }, { name: 'backgroundImage' }]), async (req, res) => {
  const db = await connectToDB();
  const clubId = req.params.id; // Get the club ID from the URL parameters

  try {
      // Convert clubId to ObjectId
      const existingClub = await db.collection("clubs").findOne({ _id: new ObjectId(clubId) });
      if (!existingClub) {
          return res.status(404).json({ message: 'Club not found' });
      }

      // Get the file data if new files were uploaded
      const files = req.files;

    
      // Prepare the updated club data
      const updatedClubData = {
          modifiedAt: new Date(),
      };

      // If new files were uploaded, update the corresponding fields
      if (files) {
          if (files.webIcon) {
              updatedClubData.webIcon = files.webIcon[0].filename; // Update with new filename
          }
          if (files.backgroundImage) {
              updatedClubData.backgroundImage = files.backgroundImage[0].filename; // Update with new filename
          }
      }
      if (req.body.fpsPaymentNumber) {
        updatedClubData.fpsPaymentNumber = req.body.fpsPaymentNumber; // Add FPS payment number to the update
    }
      // Update the club in the database
      await db.collection("clubs").updateOne({ _id: new ObjectId(clubId) }, { $set: updatedClubData });

      res.status(200).json({ message: 'updated successfully' });
  } catch (err) {
      console.error('Error updating page:', err);
      res.status(400).json({ message: err.message });
  } finally {
      await db.client.close();
  }
});


router.get('/api/members', async function (req, res) {
  const db = await connectToDB();
  try {
    // Query to find all users with role 'student'
    let result = await db
      .collection("users")
      .find({ role: 'student' }) // Filter for users with role 'student'
      .project({ english_name: 1, student_id: 1,email:1,gender:1, _id: 1 })
      .sort({ createdAt: -1 }) // Sort by createdAt in descending order
      .toArray();

    // Count the total number of students
    let total = result.length; // Total number of students

    res.status(200).json({
      students: result,
      total: total // Total number of students
    });
  } catch (err) {
    console.error('Error fetching students:', err);
    res.status(500).json({ message: 'Internal server error' });
  } finally {
    await db.client.close();
  }
});
router.get('/api/admins', async function (req, res) {
  const db = await connectToDB();
  try {
      // Perform database query to find users with role 'admin'
      const admins = await db.collection('users').find({ role: 'admin' }).toArray();

      // Respond with the found users
      res.json(admins);
  } catch (error) {
      console.error('Error fetching admins:', error);
      res.status(500).json({ error: 'Internal server error' });
  }
});


router.put('/api/attendance/:eventId/:studentId', async (req, res) => {
  const { eventId, studentId } = req.params; // Get eventId and studentId from the URL parameters
  const { attendance } = req.body; // Get attendance status from the request body

  const db = await connectToDB();
  try {
      // Update the attendance status for the student in the context of the event
      const result = await db.collection('registerEvents').updateOne(
          { event_id: eventId, student_id: studentId }, // Filter by event_id and student_id
          { $set: { attendance: attendance } } // Update the attendance field
      );

      if (result.modifiedCount === 1) {
          res.status(200).json({ message: 'Attendance updated successfully.' });
      } else {
          res.status(404).json({ message: 'Attendance record not found or already confirmed.' });
      }
  } catch (err) {
      console.error('Error updating attendance:', err);
      res.status(500).json({ message: 'Internal server error' });
  } finally {
      await db.client.close();
  }
});


router.post('/api/createpost', upload.fields([
  { name: 'poster1' },
  { name: 'poster2' },
  { name: 'poster3' }
]), async (req, res) => {
  const db = await connectToDB();
  try {
    const files = req.files;
    const title = req.body.title;
    const description = req.body.description;
    const studentid = req.body.student_id;

    let data = {
      title: title,
      description: description,
      student_id: studentid,
      eventPoster1: files.poster1 ? files.poster1[0].filename : null,
      eventPoster2: files.poster2 ? files.poster2[0].filename : null,
      eventPoster3: files.poster3 ? files.poster3[0].filename : null,
      createdAt: new Date(),
      modifiedAt: new Date(),
      likes: [],
      likesCount: 0,
      comments: [], // Initialize comments as an empty array
      commentsCount: 0 // Initialize comments count
    };

    let result = await db.collection("posts").insertOne(data);
    res.status(201).json({ message: 'Post created successfully' });
  } catch (err) {
    res.status(400).json({ message: err.message });
  } finally {
    await db.client.close();
  }
});

router.get('/api/posts', async function (req, res) {
  const db = await connectToDB();
  try {
    let page = parseInt(req.query.page) || 1; // Page Number
    let perPage = parseInt(req.query.perPage) || 6; // Per Page

    // Input validation
    if (page < 1 || perPage < 1) {
      return res.status(400).json({ message: 'Page and perPage must be positive integers.' });
    }

    let skip = (page - 1) * perPage; // Items to skip

    // Use aggregation to join posts with users and calculate comment and like counts
    let result = await db.collection("posts").aggregate([
      {
        $lookup: {
          from: "users", // The name of the users collection
          localField: "student_id", // Field from posts
          foreignField: "student_id", // Field from users
          as: "user" // Output array field
        }
      },
      {
        $unwind: {
          path: "$user", // Unwind the user array
          preserveNullAndEmptyArrays: true // Keep posts without a matching user
        }
      },
      {
        $addFields: {
          commentsCount: { $size: { $ifNull: ["$comments", []] } }, // Count the number of comments
          likesCount: { $size: { $ifNull: ["$likes", []] } } // Count the number of likes (assuming likes is an array)
        }
      },
      {
        $sort: { createdAt: -1 } // Sort by createdAt
      },
      {
        $skip: skip // Skip the specified number of documents
      },
      {
        $limit: perPage // Limit the number of documents returned
      }
    ]).toArray();

    let total = await db.collection("posts").countDocuments();

    res.status(200).json({
      posts: result,
      page: page,
      total: total,
      perPage: perPage,
      totalPages: Math.ceil(total / perPage) // Calculate total pages
    });
  } catch (err) {
    console.error('Error fetching posts:', err);
    res.status(500).json({ message: 'Internal server error' });
  } finally {
    await db.client.close();
  }
});

router.get('/api/post/detail/:id', async function (req, res) {
  const db = await connectToDB();
  try {
    const eventId = req.params.id;
    const eventdata = await db.collection("posts").findOne({ _id: new ObjectId(eventId) });

 
    res.status(200).json(eventdata);
  } catch (err) {
    res.status(400).json({ message: err.message });
  } finally {
    await db.client.close();
  }
});

router.delete('/api/posts/:id', async (req, res) => {
  const postId = req.params.id; // Get the post ID from the request parameters
  const db = await connectToDB();

  try {
      const result = await db.collection('posts').deleteOne({ _id: new ObjectId(postId) });

      if (result.deletedCount === 1) {
          res.status(200).json({ message: 'Post deleted successfully.' });
      } else {
          res.status(404).json({ message: 'Post not found.' });
      }
  } catch (err) {
      console.error('Error deleting post:', err);
      res.status(500).json({ message: 'Internal server error' });
  } finally {
      await db.client.close();
  }
});

router.post('/api/posts/:postId/like/:studentId', async (req, res) => {
  const db = await connectToDB();
  const postId = req.params.postId;
  const studentId = req.params.studentId;

  try {
      // Check if the post exists
      const post = await db.collection('posts').findOne({ _id: new ObjectId(postId) });
      if (!post) {
          return res.status(404).json({ message: 'Post not found.' });
      }

      // Check if the user has already liked the post
      const hasLiked = post.likes && post.likes.some(like => like.studentId === studentId);
      
      if (hasLiked) {
          // If already liked, remove the like
          await db.collection('posts').updateOne(
              { _id: new ObjectId(postId) },
              { $pull: { likes: { studentId: studentId } }, $inc: { likesCount: -1 } }
          );
          // Fetch the updated post to return the new likesCount
          const updatedPost = await db.collection('posts').findOne({ _id: new ObjectId(postId) });
          return res.status(200).json({ message: 'Like removed.', likesCount: updatedPost.likesCount });
      } else {
          // If not liked, add the like
          await db.collection('posts').updateOne(
              { _id: new ObjectId(postId) },
              { $addToSet: { likes: { studentId: studentId } }, $inc: { likesCount: 1 } }
          );
          // Fetch the updated post to return the new likesCount
          const updatedPost = await db.collection('posts').findOne({ _id: new ObjectId(postId) });
          return res.status(200).json({ message: 'Post liked.', likesCount: updatedPost.likesCount });
      }
  } catch (error) {
      console.error('Error liking post:', error);
      res.status(500).json({ message: 'Internal server error' });
  } finally {
      await db.client.close();
  }
});


router.put('/api/editpost/:id', upload.fields([{ name: 'eventPoster1' }, { name: 'eventPoster2' }, { name: 'eventPoster3' }]), async (req, res) => {
  const db = await connectToDB();
  const postId = req.params.id; // Get the club ID from the URL parameters

  try {
      // Convert clubId to ObjectId
      const existingPost = await db.collection("posts").findOne({ _id: new ObjectId(postId) });
      if (!existingPost) {
          return res.status(404).json({ message: 'Post not found' });
      }
      console.log('Post ID:', postId);
      console.log('Existing Post:', existingPost);
      
      // Get the file data if new files were uploaded
      const files = req.files;

      // Get the other form data
      const title = req.body.title || existingPost.title;
      const description = req.body.description || existingPost.description;

      // Prepare the updated club data
      const updatedPostData = {
          title,
          description,
          modifiedAt: new Date(),
      }; 

      // If new files were uploaded, update the corresponding fields
      if (files) {
          if (files.eventPoster1) {
            updatedPostData.eventPoster1 = files.eventPoster1[0].filename; // Update with new filename
          }
          if (files.eventPoster2) {
            updatedPostData.eventPoster2 = files.eventPoster2[0].filename; // Update with new filename
          }
          if (files.eventPoster3) {
            updatedPostData.eventPoster3 = files.eventPoster3[0].filename; // Update with new filename
          }
      }

      // Update the club in the database
      await db.collection("posts").updateOne({ _id: new ObjectId(postId) }, { $set: updatedPostData });

      res.status(200).json({ message: 'Post updated successfully' });
  } catch (err) {
      console.error('Error updating post:', err);
      res.status(400).json({ message: err.message });
  } finally {
      await db.client.close();
  }
});

router.post('/api/posts/:postId/comment', async (req, res) => {
  const db = await connectToDB();
  const postId = req.params.postId;
  const { studentId, comment } = req.body;

  try {
      // Find the post by ID
      const post = await db.collection("posts").findOne({ _id: new ObjectId(postId) });
      if (!post) {
          return res.status(404).json({ message: 'Post not found.' });
      }

      // Create a new comment object
      const newComment = {
        _id: new ObjectId(),
          studentId: studentId,
          comment: comment,
          createdAt: new Date()
      };

      // Update the post by pushing the new comment into the comments array
      await db.collection("posts").updateOne(
          { _id: new ObjectId(postId) },
          { $push: { comments: newComment }, $inc: { commentsCount: 1 } } // Increment commentsCount
      );

      res.status(200).json({ message: 'Comment added successfully.' });
  } catch (error) {
      console.error('Error adding comment:', error);
      res.status(500).json({ message: 'Internal server error' });
  } finally {
      await db.client.close();
  }
});

router.get('/api/users/:studentId', async (req, res) => {
  const studentId = req.params.studentId; // Get the studentId from the request parameters

  const db = await connectToDB();
  try {
      // Fetch the user from the database
      const user = await db.collection('users').findOne({ student_id: studentId });

      if (!user) {
          return res.status(404).json({ message: 'User  not found' });
      }

      // Return the user data (you can customize the fields you want to return)
      res.status(200).json({
          student_id: user.student_id,
          icon: user.icon, // Assuming the user document has an 'icon' field
          english_name: user.english_name // Assuming the user document has an 'english_name' field
      });
  } catch (err) {
      console.error('Error fetching user:', err);
      res.status(500).json({ message: 'Internal server error' });
  } finally {
      await db.client.close();
  }
});

router.put('/api/posts/:postId/comments/:commentId', async (req, res) => {
  const { postId, commentId } = req.params;
  const { comment } = req.body; // The new comment text

  const db = await connectToDB();
  try {
      // Find the post
      const post = await db.collection("posts").findOne({ _id: new ObjectId(postId) });
      if (!post) {
          return res.status(404).json({ message: 'Post not found.' });
      }

      // Find the comment by its ID
      const commentIndex = post.comments.findIndex(c => c._id.toString() === commentId);
      if (commentIndex === -1) {
          return res.status(404).json({ message: 'Comment not found.' });
      }

      // Update the comment text
      post.comments[commentIndex].comment = comment;

      // Update the post with the modified comments array
      await db.collection("posts").updateOne(
          { _id: new ObjectId(postId) },
          { $set: { comments: post.comments } }
      );

      res.status(200).json({ message: 'Comment updated successfully.' });
  } catch (error) {
      console.error('Error updating comment:', error);
      res.status(500).json({ message: 'Internal server error.' });
  }
});

router.delete('/api/posts/:postId/comments/:commentId', async (req, res) => {
  const { postId, commentId } = req.params;

  const db = await connectToDB();
  try {
      // Find the post
      const post = await db.collection("posts").findOne({ _id: new ObjectId(postId) });
      if (!post) {
          return res.status(404).json({ message: 'Post not found.' });
      }

      // Find the comment by its ID
      const commentIndex = post.comments.findIndex(c => c._id.toString() === commentId);
      if (commentIndex === -1) {
          return res.status(404).json({ message: 'Comment not found.' });
      }

      // Remove the comment from the comments array
      post.comments.splice(commentIndex, 1);

      // Decrement the comments count
      await db.collection("posts").updateOne(
          { _id: new ObjectId(postId) },
          { 
              $set: { comments: post.comments }, // Update the comments array
              $inc: { commentsCount: -1 } // Decrement the commentsCount
          }
      );

      res.status(200).json({ message: 'Comment deleted successfully.' });
  } catch (error) {
      console.error('Error deleting comment:', error);
      res.status(500).json({ message: 'Internal server error.' });
  } finally {
      await db.client.close();
  }
});
router.get('/api/members/count', async (req, res) => {
  const db = await connectToDB();
  try {
      // Count documents where role is 'student'
      const count = await db.collection("users").countDocuments({ role: "student" });
      res.status(200).json({ count });
  } catch (error) {
      console.error('Error fetching member count:', error);
      res.status(500).json({ message: 'Internal server error' });
  } finally {
      await db.client.close();
  }
});
router.get('/api/posts/comments/count', async (req, res) => {
  const db = await connectToDB();
  try {
      const posts = await db.collection("posts").find({}).toArray(); // Fetch all posts
      const totalCommentsCount = posts.reduce((total, post) => {
          return total + (post.commentsCount || 0); // Add up commentsCount for each post
      }, 0);
      
      res.status(200).json({ totalCommentsCount }); // Return the total comment count
  } catch (error) {
      console.error('Error fetching total comments count:', error);
      res.status(500).json({ message: 'Internal server error' });
  } finally {
      await db.client.close();
  }
});

router.get('/api/registrations/today/count', async (req, res) => {
  const db = await connectToDB();
  try {
      const today = new Date();
      const startOfDay = new Date(today.setHours(0, 0, 0, 0));
      const endOfDay = new Date(today.setHours(23, 59, 59, 999));

      const count = await db.collection("registerEvents").countDocuments({
          createdAt: {
              $gte: startOfDay,
              $lt: endOfDay
          }
      });

      res.status(200).json({ count }); // Return the count of registrations for today
  } catch (error) {
      console.error('Error fetching today\'s registration count:', error);
      res.status(500).json({ message: 'Internal server error' });
  } finally {
      await db.client.close();
  }
});


router.post('/api/income', async (req, res) => {
  const db = await connectToDB();
  try {
    const { 
      title,
      date,
      category,
      personInCharge, 
      feeItems, 
      remarks, 
      createReceipt, 
      issueDate, 
      billTo, 
      totalAmount 
    } = req.body;

    // Create the income record object
    const incomeRecord = {
      title,
      date: new Date(date), // Ensure date is in the correct format
      category,
      personInCharge,
      feeItems,
      remarks,
      createReceipt,
      issueDate: createReceipt ? new Date(issueDate) : null, // Only include if creating a receipt
      billTo,
      totalAmount: parseFloat(totalAmount), // Ensure total amount is a number
      createdAt: new Date(),
      modifiedAt: new Date()
    };

    // Insert the record into the database
    let result = await db.collection("income_records").insertOne(incomeRecord);
    res.status(201).json({ message: 'Income record saved successfully', id: result.insertedId });
  } catch (err) {
    res.status(400).json({ message: err.message });
  } finally {
    await db.client.close();
  }
});

router.post('/api/expenditure', async (req, res) => {
  const db = await connectToDB();
  try {
    const { 
      title,
      date, 
      category,
      personInCharge, 
      feeItems, 
      remarks,
      totalAmount 
    } = req.body;

    // Create the income record object
    const expenditureRecord = {
      title,
      date: new Date(date), // Ensure date is in the correct format
      category,
      personInCharge,
      feeItems,
      remarks,
      totalAmount: parseFloat(totalAmount), // Ensure total amount is a number
      createdAt: new Date(),
      modifiedAt: new Date()
    };

    // Insert the record into the database
    let result = await db.collection("expenditure_records").insertOne(expenditureRecord);
    res.status(201).json({ message: 'Expenditure record saved successfully', id: result.insertedId });
  } catch (err) {
    res.status(400).json({ message: err.message });
  } finally {
    await db.client.close();
  }
});


router.get('/api/income', async function (req, res) {
  const db = await connectToDB();
  try {
      // Perform database query to find all income records
      const incomeRecords = await db.collection('income_records').find().toArray();

      // Respond with the found income records
      res.json(incomeRecords);
  } catch (error) {
      console.error('Error fetching income records:', error);
      res.status(500).json({ error: 'Internal server error' });
  }
});
router.get('/api/expenditure', async function (req, res) {
  const db = await connectToDB();
  try {
      // Perform database query to find all income records
      const expenditureRecords = await db.collection('expenditure_records').find().toArray();

      // Respond with the found income records
      res.json(expenditureRecords);
  } catch (error) {
      console.error('Error fetching expenditure records:', error);
      res.status(500).json({ error: 'Internal server error' });
  }
});
router.get('/api/income/detail/:id', async function (req, res) {
  const db = await connectToDB();
  try {
    const eventId = req.params.id;
    const eventdata = await db.collection("income_records").findOne({ _id: new ObjectId(eventId) });


    res.status(200).json(eventdata);
  } catch (err) {
    res.status(400).json({ message: err.message });
  } finally {
    await db.client.close();
  }
});
router.get('/api/expenditure/detail/:id', async function (req, res) {
  const db = await connectToDB();
  try {
    const eventId = req.params.id;
    const eventdata = await db.collection("expenditure_records").findOne({ _id: new ObjectId(eventId) });

    res.status(200).json(eventdata);
  } catch (err) {
    res.status(400).json({ message: err.message });
  } finally {
    await db.client.close();
  }
});

router.put('/api/income/detail/:id', async (req, res) => {
  const db = await connectToDB();
  const recordId = req.params.id; // Get the record ID from the URL parameters

  try {
      // Convert recordId to ObjectId
      const existingRecord = await db.collection("income_records").findOne({ _id: new ObjectId(recordId) });
      if (!existingRecord) {
          return res.status(404).json({ message: 'Record not found' });
      }
      console.log('Record ID:', recordId);
      console.log('Existing Record:', existingRecord);

    
      // Get the other form data
      const title = req.body.title || existingRecord.title;
      const date = req.body.date || existingRecord.date;
      const category = req.body.category || existingRecord.category;
      const personInCharge = req.body.personInCharge || existingRecord.personInCharge;
      const feeItems = req.body.feeItems || existingRecord.feeItems;
      const remarks = req.body.remarks || existingRecord.remarks;
      const createReceipt = req.body.createReceipt !== undefined ? req.body.createReceipt : existingRecord.createReceipt;
      const issueDate = req.body.issueDate || existingRecord.issueDate;
      const billTo = req.body.billTo || existingRecord.billTo;
      const totalAmount = req.body.totalAmount || existingRecord.totalAmount;
      const modifiedAt = new Date(); // Update modifiedAt to current date

      // Prepare the updated record data
      const updatedRecordData = {
          title,
          date: new Date(date),
          category,
          personInCharge,
          feeItems,
          remarks,
          createReceipt,
          issueDate,
          billTo,
          totalAmount,
          modifiedAt,
      };

     

      // Update the record in the database
      await db.collection("income_records").updateOne({ _id: new ObjectId(recordId) }, { $set: updatedRecordData });

      res.status(200).json({ message: 'Record updated successfully' });
  } catch (err) {
      console.error('Error updating record:', err);
      res.status(400).json({ message: err.message });
  } finally {
      await db.client.close();
  }
});

router.delete('/api/income/detail/:id', async (req, res) => {
  const db = await connectToDB();
  const recordId = req.params.id; // Get the record ID from the URL parameters

  try {
      // Convert recordId to ObjectId
      const existingRecord = await db.collection("income_records").findOne({ _id: new ObjectId(recordId) });
      if (!existingRecord) {
          return res.status(404).json({ message: 'Record not found' });
      }
      console.log('Deleting Record ID:', recordId);

      // Delete the record from the database
      await db.collection("income_records").deleteOne({ _id: new ObjectId(recordId) });

      res.status(200).json({ message: 'Record deleted successfully' });
  } catch (err) {
      console.error('Error deleting record:', err);
      res.status(400).json({ message: err.message });
  } finally {
      await db.client.close();
  }
});

router.put('/api/expenditure/detail/:id', async (req, res) => {
  const db = await connectToDB();
  const recordId = req.params.id; // Get the record ID from the URL parameters

  try {
      // Convert recordId to ObjectId
      const existingRecord = await db.collection("expenditure_records").findOne({ _id: new ObjectId(recordId) });
      if (!existingRecord) {
          return res.status(404).json({ message: 'Record not found' });
      }
      console.log('Record ID:', recordId);
      console.log('Existing Record:', existingRecord);

    
      // Get the other form data
      const title = req.body.title || existingRecord.title;
      const date = req.body.date || existingRecord.date;
      const category = req.body.category || existingRecord.category;

      const personInCharge = req.body.personInCharge || existingRecord.personInCharge;
      const feeItems = req.body.feeItems || existingRecord.feeItems;
      const remarks = req.body.remarks || existingRecord.remarks;
      const totalAmount = req.body.totalAmount || existingRecord.totalAmount;
      const modifiedAt = new Date(); // Update modifiedAt to current date

      // Prepare the updated record data
      const updatedRecordData = {
          title,
          date: new Date(date),
          category,
          personInCharge,
          feeItems,
          remarks,
          totalAmount,
          modifiedAt,
      };

     

      // Update the record in the database
      await db.collection("expenditure_records").updateOne({ _id: new ObjectId(recordId) }, { $set: updatedRecordData });

      res.status(200).json({ message: 'Record updated successfully' });
  } catch (err) {
      console.error('Error updating record:', err);
      res.status(400).json({ message: err.message });
  } finally {
      await db.client.close();
  }
});

router.delete('/api/expenditure/detail/:id', async (req, res) => {
  const db = await connectToDB();
  const recordId = req.params.id; // Get the record ID from the URL parameters

  try {
      // Convert recordId to ObjectId
      const existingRecord = await db.collection("expenditure_records").findOne({ _id: new ObjectId(recordId) });
      if (!existingRecord) {
          return res.status(404).json({ message: 'Record not found' });
      }
      console.log('Deleting Record ID:', recordId);

      // Delete the record from the database
      await db.collection("expenditure_records").deleteOne({ _id: new ObjectId(recordId) });

      res.status(200).json({ message: 'Record deleted successfully' });
  } catch (err) {
      console.error('Error deleting record:', err);
      res.status(400).json({ message: err.message });
  } finally {
      await db.client.close();
  }
});

router.get('/api/totalincome', async function (req, res) {
  const db = await connectToDB();
  try {
      // Perform database query to find all income records
      const incomeRecords = await db.collection('income_records').find().toArray();

      // Calculate total income
      const totalIncome = incomeRecords.reduce((sum, record) => sum + record.totalAmount, 0);

      // Respond with the total income
      res.json({ totalIncome });
  } catch (error) {
      console.error('Error fetching income records:', error);
      res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/api/income_records', async (req, res) => {
  const db = await connectToDB();

  const { month, year } = req.query;

  // Convert month and year to integers
  const monthInt = parseInt(month, 10);
  const yearInt = parseInt(year, 10);

  // Validate month and year
  if (isNaN(monthInt) || isNaN(yearInt) || monthInt < 1 || monthInt > 12) {
      return res.status(400).json({ error: 'Invalid month or year' });
  }

  try {
      // Create start and end date for the query
      const startDate = new Date(yearInt, monthInt - 1, 1);
      const endDate = new Date(yearInt, monthInt, 1); // Next month, first day

      // Fetch income records within the specified month and year
      const records = await db.collection('income_records').find({
          date: {
              $gte: startDate,
              $lt: endDate,
          },
      }).toArray();

      res.json(records);
  } catch (error) {
      console.error('Error fetching income records:', error);
      res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/api/expenditure_records', async (req, res) => {
  const db = await connectToDB();

  const { month, year } = req.query;

  // Convert month and year to integers
  const monthInt = parseInt(month, 10);
  const yearInt = parseInt(year, 10);

  // Validate month and year
  if (isNaN(monthInt) || isNaN(yearInt) || monthInt < 1 || monthInt > 12) {
      return res.status(400).json({ error: 'Invalid month or year' });
  }

  try {
      // Create start and end date for the query
      const startDate = new Date(yearInt, monthInt - 1, 1);
      const endDate = new Date(yearInt, monthInt, 1); // Next month, first day

      // Fetch income records within the specified month and year
      const records = await db.collection('expenditure_records').find({
          date: {
              $gte: startDate,
              $lt: endDate,
          },
      }).toArray();

      res.json(records);
  } catch (error) {
      console.error('Error fetching expenditure records:', error);
      res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/api/totalexpenditure', async function (req, res) {
  const db = await connectToDB();
  try {
      // Perform database query to find all expenditure records
      const expenditureRecords = await db.collection('expenditure_records').find().toArray();

      // Calculate total expenditure
      const totalExpenditure = expenditureRecords.reduce((sum, record) => sum + record.totalAmount, 0);

      // Respond with the total expenditure
      res.json({ totalExpenditure });
  } catch (error) {
      console.error('Error fetching expenditure records:', error);
      res.status(500).json({ error: 'Internal server error' });
  }
});
router.get('/api/member/detail/:id', async function (req, res) {
  const db = await connectToDB();
  try {
    const eventId = req.params.id;
    const eventdata = await db.collection("users").findOne({ _id: new ObjectId(eventId) });

    res.status(200).json(eventdata);
  } catch (err) {
    res.status(400).json({ message: err.message });
  } finally {
    await db.client.close();
  }
});
router.put('/api/member/detail/:id', async (req, res) => {
  const db = await connectToDB();
  const recordId = req.params.id; // Get the record ID from the URL parameters

  try {
      // Convert recordId to ObjectId
      const existingRecord = await db.collection("users").findOne({ _id: new ObjectId(recordId) });
      if (!existingRecord) {
          return res.status(404).json({ message: 'Record not found' });
      }
      console.log('Record ID:', recordId);
      console.log('Existing Record:', existingRecord);

    
      // Get the other form data
      const english_name = req.body.english_name || existingRecord.english_name;
      const student_id = req.body.student_id || existingRecord.student_id;
      const email = req.body.email || existingRecord.email;
      const password = req.body.password || existingRecord.password;
      const access = req.body.access
      const gender = req.body.gender || existingRecord.gender;
      const modifiedAt = new Date(); // Update modifiedAt to current date

      // Prepare the updated record data
      const updatedRecordData = {
          english_name,
          student_id,
          email,
          password,
          access,
          gender,
          modifiedAt,
      };

     

      // Update the record in the database
      await db.collection("users").updateOne({ _id: new ObjectId(recordId) }, { $set: updatedRecordData });

      res.status(200).json({ message: 'Record updated successfully' });
  } catch (err) {
      console.error('Error updating record:', err);
      res.status(400).json({ message: err.message });
  } finally {
      await db.client.close();
  }
});

router.delete('/api/member/detail/:id', async (req, res) => {
  const db = await connectToDB();
  const recordId = req.params.id; // Get the record ID from the URL parameters

  try {
      // Convert recordId to ObjectId
      const existingRecord = await db.collection("users").findOne({ _id: new ObjectId(recordId) });
      if (!existingRecord) {
          return res.status(404).json({ message: 'Record not found' });
      }
      console.log('Deleting Record ID:', recordId);

      // Delete the record from the database
      await db.collection("users").deleteOne({ _id: new ObjectId(recordId) });

      res.status(200).json({ message: 'Record deleted successfully' });
  } catch (err) {
      console.error('Error deleting record:', err);
      res.status(400).json({ message: err.message });
  } finally {
      await db.client.close();
  }
});

router.get('/api/user/detail/:id', async function (req, res) {
  const db = await connectToDB();
  try {
    const eventId = req.params.id;
    const eventdata = await db.collection("users").findOne({ student_id: eventId  });

    res.status(200).json(eventdata);
  } catch (err) {
    res.status(400).json({ message: err.message });
  } finally {
    await db.client.close();
  }
});
router.put('/api/user/detail/:id', upload.single('icon'), async (req, res) => {
  const db = await connectToDB();
  const recordId = req.params.id; // Get the record ID from the URL parameters

  try {
      // Convert recordId to ObjectId
      const existingRecord = await db.collection("users").findOne({ _id: new ObjectId(recordId) });
      if (!existingRecord) {
          return res.status(404).json({ message: 'Record not found' });
      }
      console.log('Record ID:', recordId);
      console.log('Existing Record:', existingRecord);

    
      // Get the other form data
      const english_name = req.body.english_name || existingRecord.english_name;
      const student_id = req.body.student_id || existingRecord.student_id;
      const email = req.body.email || existingRecord.email;
      const password = req.body.password || existingRecord.password;
      const gender = req.body.gender || existingRecord.gender;
      const modifiedAt = new Date(); // Update modifiedAt to current date

      // Prepare the updated record data
      const updatedRecordData = {
          english_name,
          student_id,
          email,
          password,
          gender,
          modifiedAt,
      };

      if (req.file) {
        updatedRecordData.icon = req.file.filename; // Store the new filename in the record
      }
  

      // Update the record in the database
      await db.collection("users").updateOne({ _id: new ObjectId(recordId) }, { $set: updatedRecordData });

      res.status(200).json({ message: 'Record updated successfully' });
  } catch (err) {
      console.error('Error updating record:', err);
      res.status(400).json({ message: err.message });
  } finally {
      await db.client.close();
  }
});


const Nodemailer = require("nodemailer");

const transport = Nodemailer.createTransport({
  pool: false,
  host: "mh5.comp.hkbu.edu.hk",
  port: 465,
  secure: true, // use TLS
  auth: {
    user: "f1233411",
    pass: "Aa230915098"
  },
  tls: {
    rejectUnauthorized: false // This will ignore certificate errors
  }
});


// Password Reset Request Endpoint
router.post('/api/reset-password', async (req, res) => {
  const db = await connectToDB();

  const { email } = req.body;

  try {
    const user = await db.collection("users").findOne({ email:email });

      if (!user) {
          return res.status(404).json({ message: 'Email not found.' });
      }

      // Send the reset email with user ID
      const resetUrl = `http://localhost:5173/reset-password/${user._id}`;
      await transport.sendMail({
        from: {
          name: 'f1233411',
          address: 'f1233411@comp.hkbu.edu.hk',
        },
        to: email,
        subject: 'Password Reset Request',
        text: `You requested a password reset. Click the link below to reset your password:\n${resetUrl}`,
      });
  
      res.status(200).json({ message: 'Reset email sent.' });
    } catch (error) {
      console.error('Error during password reset:', error);
      res.status(500).json({ message: 'Internal server error.' });
    }
  });
  router.post('/api/finance_category', async (req, res) => {
    const db = await connectToDB();
    try {
        const { code, category, clubId } = req.body;

        // Check if a record with the same code or category already exists
        const existingRecord = await db.collection("finance_categories").findOne({
            $or: [
                { code: code },
                { category: category }
            ]
        });

        if (existingRecord) {
            return res.status(409).json({ message: 'Finance Category with the same code or name already exists.' });
        }

        // Create the finance category object
        const expenditureRecord = {
            code,
            category,
            clubId,
            createdAt: new Date(),
            modifiedAt: new Date()
        };

        // Insert the record into the database
        let result = await db.collection("finance_categories").insertOne(expenditureRecord);
        res.status(200).json({ message: 'Finance Category added successfully', id: result.insertedId });
    } catch (err) {
        res.status(400).json({ message: err.message });
    } finally {
        await db.client.close();
    }
});


  router.get('/api/finance_category', async function (req, res) {
    const db = await connectToDB();
    try {
        // Perform database query to find all income records
        const expenditureRecords = await db.collection('finance_categories').find().toArray();
  
        // Respond with the found income records
        res.json(expenditureRecords);
    } catch (error) {
        console.error('Error fetching expenditure records:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
  });
  router.post('/api/inventory_category', async (req, res) => {
    const db = await connectToDB();
    try {
        const { code, category, clubId } = req.body;

        // Check if a record with the same code or category already exists
        const existingRecord = await db.collection("inventory_categories").findOne({
            $or: [
                { code: code },
                { category: category }
            ]
        });

        if (existingRecord) {
            return res.status(409).json({ message: 'Inventory Category with the same code or name already exists.' });
        }

        // Create the finance category object
        const expenditureRecord = {
            code,
            category,
            clubId,
            createdAt: new Date(),
            modifiedAt: new Date()
        };

        // Insert the record into the database
        let result = await db.collection("inventory_categories").insertOne(expenditureRecord);
        res.status(200).json({ message: 'Inventory Category added successfully', id: result.insertedId });
    } catch (err) {
        res.status(400).json({ message: err.message });
    } finally {
        await db.client.close();
    }
});


  router.get('/api/inventory_category', async function (req, res) {
    const db = await connectToDB();
    try {
        // Perform database query to find all income records
        const expenditureRecords = await db.collection('inventory_categories').find().toArray();
  
        // Respond with the found income records
        res.json(expenditureRecords);
    } catch (error) {
        console.error('Error fetching inventory records:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
  });


const Stripe = require('stripe');

// Initialize Stripe with your secret API key
const stripe = Stripe('sk_test_51QaEexBLfCf3x01sxcKOtGvx4BFnNPgCLfQiUgALOadNDi4Q0tG5hD5j8798QHQWDsoNUy8V11Fz6HKv7AUigHlD009vKXsi09');

// Your domain, adjust as necessary
const YOUR_DOMAIN = 'http://localhost:5173';



router.post('/api/create-checkout-session', async (req, res) => {
  console.log('Received request body:', req.body); // Log the incoming request data

  const { eventName, eventPrice, registrationData, uniqueKey } = req.body;

  // Check if the required fields are present
  if (!eventName || !eventPrice || !registrationData) {
      return res.status(400).json({ error: 'Missing eventName, eventPrice, or registrationData' });
  }

  // Extract registration data fields
  const {
      student_id,
      selectedSession,
      multipleSection,
      event_id,
      attendance,
      eventDateFrom,
  } = registrationData;

  // Log registration data for debugging
  console.log('Registration Data:', registrationData);

  try {
      const session = await stripe.checkout.sessions.create({
          line_items: [
              {
                  price_data: {
                      currency: 'hkd',
                      product_data: {
                          name: eventName,
                      },
                      unit_amount: eventPrice,
                  },
                  quantity: 1,
              },
          ],
          mode: 'payment',
          success_url: `${YOUR_DOMAIN}/success?student_id=${student_id}&event_id=${event_id}&selectedSession=${selectedSession}&multipleSection=${multipleSection}&attendance=${attendance}&eventDateFrom=${eventDateFrom}&eventName=${eventName}&uniqueKey=${uniqueKey}`,
          cancel_url: `${YOUR_DOMAIN}/cancel`,
          automatic_tax: { enabled: true },
      });

      res.json({ url: session.url }); // Return the session URL
  } catch (error) {
      console.error('Error creating checkout session:', error);
      res.status(500).json({ error: 'Internal Server Error' });
  }
});




module.exports = router;
