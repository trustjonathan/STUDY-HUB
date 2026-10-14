const express = require("express");
const { handler, listHandler } = require("../controllers/lessonGuide.controller");

const router = express.Router();
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 12;
const requestsByAddress = new Map();

function limitRequests(req, res, next) {
  const now = Date.now();
  const address = req.ip || req.socket.remoteAddress || "unknown";
  let entry = requestsByAddress.get(address);

  if (!entry || now >= entry.resetAt) {
    entry = { count: 0, resetAt: now + WINDOW_MS };
    requestsByAddress.set(address, entry);
  }

  if (requestsByAddress.size > 5_000) {
    for (const [key, value] of requestsByAddress) {
      if (now >= value.resetAt) requestsByAddress.delete(key);
    }
  }

  if (entry.count >= MAX_REQUESTS_PER_WINDOW) {
    res.set("Retry-After", String(Math.ceil((entry.resetAt - now) / 1_000)));
    return res.status(429).json({ error: "Too many study guide requests. Please wait a minute." });
  }

  entry.count += 1;
  return next();
}

router.get("/", listHandler);
router.post("/", limitRequests, handler);

module.exports = router;
