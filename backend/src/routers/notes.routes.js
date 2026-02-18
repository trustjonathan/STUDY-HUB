const express = require("express");
const router = express.Router();
const noteController = require("../controllers/notes.controller");
const auth = require("../middleware/auth.middleware");
const upload = require("../middleware/upload.middleware");

// Upload a note (protected)
router.post("/upload", auth, upload.single("file"), noteController.uploadNote);

// Get all notes
router.get("/", noteController.getNotes);

// Get single note
router.get("/:id", noteController.getNoteById);

module.exports = router;
