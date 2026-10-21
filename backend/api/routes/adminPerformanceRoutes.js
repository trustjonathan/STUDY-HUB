const express = require('express');
const authMiddleware = require('../../middleware/authMiddleware');
const controller = require('../controllers/adminPerformanceController');

const router = express.Router();

router.use(authMiddleware.verifyToken, authMiddleware.isAdmin);
router.get('/metrics', controller.getMetrics);
router.post('/insights', controller.getInsights);

module.exports = router;
