const { MongoClient, ObjectId } = require('mongodb');

process.env.MONGODB_URI = 'mongodb://rayng218:jaKxoyAVJBCNQUlOXwxnoHKjiZNyEWrCFgyvgB42I1c4IzZLC008YKVD9m0BHMbJhyxbllb81EY9ACDbAp5c2A%3D%3D@rayng218.mongo.cosmos.azure.com:10255/?ssl=true&replicaSet=globaldb&retrywrites=false&maxIdleTimeMS=120000&appName=@rayng218@';

if (!process.env.MONGODB_URI) {
    // throw new Error('Please define the MONGODB_URI environment variable inside .env.local');
    process.env.MONGODB_URI = 'mongodb://localhost:27017';
}

// Connect to MongoDB
async function connectToDB() {
    const client = await MongoClient.connect(process.env.MONGODB_URI);
    const db = client.db('syllabusDB');
    db.client = client;
    return db;
}

module.exports = { connectToDB, ObjectId };