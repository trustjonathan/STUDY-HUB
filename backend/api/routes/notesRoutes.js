// backend/api/routes/notesRoutes.js
const express = require("express");
const router = express.Router();

// Controller
const notesController = require("../controllers/notesController");

// Middleware
const authMiddleware = require("../../middleware/authMiddleware");

// ----------------------
// Protected Routes (require authentication)
// ----------------------

// Get all notes
router.get("/", authMiddleware.verifyToken, notesController.getAllNotes);

// Create a note
router.post("/", authMiddleware.verifyToken, notesController.createNote);

// Get note by ID
router.get("/:id", authMiddleware.verifyToken, notesController.getNoteById);

// Update note
router.put("/:id", authMiddleware.verifyToken, notesController.updateNote);

// Delete note
router.delete("/:id", authMiddleware.verifyToken, notesController.deleteNote);

// ----------------------
// Export router
// ----------------------
module.exports = router;