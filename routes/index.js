var express = require('express');
var router = express.Router();
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs'); // Add this line
const QRCode = require('qrcode');

router.use(cors());


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
    const phoneNo = req.body.phoneNo;
    const username = req.body.username;
    const gender = req.body.gender;
    const role = req.body.role;
    const icon = req.body.icon;

    // Check if the registration data is valid
    if (!english_name || !student_id || !email || !password || !gender || !phoneNo || !username) {
      return res.status(400).send('Bad Request');
    }

    // Check if the email is already registered
    let user = await db.collection("users").findOne({ email: email });
    if (user) {
      return res.status(400).send('Email already registered');
    }
    const createdAt = new Date();
    const expiry_date = new Date(createdAt);
    expiry_date.setFullYear(expiry_date.getFullYear() + 1);

    // Create a new user
    let userdata = {
      english_name: english_name,
      student_id: student_id,
      email: email,
      password: password,
      phoneNo: phoneNo,
      gender: gender,
      username: username,
      createdAt: new Date(),
      modifiedAt: new Date(),
      role: role,
      icon: icon,
      access: true,
      expiry_date:expiry_date,
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
    const currentDate = new Date();
    if (user.expiry_date && new Date(user.expiry_date) < currentDate) {
      return res.status(403).send('Account expired'); // Forbidden
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
      const {
          eventName,
          eventDescription,
          eventDateFrom,
          eventDateTo,
          eventTimeStart,
          eventTimeEnd,
          eventType,
          eventPrice,
          eventVenue,
          deadline,
          multipleSection,
          totalmaxRegistration,
          sectionNumber,
          sections // This is now the JSON string
      } = req.body;

      // Parse the sections if they exist
      let parsedSections = [];
      if (multipleSection === 'yes' && sections) {
          try {
              parsedSections = JSON.parse(sections);
          } catch (e) {
              console.error('Error parsing sections:', e);
              return res.status(400).json({ message: 'Invalid sections data' });
          }
      }

      // Create a new event
      const eventdata = {
          eventName,
          eventDateFrom,
          eventDateTo,
          eventTimeStart,
          eventTimeEnd,
          eventType,
          eventPrice,
          eventDescription,
          eventVenue,
          deadline,
          sectionNumber,
          multipleSection,
          totalmaxRegistration,
          eventPoster: file.filename,
          filePath: file.path,
          fileType: file.mimetype,
          createdAt: new Date(),
          modifiedAt: new Date(),
          sections: parsedSections,
          canRegister: true
      };

      // Insert the event data into the database
      const result = await db.collection("events").insertOne(eventdata);
      res.status(201).json({ message: 'Event created successfully' });
  } catch (err) {
      console.error('Error:', err);
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
  const eventId = req.params.id;

  try {
      // Convert eventId to ObjectId
      const existingEvent = await db.collection("events").findOne({ _id: new ObjectId(eventId) });
      if (!existingEvent) {
          return res.status(404).json({ message: 'Event not found' });
      }

      // Debug logs
      console.log('Full request body:', req.body);
      console.log('All keys in request body:', Object.keys(req.body));

      // Get the file data if a new file was uploaded
      const file = req.file;

      // Get the other form data with fallback to existing values
      const {
          eventName = existingEvent.eventName,
          eventDescription = existingEvent.eventDescription,
          eventDateFrom = existingEvent.eventDateFrom,
          eventDateTo = existingEvent.eventDateTo,
          eventTimeStart = existingEvent.eventTimeStart,
          eventTimeEnd = existingEvent.eventTimeEnd,
          eventType = existingEvent.eventType,
          eventPrice = existingEvent.eventPrice,
          eventVenue = existingEvent.eventVenue,
          deadline = existingEvent.deadline,
          multipleSection = existingEvent.multipleSection,
          totalmaxRegistration = existingEvent.totalmaxRegistration,
          sectionNumber = existingEvent.sectionNumber,
          sections = JSON.stringify(existingEvent.sections) // Default to existing sections as JSON string
      } = req.body;

      // Parse sections if they exist
      let parsedSections = existingEvent.sections; // Default to existing sections
      if (multipleSection === 'yes' && req.body.sections) {
          try {
              parsedSections = JSON.parse(sections);
          } catch (e) {
              console.error('Error parsing sections:', e);
              return res.status(400).json({ message: 'Invalid sections data' });
          }
      }

      // Prepare the updated event data
      const updatedEventData = {
          eventName,
          eventDateFrom,
          eventDateTo,
          eventTimeStart,
          eventTimeEnd,
          eventType,
          eventPrice: eventType === 'charged' ? parseFloat(eventPrice) : 0,
          eventDescription,
          eventVenue,
          deadline,
          sectionNumber,
          multipleSection,
          totalmaxRegistration: parseInt(totalmaxRegistration),
          sections: parsedSections,
          modifiedAt: new Date()
      };

      // If a new file was uploaded, update the file-related fields
      if (file) {
          updatedEventData.eventPoster = file.filename;
          updatedEventData.filePath = file.path;
          updatedEventData.fileType = file.mimetype;
      }

      // Debug log before update
      console.log('Data to be updated:', updatedEventData);

      // Update the event in the database
      const result = await db.collection("events").updateOne(
          { _id: new ObjectId(eventId) },
          { $set: updatedEventData }
      );

      if (result.modifiedCount === 0) {
          return res.status(404).json({ message: 'No changes detected or event not found' });
      }

      res.status(200).json({ message: 'Event updated successfully' });
  } catch (err) {
      console.error('Error updating event:', err);
      res.status(500).json({ message: 'Internal server error' });
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
router.get('/api/admincheckregistrations/:id/count', async function (req, res) {
  const event_id = req.params.id;

  if (!event_id) {
      return res.status(400).json({ message: 'Event ID is required' });
  }

  const db = await connectToDB();

  try {
      const totalCount = await db.collection("registerEvents")
          .countDocuments({ event_id });

      res.status(200).json({ totalRegistrations: totalCount });

  } catch (error) {
      console.error('Error counting registrations:', error);
      res.status(500).json({ 
          message: 'Internal server error',
          error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
  } finally {
      await db.client.close();
  }
});
router.patch('/api/event/:id/canRegister', async (req, res) => {
  const db = await connectToDB();
  const eventId = req.params.id;
  const { canRegister } = req.body;

  try {
      await db.collection("events").updateOne(
          { _id: new ObjectId(eventId) },
          { $set: { canRegister } }
      );
      res.status(200).json({ message: 'Registration status updated successfully' });
  } catch (err) {
      res.status(400).json({ message: err.message });
  } finally {
      await db.client.close();
  }
});

router.post('/api/eventregister', upload.single('fpsPaymentPhoto'), async (req, res) => {
  const db = await connectToDB();
  try {
      // Basic registration data
      const student_id = req.body.student_id;
      const event_id = req.body.event_id;
      const attendance = req.body.attendance;
      const eventDateFrom = req.body.eventDateFrom;
      const eventName = req.body.eventName;
      const paymentMethod = req.body.paymentMethod;
      
      // Section-related data
      const selectedSection = req.body.selectedSection || null;
      const sectionName = req.body.sectionName || null;
      const sectionMaxRegistration = req.body.sectionMaxRegistration || null;
      
      // Handle uploaded file
      let fpsPaymentPhoto = req.file ? req.file.filename : null;

      // Build registration data
      let registrationData = {
          student_id: student_id,
          event_id: event_id,
          attendance: false,
          eventDateFrom: eventDateFrom,
          eventName: eventName,
          paymentMethod: paymentMethod,
          fpsPaymentPhoto: fpsPaymentPhoto,
          confirm: false,
          createdAt: new Date(),
          modifiedAt: new Date(),
          // Section data
          sectionData: {
              selectedSection: selectedSection,
              sectionName: sectionName,
              maxRegistration: sectionMaxRegistration ? parseInt(sectionMaxRegistration) : null
          }
      };

      // Only include multipleSection if it exists in the request
      if (req.body.multipleSection) {
          registrationData.multipleSection = req.body.multipleSection;
      }

      // Insert registration
      let result = await db.collection("registerEvents").insertOne(registrationData);
      
      const user = await db.collection("users").findOne({ student_id: student_id });
      if (!user) {
          return res.status(404).json({ message: 'User not found.' });
      }
      const event = await db.collection("events").findOne({ _id: new ObjectId(event_id) });
        if (!event) {
            return res.status(404).json({ message: 'Event not found.' });
        }

        // Create qrData in the same structure as the frontend
      const qrData = JSON.stringify({
        name: user.english_name, // Assuming user has this field
        studentid: student_id,
        email: user.email,
        gender: user.gender // Assuming user has this field
    });

    const qrCodePath = path.join(__dirname, 'qrcodes', `${student_id}_${event_id}.png`);
    fs.mkdirSync(path.dirname(qrCodePath), { recursive: true });

    console.log("Generating QR code...");
    await QRCode.toFile(qrCodePath, qrData);
    console.log("QR code generated successfully.");

    // Send email
    console.log("Sending email...");
        const emailContent = `
        You have successfully registered for the event: ${eventName}.
        Event ID: ${event_id}
        Event Date: ${new Date(eventDateFrom).toLocaleDateString()}
        Venue: ${event.eventVenue} 
        Time: ${event.eventTimeStart} - ${event.eventTimeEnd} 
        Payment Method: ${paymentMethod}

        See you soon!
    `;


      // Step 2: Send the registration confirmation email
      const email = user.email; 

      await transport.sendMail({
        from: {
          name: 'f1233411',
          address: 'f1233411@comp.hkbu.edu.hk',
        },
        to: email,
        subject: 'Event Registration',
        text: emailContent,
        attachments: [
          {
              filename: path.basename(qrCodePath),
              path: qrCodePath,
              cid: 'qrcode' // Optional: to reference in HTML content
          }
      ]
      });

      res.status(201).json({ 
          id: result.insertedId,
          message: 'Registration successful'
      });
      

  } catch (err) {
      console.error('Error in registration:', err);
      res.status(400).json({ 
          message: 'Registration failed',
          error: err.message 
      });
  } finally {
      await db.client.close();
  }
});

router.get('/api/registrations/detail/:id', async function (req, res) {
  const db = await connectToDB();
  try {
    const registrationId = req.params.id;
    
    // Validate ID format
    if (!ObjectId.isValid(registrationId)) {
      return res.status(400).json({ message: 'Invalid registration ID format' });
    }

    const registration = await db.collection("registerEvents").findOne({ 
      _id: new ObjectId(registrationId) 
    });

    if (!registration) {
      return res.status(404).json({ message: 'Registration not found' });
    }

    // Get additional user details
    const user = await db.collection("users").findOne({ 
      student_id: registration.student_id 
    });
    

    // Get event details
    const event = await db.collection("events").findOne({ 
      _id: new ObjectId(registration.event_id) 
    });

    // Combine all data
    const responseData = {
      ...registration,
      user: {
        english_name: user.english_name,
        email: user.email
      },
      event: {
        name: event.eventName,
        date: event.eventDateFrom
      }
    };

    res.status(200).json(responseData);
  } catch (err) {
    console.error('Error fetching registration details:', err);
    res.status(500).json({ message: 'Internal server error' });
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
    const logoMeaning = req.body.logoMeaning;
    const fpsPaymentNumber = req.body.fpsPaymentNumber;

    // Create a new club data object
    let clubdata = {
      clubName: clubName,
      description: description,
      philosophy: philosophy,
      logoMeaning: logoMeaning,
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
      const tagLine = req.body.tagLine || existingClub.tagLine;


      // Prepare the updated club data
      const updatedClubData = {
          tagLine,
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
        const logoMeaning = req.body.logoMeaning || existingClub.logoMeaning;

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
  const { eventId, studentId } = req.params;
  const db = await connectToDB();
  
  try {
    // Check if student is registered for the event
    const registration = await db.collection('registerEvents').findOne({
      event_id: eventId,
      student_id: studentId
    });

    if (!registration) {
      return res.status(404).json({ 
        success: false,
        message: 'Student is not registered for this event',
        code: 'NOT_REGISTERED'
      });
    }

    // If attendance already confirmed
    if (registration.attendance === true) {
      return res.status(208).json({ // 208 Already Reported
        success: true,
        message: 'Attendance was already confirmed',
        code: 'ALREADY_CONFIRMED',
        studentInfo: {
          name: registration.name,
          studentId: registration.student_id,
          email: registration.email
        }
      });
    }

    // Update attendance
    const result = await db.collection('registerEvents').updateOne(
      { event_id: eventId, student_id: studentId },
      { $set: { 
        attendance: true,
        attended_at: new Date()
      }}
    );

    if (result.modifiedCount === 1) {
      res.status(200).json({ 
        success: true,
        message: 'Attendance confirmed successfully',
        code: 'CONFIRMED',
        studentInfo: {
          name: registration.name,
          studentId: registration.student_id,
          email: registration.email
        }
      });
    } else {
      res.status(500).json({ 
        success: false,
        message: 'Failed to update attendance',
        code: 'UPDATE_FAILED'
      });
    }
  } catch (err) {
    console.error('Error updating attendance:', err);
    res.status(500).json({ 
      success: false,
      message: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  } finally {
    await db.client.close();
  }
});

router.get('/api/registration-status/:eventId/:studentId', async (req, res) => {
  const { eventId, studentId } = req.params;
  const db = await connectToDB();
  
  try {
    const registration = await db.collection('registerEvents').findOne({
      event_id: eventId,
      student_id: studentId
    });

    if (!registration) {
      return res.status(200).json({ 
        success: false,
        message: 'Student is not registered for this event',
        code: 'NOT_REGISTERED',
        isConfirmed: false,
        isAttendanceTaken: false,
        studentInfo: null  // Explicitly set to null
      });
    }

    res.status(200).json({
      success: true,
      isConfirmed: registration.confirm === true,
      isAttendanceTaken: registration.attendance === true,
      studentInfo: {
        name: registration.name,
        studentId: registration.student_id,
        email: registration.email,
        gender: registration.gender
      }
    });

  } catch (err) {
    console.error('Error checking registration status:', err);
    res.status(200).json({ 
      success: false,
      message: 'Internal server error',
      code: 'SERVER_ERROR',
      isConfirmed: false,
      isAttendanceTaken: false,
      studentInfo: null
    });
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

      let expiryDate = existingRecord.expiry_date;
      if (req.body.expiry_date) {
          // Parse the date string (format: YYYY-MM-DD)
          const [year, month, day] = req.body.expiry_date.split('-');
          expiryDate = new Date(Date.UTC(year, month - 1, day));
        
      }
      // Get the other form data
      const english_name = req.body.english_name || existingRecord.english_name;
      const student_id = req.body.student_id || existingRecord.student_id;
      const email = req.body.email || existingRecord.email;
      const phoneNo = req.body.phoneNo || existingRecord.phoneNo;
      const password = req.body.password || existingRecord.password;
      const username = req.body.username || existingRecord.username;
      const access = req.body.access
      const gender = req.body.gender || existingRecord.gender;
      const expiry_date = expiryDate
      const modifiedAt = new Date(); // Update modifiedAt to current date

      // Prepare the updated record data
      const updatedRecordData = {
          english_name,
          student_id,
          email,
          phoneNo,
          password,
          username,
          access,
          gender,
          expiry_date,
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
      const phoneNo = req.body.phoneNo || existingRecord.phoneNo;
      const username = req.body.username || existingRecord.username;
      const password = req.body.password || existingRecord.password;
      const gender = req.body.gender || existingRecord.gender;
      const modifiedAt = new Date(); // Update modifiedAt to current date

      // Prepare the updated record data
      const updatedRecordData = {
          english_name,
          student_id,
          email,
          phoneNo,
          username,
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
  router.post('/api/send-verification', async (req, res) => {
    const db = await connectToDB();
  
    const { email,code } = req.body;
  
    try {
      
        await transport.sendMail({
          from: {
            name: 'f1233411',
            address: 'f1233411@comp.hkbu.edu.hk',
          },
          to: email,
          subject: 'Student Club Verification Code',
          text: `You verification code is \n${code}`,
        });
    
        res.status(200).json({ message: 'Verification code sent.' });
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

router.post('/api/notifications', async (req, res) => {
  const db = await connectToDB();
  try {
    const { title, message,expiry_date } = req.body;

    // Create the notification object
    const notification = {
      title,
      message,
      expiry_date,
      createdAt: new Date(),
      modifiedAt: new Date()
    };

    // Insert the notification into the database
    let result = await db.collection("notifications").insertOne(notification);
    res.status(201).json({ message: 'Notification saved successfully', id: result.insertedId });
  } catch (err) {
    res.status(400).json({ message: err.message });
  } finally {
    await db.client.close();
  }
});

router.get('/api/notifications', async (req, res) => {
  const db = await connectToDB();
  try {
    const currentDate = new Date(); // Get the current date

    // Fetch notifications from the database where expiry_date is not later than the current date
    const notifications = await db.collection("notifications")
    .find({ expiry_date: { $gt: currentDate.toISOString().split('T')[0] } })      
    .sort({ createdAt: -1 }) // Sort by createdAt in descending order
    .limit(8) 
    .toArray();

    // Send the notifications as a response
    res.status(200).json(notifications);
  } catch (err) {
    res.status(500).json({ message: err.message });
  } finally {
    await db.client.close();
  }
});
router.delete('/api/notifications/:id', async (req, res) => {
  const db = await connectToDB();
  const notificationId = req.params.id;

  try {
    const result = await db.collection("notifications").deleteOne({ _id: new ObjectId(notificationId) });
    
    if (result.deletedCount === 1) {
      res.status(200).json({ message: 'Notification deleted successfully.' });
    } else {
      res.status(404).json({ message: 'Notification not found.' });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  } finally {
    await db.client.close();
  }
});


router.post('/api/chat', async (req, res) => {
  const { message, financeData } = req.body;
  console.log('Sending message to AI:', message); // Log the message

  // Validate input
  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  // Define the request to the HKBU Llama API
  const url = 'https://genai.hkbu.edu.hk/general/rest/deployments/llama3_1/llama/completion?api-version=20240723';
  const requestBody = {
    max_tokens: 50,
    messages: [
      {
        role: 'user',
        content: message +  `Income: ${JSON.stringify(financeData.income)}, Expenditure: ${JSON.stringify(financeData.expenditure)}`,
      },
  
    ],
    stream: false,
    system: 'You are a helpful assistant.',
  };

  console.log('Request Body:', JSON.stringify(requestBody, null, 2)); // Log request body



  try {
    const response = await axios.post(url, requestBody, {
      headers: {
        'api-key': 'f2f394a2-4e7e-4c24-a3be-927c8dac5fcf', // Use environment variable for API key
        'Content-Type': 'application/json',
      },
    });

    console.log('AI response:', response.data);

  

    const aiReply = response.data.choices && response.data.choices.length > 0
        ? response.data.choices[0].message.content // Correctly access the message content
        : 'No valid response from AI';
    res.json({ reply: aiReply });
  } catch (error) {
    if (error.response) {
      // The request was made and the server responded with a status code
      console.error('Error data:', error.response.data);
      console.error('Error status:', error.response.status);
      console.error('Error headers:', error.response.headers);
      res.status(error.response.status).json({ error: error.response.data });
  } else if (error.request) {
      // The request was made but no response was received
      console.error('No response received:', error.request);
      res.status(500).json({ error: 'No response from chatbot API' });
  } else {
      // Something happened in setting up the request that triggered an Error
      console.error('Error message:', error.message);
      res.status(500).json({ error: 'Failed to communicate with chatbot API' });
  }  }
});

router.post('/api/inventory', async (req, res) => {
  const db = await connectToDB();
  try {
    const { 
      name,
      description, 
      category,
      quantity, 
      purchaseDate, 
      purchasePrice, 
      currentValue,
      location,
      condition,
      remarks 
    } = req.body;

    // Create the inventory record object
    const inventoryRecord = {
      name,
      description,
      category,
      quantity: parseInt(quantity, 10), // Ensure quantity is an integer
      purchaseDate: new Date(purchaseDate), // Ensure date is in the correct format
      purchasePrice: parseFloat(purchasePrice), // Ensure purchase price is a number
      currentValue: parseFloat(currentValue), // Ensure current value is a number
      location,
      condition,
      remarks,
      createdAt: new Date(),
      modifiedAt: new Date()
    };

    // Insert the record into the database
    let result = await db.collection("inventory").insertOne(inventoryRecord);
    res.status(201).json({ message: 'Inventory item saved successfully', id: result.insertedId });
  } catch (err) {
    res.status(400).json({ message: err.message });
  } finally {
    await db.client.close();
  }
});

router.put('/api/inventory/:id', async (req, res) => {
  const db = await connectToDB();
  const { id } = req.params; // Get the ID from the URL parameters
  try {
    const {
      name,
      description,
      category,
      quantity,
      purchaseDate,
      purchasePrice,
      currentValue,
      location,
      condition,
      remarks
    } = req.body;

    // Create the updated inventory record object
    const updatedInventoryRecord = {
      name,
      description,
      category,
      quantity: parseInt(quantity, 10), // Ensure quantity is an integer
      purchaseDate: new Date(purchaseDate), // Ensure date is in the correct format
      purchasePrice: parseFloat(purchasePrice), // Ensure purchase price is a number
      currentValue: parseFloat(currentValue), // Ensure current value is a number
      location,
      condition,
      remarks,
      modifiedAt: new Date() // Update modified date
    };

    // Update the record in the database
    const result = await db.collection("inventory").updateOne(
      { _id: new ObjectId(id) }, // Filter by ID
      { $set: updatedInventoryRecord } // Update the fields
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: 'Inventory item not found' });
    }

    res.status(200).json({ message: 'Inventory item updated successfully' });
  } catch (err) {
    res.status(400).json({ message: err.message });
  } finally {
    await db.client.close();
  }
});

// DELETE - Delete an inventory item
router.delete('/api/inventory/:id', async (req, res) => {
  const db = await connectToDB();
  const { id } = req.params; // Get the ID from the URL parameters
  try {
    // Delete the record from the database
    const result = await db.collection("inventory").deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'Inventory item not found' });
    }

    res.status(200).json({ message: 'Inventory item deleted successfully' });
  } catch (err) {
    res.status(400).json({ message: err.message });
  } finally {
    await db.client.close();
  }
});

router.get('/api/inventory', async function (req, res) {
  const db = await connectToDB();
  try {
      // Perform database query to find all income records
      const incomeRecords = await db.collection('inventory').find().toArray();

      // Respond with the found income records
      res.json(incomeRecords);
  } catch (error) {
      console.error('Error fetching inventory records:', error);
      res.status(500).json({ error: 'Internal server error' });
  }
});
router.get('/api/inventory/detail/:id', async function (req, res) {
  const db = await connectToDB();
  try {
    const eventId = req.params.id;
    const eventdata = await db.collection("inventory").findOne({ _id: new ObjectId(eventId) });



    res.status(200).json(eventdata);
  } catch (err) {
    res.status(400).json({ message: err.message });
  } finally {
    await db.client.close();
  }
});


router.put('/api/registerEvents/:id', async function (req, res) {
  const recordId = req.params.id;
  const { confirm } = req.body;

  if (!recordId) {
    return res.status(400).json({ message: 'Record ID is required' });
  }

  if (confirm === undefined) {
    return res.status(400).json({ message: 'Confirm value is required' });
  }

  const db = await connectToDB();

  try {
    // Check if the record exists before updating
    const existingRecord = await db.collection("registerEvents").findOne({ _id: new ObjectId(recordId) });
    if (!existingRecord) {
      return res.status(404).json({ message: 'No registration found for this ID' });
    }

    const result = await db.collection("registerEvents").updateOne(
      { _id: new ObjectId(recordId) },
      { $set: { confirm: confirm } }
    );

    console.log('Update Result:', result); // Log the result of the update

    if (result.modifiedCount === 0) {
      return res.status(404).json({ message: 'No registration found for this ID' });
    }

    res.status(200).json({ message: 'Registration status updated successfully' });
  } catch (error) {
    console.error('Error updating registration status:', error);
    res.status(500).json({ message: 'Internal server error' });
  } finally {
    await db.client.close();
  }
});

router.put('/api/reset-password/:id', async (req, res) => {
  const db = await connectToDB();
  const recordId = req.params.id; // Get the record ID from the URL parameters

  try {
      // Find the existing record by student_id
      const existingRecord = await db.collection("users").findOne({ _id: new ObjectId(recordId) });
      
      if (!existingRecord) {
          return res.status(404).json({ message: 'Record not found' });
      }
      
      console.log('Record ID:', recordId);
      console.log('Existing Record:', existingRecord);

      const password = req.body.password;

      // Ensure the password is provided
      if (!password) {
          return res.status(400).json({ message: 'Password is required' });
      }
console.log(password);
      // Prepare the updated record data
      const updatedRecordData = {
          password, // You may want to hash the password before saving it
      };

      // Update the record in the database
      await db.collection("users").updateOne({ _id: new ObjectId(recordId) }, { $set: updatedRecordData });

      res.status(200).json({ message: 'Record updated successfully' });
  } catch (err) {
      console.error('Error updating record:', err);
      res.status(500).json({ message: 'Internal server error' }); // Use 500 for server errors
  } finally {
      await db.client.close();
  }
});

// Server-side route
router.post('/api/check-email', async (req, res) => {
  try {
    const db = await connectToDB();

      const { email } = req.body;
      
      // Check if email exists in your database
      const user = await db.collection("users").findOne({ email: email });

      res.json({ exists: !!user });
  } catch (error) {
      console.error('Error checking email:', error);
      res.status(500).json({ error: 'Error checking email' });
  }
});
router.get('/api/student/:id', async function (req, res) {
  const db = await connectToDB();
  try {
    const eventId = req.params.id;
    const eventdata = await db.collection("users").findOne({ student_id: eventId });

    res.status(200).json(eventdata);
  } catch (err) {
    res.status(400).json({ message: err.message });
  } finally {
    await db.client.close();
  }
});

module.exports = router;
