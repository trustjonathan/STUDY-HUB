// backend/src/models/video.model.js
const mongoose = require("mongoose");

const VideoSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String },
    subject: { type: String, required: true },   // e.g. Math, Biology
    classLevel: { type: String, required: true }, // e.g. S.4, S.6, UACE
    thumbnail: { type: String }, // Cloudinary URL
    videoUrl: { type: String, required: true }, // Cloudinary URL
    uploadedBy: { type: String, default: "Anonymous" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Video", VideoSchema);
