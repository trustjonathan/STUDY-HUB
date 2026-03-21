const express = require("express");
const router = express.Router();

const { askAI } = require("../controllers/aiController");

// POST /api/ai
router.post("/", askAI);

module.exports = router;