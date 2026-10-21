const express = require('express');
const multer = require('multer');
const router = express.Router();
const authMiddleware = require('../../middleware/authMiddleware');
const controller = require('../controllers/resourceEngagementController');
const uploadController = require('../controllers/resourceUploadController');

const resourceUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 1, fields: 8, fieldSize: 4096 },
});

const SHARE_WINDOW_MS = 60_000;
const MAX_SHARES_PER_WINDOW = 30;
const shareRequestsByAddress = new Map();

function limitShareRequests(req, res, next) {
  const now = Date.now();
  const address = req.ip || req.socket.remoteAddress || 'unknown';
  let entry = shareRequestsByAddress.get(address);

  if (entry && now >= entry.resetAt) {
    shareRequestsByAddress.delete(address);
    entry = null;
  }
  if (!entry && shareRequestsByAddress.size >= 5_000) {
    for (const [key, value] of shareRequestsByAddress) {
      if (now >= value.resetAt) shareRequestsByAddress.delete(key);
    }
    if (shareRequestsByAddress.size >= 5_000) {
      res.set('Retry-After', '60');
      return res.status(429).json({ error: 'Share tracking is busy. Please try again shortly.' });
    }
  }
  if (!entry) {
    entry = { count: 0, resetAt: now + SHARE_WINDOW_MS };
    shareRequestsByAddress.set(address, entry);
  }
  if (entry.count >= MAX_SHARES_PER_WINDOW) {
    res.set('Retry-After', String(Math.ceil((entry.resetAt - now) / 1_000)));
    return res.status(429).json({ error: 'Too many share actions. Please wait a minute.' });
  }
  entry.count += 1;
  return next();
}

router.get('/stats', controller.getStats);
router.get('/mine', authMiddleware.verifyToken, controller.getMyEngagement);
router.put('/vote', authMiddleware.verifyToken, controller.saveVote);
router.delete('/vote', authMiddleware.verifyToken, controller.removeVote);
router.put('/bookmark', authMiddleware.verifyToken, controller.saveBookmark);
router.delete('/bookmark', authMiddleware.verifyToken, controller.removeBookmark);
router.post('/share', limitShareRequests, controller.saveShare);
router.get('/admin/archive/categories', authMiddleware.verifyToken, authMiddleware.isAdmin, uploadController.getCategories);
router.post(
  '/admin/archive/upload',
  authMiddleware.verifyToken,
  authMiddleware.isAdmin,
  (req, res, next) => resourceUpload.single('file')(req, res, (error) => {
    if (!error) return next();
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'Files must be 25 MB or smaller.' });
    }
    if (error instanceof multer.MulterError) {
      return res.status(400).json({ error: 'The upload form is invalid or contains too many fields.' });
    }
    return next(error);
  }),
  uploadController.uploadResource,
);

module.exports = router;
