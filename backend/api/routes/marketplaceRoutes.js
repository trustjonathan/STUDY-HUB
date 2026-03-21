const express = require('express');
const router = express.Router();
const marketplaceController = require('../api/controllers/marketplaceController');
const authMiddleware = require('../middleware/authMiddleware');
const { validateProduct, validateTransaction } = require('../api/validators/marketplaceValidator');

// ----------------------
// Protected Routes (Authentication required)
// ----------------------

// Products / Marketplace Items
router.post('/products', authMiddleware.verifyToken, authMiddleware.requireRole('Merchant'), validateProduct, marketplaceController.createProduct);
router.get('/products', authMiddleware.verifyToken, marketplaceController.listProducts);
router.get('/products/:productId', authMiddleware.verifyToken, marketplaceController.getProduct);
router.put('/products/:productId', authMiddleware.verifyToken, authMiddleware.requireRole('Merchant'), marketplaceController.updateProduct);
router.delete('/products/:productId', authMiddleware.verifyToken, authMiddleware.requireRole('Merchant'), marketplaceController.deleteProduct);

// Purchases / Transactions
router.post('/purchase', authMiddleware.verifyToken, validateTransaction, marketplaceController.createPurchase);
router.get('/purchases', authMiddleware.verifyToken, marketplaceController.listPurchases);
router.get('/purchases/:purchaseId', authMiddleware.verifyToken, marketplaceController.getPurchase);

// Merchant Dashboard
router.get('/merchant/dashboard', authMiddleware.verifyToken, authMiddleware.requireRole('Merchant'), marketplaceController.getMerchantDashboard);

// Subscriptions & Licensing
router.post('/subscription', authMiddleware.verifyToken, marketplaceController.subscribe);
router.get('/subscription', authMiddleware.verifyToken, marketplaceController.getSubscription);
router.put('/subscription', authMiddleware.verifyToken, marketplaceController.updateSubscription);
router.delete('/subscription', authMiddleware.verifyToken, marketplaceController.cancelSubscription);

// AI-powered Recommendations & Dynamic Pricing
router.get('/recommendations', authMiddleware.verifyToken, marketplaceController.getRecommendations);
router.get('/dynamic-pricing/:productId', authMiddleware.verifyToken, marketplaceController.getDynamicPrice);

// ----------------------
// Export Router
// ----------------------
module.exports = router;