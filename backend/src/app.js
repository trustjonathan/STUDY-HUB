const express = require("express");
const cors = require("cors");
const app = express();
const path = require("path");

// Load ENV variables
require("dotenv").config();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api/auth", require("./routes/auth.routes"));
app.use("/api/notes", require("./routes/notes.routes"));
app.use("/api/papers", require("./routes/paper.routes"));
app.use("/api/videos", require("./routes/video.routes"));

// Health check route
app.get("/", (req, res) => {
  res.json({ message: "Study Hub API is running..." });
});

module.exports = app;
