const express = require("express");
const mysql = require("mysql2");
const session = require("express-session");
const bcrypt = require("bcrypt");
const axios = require("axios");
require("dotenv").config();

const app = express();
app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: false }));

app.use(session({
  secret: "your_secret_key",
  resave: false,
  saveUninitialized: false,
}));

// Connect to Database
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

db.connect(err => {
  if (err) throw err;
  console.log("Database connected!");
});

// Routes
app.get("/", (req, res) => {
  res.render("home", { user: req.session.user });
});

app.get("/about", (req, res) => {
  res.render("about");
});

// Register
app.get("/register", (req, res) => {
  res.render("register");
});

app.post("/register", async (req, res) => {
    try {
      const { username, password } = req.body;
  
      // Ensure username and password are provided
      if (!username || !password) {
        return res.status(400).send("Username and password are required");
      }
  
      // Hash the password
      const hashedPassword = await bcrypt.hash(password, 10);
  
      // Insert user into the database
      db.query(
        "INSERT INTO users (username, password) VALUES (?, ?)",
        [username, hashedPassword],
        (err) => {
          if (err) {
            console.error("Database Error: ", err);
            if (err.code === "ER_DUP_ENTRY") {
              return res.send("Username already exists. Please choose another.");
            }
            return res.send("Error registering user");
          }
          res.redirect("/login");
        }
      );
    } catch (error) {
      console.error("Error in Registration: ", error);
      res.status(500).send("Internal Server Error");
    }
  });
  

// Login
app.get("/login", (req, res) => {
  res.render("login");
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  db.query("SELECT * FROM users WHERE username = ?", [username], async (err, results) => {
    if (err) return res.send("Database error");
    if (results.length === 0) return res.send("Invalid credentials");

    const user = results[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.send("Invalid credentials");

    req.session.user = user;
    res.redirect("/");
  });
});

// Logout
app.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/");
});

// Search Pets
app.get("/search", (req, res) => {
  if (!req.session.user) return res.send("You must be logged in to search.");
  res.render("search");
});

app.get('/search-results', (req, res) => {
    if (!req.session.user) return res.send("You must be logged in.");
    const query = "%" + req.query.q + "%";
    const type = "%" + req.query.type + "%";
    db.query(
      "SELECT * FROM pets WHERE name LIKE ? AND type LIKE ?",
      [query, type],
      (err, results) => {
        if (err) throw err;
        res.render('search_results', { results });
      }
    );
  });
  

// External API (TheCatAPI)
app.get('/api-pets', async (req, res) => {
    if (!req.session.user) return res.send("You must be logged in.");
    try {
      const response = await axios.get("https://api.thecatapi.com/v1/breeds");
      const apiPets = response.data.slice(0, 10); // Limit to 10
      res.render("api_pets", { apiPets });
    } catch (error) {
      console.error(error);
      res.send("Error fetching API data");
      const response = await axios.get("https://api.thecatapi.com/v1/breeds");
      console.log(response.data); // This will show the API response in the terminal

    }
  });
  



// Our Own API
app.get("/api/my-pets", (req, res) => {
  db.query("SELECT * FROM pets", (err, results) => {
    if (err) return res.status(500).json({ error: "Database error" });
    res.json(results);
  });
});

app.listen(3000, () => console.log("Server running on http://localhost:3000"));
