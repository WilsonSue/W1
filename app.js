require("./utils.js");
require("dotenv").config();
const express = require("express");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const bcrypt = require("bcrypt");
const Joi = require("joi");
const app = express();
const expireTime = 60 * 60 * 1000;
const saltRounds = 12;
const port = process.env.PORT || 4000;

var MongoDBStore = require("connect-mongodb-session")(session);

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
  if (!req.session.authenticated) {
    var noLoginHomePage = `
    <h1>Home Page</h1>
    <button><a href='/login' style="text-decoration:none" >Login</a></button>
    <button><a href='/signup' style="text-decoration:none">Signup</a></button>
    `;
    res.send(noLoginHomePage);
    return;
  } else {
    var username = req.session.username;
    var loggedinHomePage = `
    Hello, ${username}!<br>
    <button><a href='/members' style="text-decoration:none" >Go to Members Area</a></button><br>
    <button><a href='/logout' style="text-decoration:none" >Logout</a></button>
    `;
    res.send(loggedinHomePage);
    return;
  }
});

app.use(express.static(__dirname + "/public"));

app.get("/members", (req, res) => {
  if (req.session.authenticated) {
    const randomImageNumber = Math.floor(Math.random() * 3) + 1;
    const imageName = `00${randomImageNumber}.jpg`;
    const username = req.session.username;
    HTMLResponse = `
  <h2>Hello, ${username}!</h2>
  <br>
  <div><img src="${imageName}" /><div>
  <br><button><a href='/logout' style="text-decoration:none" >Sign out</a></button>
  `;
    res.send(HTMLResponse);
    return;
  } else {
    res.redirect("/");
    return;
  }
});

app.get("/signup", (req, res) => {
  var html = `
  create user
  <form action='/submitUser' method='POST'>
    <input name='username' type='text' placeholder='name'><br>
    <input name='email' type='text' placeholder='email'><br>
    <input name='password' type='password' placeholder='password'><br>
    <button>Submit</button>
  </form>
  `;
  res.send(html);
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
  var missingInput = req.query.missing;
  var html = "";
  if (missingInput == 1) {
    html = "<br>Email is required<br><a href='/signup'>Try again</a>";
  } else if (missingInput == 2) {
    html = "<br>Username is required<br><a href='/signup'>Try again</a>";
  } else if (missingInput == 3) {
    html = "<br>Password is required<br><a href='/signup'>Try again</a>";
  }
  res.send(html);
});

app.get("/login", (req, res) => {
  var html = `
  log in
  <form action='/loginSubmit' method='POST'>
    <input name='email' type='text' placeholder='email'><br>
    <input name='password' type='password' placeholder='password'><br>
    <button>Submit</button>
  </form>
  `;
  res.send(html);
});

app.post("/login", async (req, res) => {
  // set a global variable to true if the user is authenticated
  try {
    const result = await usersModel.findOne({
      username: req.body.username,
    });

    if (bcrypt.compareSync(req.body.password, result.password)) {
      req.session.GLOBAL_AUTHENTICATED = true;
      req.session.loggedUsername = req.body.username;
      req.session.loggedPassword = req.body.password;
      res.redirect("/");
    } else {
      res.send("invalid password");
    }
  } catch (error) {
    console.log(error);
  }
});

app.post("/loginSubmit", async (req, res) => {
  var password = req.body.password;
  var email = req.body.email;
  const schema = Joi.string().email().required();
  const validationResult = schema.validate(email);
  if (validationResult.error != null) {
    console.log(validationResult.error);
    res.redirect("/login");
    return;
  }
  const result = await userCollection
    .find({ email: email })
    .project({ email: 1, password: 1, username: 1, _id: 1 })
    .toArray();
  console.log(result);
  if (result.length != 1) {
    console.log("user not found");
    res.redirect("/login");
    return;
  }
  if (await bcrypt.compare(password, result[0].password)) {
    console.log("correct password");
    console.log(result[0].username);
    req.session.authenticated = true;
    req.session.username = result[0].username;
    req.session.cookie.maxAge = expireTime;
    res.redirect("/members");
    return;
  } else {
    console.log("incorrect password");
    res.send(
      "Invalid email/password combination<br><br><a href='/login'>Try again</a>"
    );
    return;
  }
});

app.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/");
});

// ---------------404 page-------------------
// If the user tries to access a page that doesn't exist,
// send back an appropriate message saying that the page was not found.
app.get("*", (req, res) => {
  res.status(404);
  res.send("Page not found - 404");
});

app.listen(port, () => {
  console.log("Node application listening on port" + port);
});

module.exports = app;
