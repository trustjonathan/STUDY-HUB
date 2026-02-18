const multer = require("multer");
const path = require("path");

// Allow only valid file formats
const allowedTypes = ["image/jpeg", "image/png", "image/jpg", "application/pdf", "video/mp4"];

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Unsupported file type"), false);
  }
};

const upload = multer({ storage, fileFilter });

module.exports = upload;
