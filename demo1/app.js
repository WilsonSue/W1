const express = require("express");
const app = express();
const session = require("express-session");
const usersModel = require("./models/w1users");
const bcrypt = require("bcrypt");

var MongoDBStore = require("connect-mongodb-session")(session);

var dbStore = new MongoDBStore({
  uri: "mongodb://127.0.0.1:27017/connect_mongodb_session_test",
  collection: "mySessions",
});

// replace the in-memory array session store with a database session store
app.use(
  session({
    secret: "the secret is sky color is blue ", // bad secret
    store: dbStore,
  })
);

// public routes
app.get("/", (req, res) => {
  res.send("<h1> Hello World </h1>");
});

app.get("/login", (req, res) => {
  res.send(`
    <form action="/login" method="post">
      <input type="text" name="username" placeholder="Enter your username" />
      <input type="password" name="password" placeholder="Enter your password" />
      <input type="submit" value="Login" />
    </form>
  `);
});

// GLOBAL_AUTHENTICATED = false;
app.use(express.urlencoded({ extended: false }));
// built-in middleware function in Express. It parses incoming requests with urlencoded payloads and is based on body-parser.

app.post("/login", async (req, res) => {
  // set a global variable to true if the user is authenticated
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
});

// only for authenticated users
const authenticatedOnly = (req, res, next) => {
  if (!req.session.GLOBAL_AUTHENTICATED) {
    return res.status(401).json({ error: "not authenticated" });
  }
  next(); // allow the next route to run
};
app.use(authenticatedOnly);

app.use(express.static("public"));

app.get("/protectedRoute", (req, res) => {
  const randomImageNumber = Math.floor(Math.random() * 3) + 1;
  const imageName = `00${randomImageNumber}.jpg`;
  HTMLResponse = `
  <h1> Protected Route </h1> 
  <br>
  <img src="${imageName}" />
  `;
  res.send(HTMLResponse);
});

// only for admins
const protectedRouteForAdminsOnlyMiddlewareFunction = async (
  req,
  res,
  next
) => {
  const result = await usersModel.findOne({
    username: req.session.loggedUsername,
  });
  if (result?.type != "administrator") {
    return res.send("<h1> You are not an admin </h1>");
  }
  next(); // allow the next route to run
};
app.use(protectedRouteForAdminsOnlyMiddlewareFunction);

app.get("/protectedRouteForAdminsOnly", (req, res) => {
  res.send("<h1> protectedRouteForAdminsOnly </h1>");
});

module.exports = app;
