const express = require('express');
const router = express.Router();
const authMiddleware = require('../../middleware/authMiddleware');
const controller = require('../controllers/resourceEngagementController');

router.get('/stats', controller.getStats);
router.get('/mine', authMiddleware.verifyToken, controller.getMyEngagement);
router.put('/vote', authMiddleware.verifyToken, controller.saveVote);
router.delete('/vote', authMiddleware.verifyToken, controller.removeVote);
router.put('/bookmark', authMiddleware.verifyToken, controller.saveBookmark);
router.delete('/bookmark', authMiddleware.verifyToken, controller.removeBookmark);

module.exports = router;
