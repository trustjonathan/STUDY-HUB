// backend/src/models/note.model.js
const mongoose = require("mongoose");

const NoteSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    subject: { type: String, required: true },
    classLevel: { type: String, required: true },
    fileUrl: { type: String, required: true }, // PDF, DOCX, etc.
    uploadedBy: { type: String, default: "Anonymous" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Note", NoteSchema);
