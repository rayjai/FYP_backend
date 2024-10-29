var express = require('express');
var router = express.Router();

/* GET users listing. */
router.get('/', function(req, res, next) {
  res.send('respond with a resource');
});


router.get("/events", async function (req, res, next) {
  const db = await connectToDB();
  try {
    let page = parseInt(req.query.page) || 1; // Page Number
    let perPage = parseInt(req.query.perPage) || 6; // Per Page
    let skip = (page - 1) * perPage; // Items to skip

    let result = await db
      .collection("events")
      .find({ deleted: false })
      .skip(skip)
      .limit(perPage)
      .toArray();

    let total = await db.collection("events").countDocuments({ deleted: false });
    res
      .status(200)
      .json({ events: result, page: page, total: total, perPage: perPage });
  } catch (err) {
    res.status(400).json({ message: err.message });
  } finally {
    await db.client.close();
  }
});

router.post('/events/new', async function (req, res) {
  const db = await connectToDB();
  try {
    req.body.createdAt = new Date();
    req.body.modifiedAt = new Date();

    let result = await db.collection("events").insertOne(req.body);
    res.status(201).json({ message: "Course creation saved to edit page, please submit for pending" });
    console.log(result);
  } catch (err) {
    res.status(400).json({ message: err.message });
  } finally {
    await db.client.close();
  }
});

module.exports = router;
