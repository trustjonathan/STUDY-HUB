// backend/api/routes/identityRoutes.js

const express = require('express');
const router = express.Router();

// Controllers
const identityController = require('../controllers/identityController');

// Middleware
const authMiddleware = require('../../middleware/authMiddleware');

// Validators
const { validateRegister, validateLogin, validateProfileUpdate, validatePasswordUpdate } = require('../validators/identityValidator');

// ----------------------
// Public Routes
// ----------------------

router.post('/register', validateRegister, identityController.registerUser);

router.post('/login', validateLogin, identityController.loginUser);

router.post('/google', identityController.googleLogin);

// ----------------------
// Protected Routes
// ----------------------

router.get('/profile', authMiddleware.verifyToken, identityController.getProfile);

router.put('/profile', authMiddleware.verifyToken, validateProfileUpdate, identityController.updateProfile);

router.put('/password', authMiddleware.verifyToken, validatePasswordUpdate, identityController.updatePassword);

router.post('/reputation/:userId', identityController.updateReputation);

module.exports = router;