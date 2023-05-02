require("dotenv").config();

const mongodb_host = process.env.MONGODB_HOST;
const atlas_db_user = process.env.ATLAS_DB_USER;
const atlas_db_password = process.env.ATLAS_DB_PASSWORD;

const MongoClient = require("mongodb").MongoClient;
const atlasURI = `mongodb+srv://${atlas_db_user}:${atlas_db_password}@${mongodb_host}/?retryWrites=true`;
var database = new MongoClient(atlasURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
module.exports = { database };
