require("dotenv").config()

const express = require("express")
const cors = require("cors")
const morgan = require("morgan")

const app = express()

/* -----------------------------
   GLOBAL MIDDLEWARE
----------------------------- */

app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(morgan("dev"))

/* -----------------------------
   ROUTES
----------------------------- */

const identityRoutes = require("./api/routes/identityRoutes")
const notesRoutes = require("./api/routes/notesRoutes")

// Optional modules (add when ready)
let quizRoutes
let timetableRoutes

try {
   quizRoutes = require("./api/routes/quizRoutes")
} catch (err) {
   console.warn("quizRoutes not found yet")
}

try {
   timetableRoutes = require("./api/routes/timetableRoutes")
} catch (err) {
   console.warn("timetableRoutes not found yet")
}

app.use("/api/auth", identityRoutes)
app.use("/api/notes", notesRoutes)

if (quizRoutes) app.use("/api/quizzes", quizRoutes)
if (timetableRoutes) app.use("/api/timetable", timetableRoutes)

/* -----------------------------
   HEALTH CHECK
----------------------------- */

app.get("/", (req, res) => {
   res.json({
      status: "Study Hub Backend Running",
      version: "1.0",
      message: "API operational"
   })
})

/* -----------------------------
   GLOBAL ERROR HANDLER
----------------------------- */

app.use((err, req, res, next) => {
   console.error("Server Error:", err)

   res.status(err.status || 500).json({
      error: err.message || "Internal Server Error"
   })
})

/* -----------------------------
   SERVER
----------------------------- */

const PORT = process.env.PORT || 4000

app.listen(PORT, () => {
   console.log(`🚀 Study Hub server running on port ${PORT}`)
})

import aiTutorRoutes from "./api/routes/aiTutor.routes.js";

app.use("/api/bio-gpt", aiTutorRoutes);

const oauth2Client = new google.auth.OAuth2(
   process.env.GOOGLE_CLIENT_ID,
   process.env.GOOGLE_CLIENT_SECRET,
   process.env.GOOGLE_REDIRECT_URI
);