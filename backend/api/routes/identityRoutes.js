// backend/api/routes/identityRoutes.js

const express = require('express');
const router = express.Router();

// Controllers
const identityController = require('../controllers/identityController');

// Middleware
const authMiddleware = require('../../middleware/authMiddleware');

// Validators
const { validateRegister, validateLogin } = require('../validators/identityValidator');

// ----------------------
// Public Routes
// ----------------------

router.post('/register', validateRegister, identityController.registerUser);

router.post('/login', validateLogin, identityController.loginUser);

// ----------------------
// Protected Routes
// ----------------------

router.get('/profile', authMiddleware.verifyToken, identityController.getProfile);

router.put('/profile', authMiddleware.verifyToken, identityController.updateProfile);

router.post('/reputation/:userId', identityController.updateReputation);

module.exports = router;