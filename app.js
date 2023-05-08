require("./utils.js");
require("dotenv").config();
const express = require("express");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const bcrypt = require("bcrypt");
const { MongoClient, ObjectId } = require("mongodb");
const Joi = require("joi");
const app = express();
const expireTime = 60 * 60 * 1000;
const saltRounds = 12;
const port = process.env.PORT || 4000;

app.set("view engine", "ejs");

// secrets
const mongodb_host = process.env.MONGODB_HOST;
const atlas_db_user = process.env.ATLAS_DB_USER;
const atlas_db_password = process.env.ATLAS_DB_PASSWORD;
const mongodb_database = process.env.MONGODB_DATABASE;
const mongodb_session_secret = process.env.MONGODB_SESSION_SECRET;
const node_session_secret = process.env.NODE_SESSION_SECRET;

// database
var { database } = include("databaseConnection");
const userCollection = database.db(mongodb_database).collection("users");

app.use(express.urlencoded({ extended: false }));

var mongoStore = MongoStore.create({
  mongoUrl: `mongodb+srv://${atlas_db_user}:${atlas_db_password}@${mongodb_host}/${mongodb_database}?retryWrites=true&w=majority`,
  crypto: {
    secret: mongodb_session_secret,
  },
});

// replace the in-memory array session store with a database session store
app.use(
  session({
    secret: node_session_secret,
    store: mongoStore,
    saveUninitialized: false,
    resave: true,
  })
);

// public routes
app.get("/", (req, res) => {
  const authenticated = req.session.authenticated;
  const username = req.session.username;
  res.render("app", { authenticated, username });
});

app.use(express.static(__dirname + "/public"));

app.get("/members", (req, res) => {
  if (req.session.authenticated) {
    const username = req.session.username;
    res.render("members", { username });
  } else {
    res.redirect("/");
    return;
  }
});

app.get("/signup", (req, res) => {
  res.render("signup");
});

app.post("/submitUser", async (req, res) => {
  var username = req.body.username;
  var password = req.body.password;
  var email = req.body.email;
  const schema = Joi.object({
    username: Joi.string().alphanum().max(20).required(),
    password: Joi.string().max(20).required(),
    email: Joi.string().email().required(),
  });
  if (!email) {
    res.redirect("/signupSubmit?missing=1");
    return;
  }
  if (!username) {
    res.redirect("/signupSubmit?missing=2");
    return;
  }
  if (!password) {
    res.redirect("/signupSubmit?missing=3");
    return;
  }
  const validationResult = schema.validate({ username, password, email });
  if (validationResult.error != null) {
    console.log(validationResult.error);
    res.redirect("/signup");
    return;
  }
  var hashedPassword = await bcrypt.hash(password, saltRounds);
  await userCollection.insertOne({
    username: username,
    password: hashedPassword,
    email: email,
  });
  req.session.username = username;
  console.log("Inserted user");
  req.session.authenticated = true;
  res.redirect("/members");
});

app.get("/signupSubmit", (req, res) => {
  const missingInput = req.query.missing;
  const errorMessages = {
    1: "Email is required",
    2: "Username is required",
    3: "Password is required",
  };

  res.render("signupSubmit", { missingInput, errorMessages });
});

app.get("/login", (req, res) => {
  res.render("login", { errorMessage: null });
});

app.post("/login", async (req, res) => {
  let errorMessage = null;

  try {
    const result = await usersModel.findOne({
      username: req.body.username,
    });

    if (bcrypt.compareSync(req.body.password, result.password)) {
      req.session.GLOBAL_AUTHENTICATED = true;
      req.session.loggedUsername = req.body.username;
      req.session.loggedPassword = req.body.password;
      res.redirect("/");
      return;
    } else {
      errorMessage = "Invalid password.";
    }
  } catch (error) {
    console.log(error);
    errorMessage = "An error occurred.";
  }

  res.render("loginSubmit", { errorMessage: errorMessage });
});

app.post("/loginSubmit", async (req, res) => {
  var password = req.body.password;
  var email = req.body.email;
  const schema = Joi.string().email().required();
  const validationResult = schema.validate(email);
  let errorMessage = null;

  if (validationResult.error != null) {
    errorMessage = "Invalid email format.";
  } else {
    const result = await userCollection
      .find({ email: email })
      .project({ email: 1, password: 1, username: 1, _id: 1, role: 1 })
      .toArray();

    if (result.length != 1) {
      errorMessage = "User not found.";
    } else {
      if (await bcrypt.compare(password, result[0].password)) {
        req.session.authenticated = true;
        req.session.username = result[0].username;
        req.session.role = result[0].role; // Store the user's role in the session
        req.session.cookie.maxAge = expireTime;
        res.redirect("/members");
        return;
      } else {
        errorMessage = "Invalid email/password combination.";
      }
    }
  }

  res.render("login", { errorMessage: errorMessage });
});

app.get("/admin", async (req, res) => {
  console.log("Authenticated:", req.session.authenticated); // Debug output
  console.log("Role:", req.session.role); // Debug output

  if (!req.session.authenticated || req.session.role !== "admin") {
    res.render("notAdmin");
    return;
  }

  const users = await userCollection.find({}).toArray();
  res.render("admin", { users });
});

app.get("/notAdmin", (req, res) => {
  res.render("notAdmin");
});

app.post("/updateRole", async (req, res) => {
  const { userId, role } = req.body;
  await userCollection.updateOne(
    { _id: new ObjectId(userId) },
    { $set: { role: role } }
  );
  res.redirect("/admin");
});

app.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/");
});

app.get("*", (req, res) => {
  res.status(404);
  res.render("404");
});

app.listen(port, () => {
  console.log("Node application listening on port" + port);
});

module.exports = app;
