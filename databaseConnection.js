require("dotenv").config();

const mongodb_host = process.env.MONGODB_HOST;
const mongodb_user = process.env.MONGODB_USER;
const mongodb_password = process.env.MONGODB_PASSWORD;

const MongoClient = require("mongodb").MongoClient;
const atlasURI = `mongodb+srv://${mongodb_user}:${mongodb_password}@${mongodb_host}/?retryWrites=true`;

async function connectDatabase() {
  const client = new MongoClient(atlasURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  try {
    await client.connect();
    console.log("Connected to MongoDB Atlas");
    return client;
  } catch (error) {
    console.error("Error connecting to MongoDB Atlas:", error);
    throw error;
  }
}

module.exports = { connectDatabase };
