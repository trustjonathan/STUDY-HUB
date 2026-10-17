const express = require("express");
const { handler, listHandler } = require("../controllers/lessonGuide.controller");
const memoryController = require("../controllers/aiStudyMemory.controller");
const authMiddleware = require("../../middleware/authMiddleware");

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

function optionalAuth(req, res, next) {
  const authorization = req.headers.authorization || req.headers.Authorization;
  if (!authorization) return next();
  return authMiddleware.verifyToken(req, res, () => {
    if (!Number.isSafeInteger(req.user?.id) || req.user.id < 1) {
      return res.status(401).json({ error: 'Your account session is invalid. Please sign in again.' });
    }
    return next();
  });
}

router.get("/memory/export", authMiddleware.verifyToken, memoryController.exportMemory);
router.delete("/memory", authMiddleware.verifyToken, memoryController.deleteMemory);
router.get("/", listHandler);
router.post("/", optionalAuth, limitRequests, handler);

module.exports = router;
