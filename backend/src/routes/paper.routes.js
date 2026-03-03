const express = require("express");
const router = express.Router();
const paperController = require("../controllers/paper.controller");
const auth = require("../middleware/auth.middleware");
const upload = require("../middleware/upload.middleware");

// Upload paper
router.post("/upload", auth, upload.single("file"), paperController.uploadPaper);

// Get all papers
router.get("/", paperController.getPapers);

module.exports = router;
