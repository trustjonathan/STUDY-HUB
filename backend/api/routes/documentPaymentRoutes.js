const express = require('express');
const authMiddleware = require('../../middleware/authMiddleware');
const controller = require('../controllers/documentPaymentController');

const router = express.Router();

router.post('/requests', authMiddleware.verifyToken, controller.submitPayment);
router.get('/mine', authMiddleware.verifyToken, controller.listMyPayments);
router.get('/requests/:id/download', authMiddleware.verifyToken, controller.downloadApprovedPayment);
router.get('/admin/requests', authMiddleware.verifyToken, authMiddleware.isAdmin, controller.listPaymentsForAdmin);
router.get('/admin/requests/:id/delivery-preview', authMiddleware.verifyToken, authMiddleware.isAdmin, controller.previewPaymentDelivery);
router.post('/admin/requests/:id/verify', authMiddleware.verifyToken, authMiddleware.isAdmin, controller.verifyPayment);
router.post('/admin/requests/:id/approve', authMiddleware.verifyToken, authMiddleware.isAdmin, controller.verifyPayment);
router.post('/admin/requests/:id/reject', authMiddleware.verifyToken, authMiddleware.isAdmin, controller.rejectPayment);

module.exports = router;
