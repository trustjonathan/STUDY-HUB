// backend/src/config/multer.js

const multer = require("multer");

const storage = multer.memoryStorage(); // Keep file in RAM before upload

const upload = multer({
  storage,
  limits: {
    fileSize: 200 * 1024 * 1024, // 200MB limit (videos supported)
  },
});

module.exports = upload;
