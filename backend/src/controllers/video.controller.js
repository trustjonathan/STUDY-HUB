const Video = require("../models/video.model");
const cloudinary = require("../config/cloudinary");

// Upload a video
exports.uploadVideo = async (req, res) => {
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

// Get all videos
exports.getVideos = async (req, res) => {
  try {
    const videos = await Video.find().sort({ createdAt: -1 });
    res.json(videos);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
