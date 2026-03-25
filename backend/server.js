require("dotenv").config()

const express = require("express")
const cors = require("cors")
const morgan = require("morgan")
const { google } = require("googleapis")

const app = express()

// Middleware
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(morgan("dev"))

// Routes
const identityRoutes = require("./api/routes/identityRoutes")
const notesRoutes = require("./api/routes/notesRoutes")
const aiTutorRoutes = require("./api/routes/aiTutor.routes.js")

let quizRoutes
let timetableRoutes

try { quizRoutes = require("./api/routes/quizRoutes") }
catch (err) { console.warn("quizRoutes not found yet") }

try { timetableRoutes = require("./api/routes/timetableRoutes") }
catch (err) { console.warn("timetableRoutes not found yet") }

app.use("/api/auth", identityRoutes)
app.use("/api/notes", notesRoutes)
app.use("/api/bio-gpt", aiTutorRoutes)

if (quizRoutes) app.use("/api/quizzes", quizRoutes)
if (timetableRoutes) app.use("/api/timetable", timetableRoutes)

// Health Check
app.get("/", (req, res) => {
   res.json({ status: "Study Hub Backend Running" })
})

// Error Handler
app.use((err, req, res, next) => {
   console.error("Server Error:", err)
   res.status(err.status || 500).json({ error: err.message })
})

// Google OAuth
const oauth2Client = new google.auth.OAuth2(
   process.env.GOOGLE_CLIENT_ID,
   process.env.GOOGLE_CLIENT_SECRET,
   process.env.GOOGLE_REDIRECT_URI
)

// Start Server
const PORT = process.env.PORT || 4000
app.listen(PORT, () => {
   console.log(`🚀 Study Hub server running on port ${PORT}`)
})