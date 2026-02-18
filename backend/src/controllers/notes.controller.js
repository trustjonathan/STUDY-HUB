const Note = require("../models/note.model");
const cloudinary = require("../config/cloudinary");

// Upload a note
exports.uploadNote = async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ message: "No file uploaded" });

    const uploadResult = await cloudinary.uploader.upload_stream({ resource_type: "auto" }, (error, result) => {
      if (error) return res.status(500).json({ message: error.message });
      return res.json({ url: result.secure_url });
    });

    uploadResult.end(file.buffer);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get all notes
exports.getNotes = async (req, res) => {
  try {
    const notes = await Note.find().sort({ createdAt: -1 });
    res.json(notes);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get single note
exports.getNoteById = async (req, res) => {
  try {
    const note = await Note.findById(req.params.id);
    if (!note) return res.status(404).json({ message: "Note not found" });
    res.json(note);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
