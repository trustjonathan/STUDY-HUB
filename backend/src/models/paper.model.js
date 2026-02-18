// backend/src/models/paper.model.js
const mongoose = require("mongoose");

const PaperSchema = new mongoose.Schema(
  {
    year: { type: Number, required: true },
    subject: { type: String, required: true },
    fileUrl: { type: String, required: true }, // PDF
    type: { type: String, default: "Past Paper" }, // PLE, UCE, UACE
    uploadedBy: { type: String, default: "Anonymous" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Paper", PaperSchema);
