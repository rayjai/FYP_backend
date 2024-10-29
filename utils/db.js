const { MongoClient, ObjectId } = require('mongodb');

process.env.MONGODB_URI = 'mongodb+srv://rayng:Rayng218%40@rayng218.s609a.mongodb.net/?retryWrites=true&w=majority&appName=rayng218/';

if (!process.env.MONGODB_URI) {
    // throw new Error('Please define the MONGODB_URI environment variable inside .env.local');
    process.env.MONGODB_URI = 'mongodb://localhost:27017';
}

// Connect to MongoDB
async function connectToDB() {
    const client = await MongoClient.connect(process.env.MONGODB_URI);
    const db = client.db('FYP');
    db.client = client;
    return db;
}

module.exports = { connectToDB, ObjectId };