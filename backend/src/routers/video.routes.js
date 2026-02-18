const express = require("express");
const router = express.Router();
const videoController = require("../controllers/video.controller");
const auth = require("../middleware/auth.middleware");
const upload = require("../middleware/upload.middleware");

// Upload video
router.post("/upload", auth, upload.single("file"), videoController.uploadVideo);

// Get all videos
router.get("/", videoController.getVideos);

module.exports = router;
