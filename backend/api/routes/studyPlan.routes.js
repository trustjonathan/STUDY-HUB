const express = require('express');
const authMiddleware = require('../../middleware/authMiddleware');
const controller = require('../controllers/studyPlan.controller');

const router = express.Router();
const WINDOW_MS = 60_000;
const MAX_AI_REQUESTS = 8;
const requestsByUser = new Map();

function limitAiRequests(req, res, next) {
  const userId = req.user?.id;
  const now = Date.now();
  let entry = requestsByUser.get(userId);
  if (!entry || now >= entry.resetAt) {
    entry = { count: 0, resetAt: now + WINDOW_MS };
    requestsByUser.set(userId, entry);
  }
  if (requestsByUser.size > 5_000) {
    for (const [id, request] of requestsByUser) {
      if (now >= request.resetAt) requestsByUser.delete(id);
    }
  }
  if (entry.count >= MAX_AI_REQUESTS) {
    res.set('Retry-After', String(Math.ceil((entry.resetAt - now) / 1_000)));
    return res.status(429).json({ error: 'Study plan AI is being used quickly. Please wait a minute and try again.' });
  }
  entry.count += 1;
  return next();
}

router.use(authMiddleware.verifyToken);
router.get('/', controller.getPlan);
router.post('/', limitAiRequests, controller.generatePlan);
router.put('/chat', limitAiRequests, controller.adjustPlan);
router.post('/complete', controller.completeTopic);
router.post('/recommend-resources', limitAiRequests, controller.recommendResources);

module.exports = router;
