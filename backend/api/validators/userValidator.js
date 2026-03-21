const { body, param, query, validationResult } = require('express-validator');

// ----------------------
// Middleware: Validate Request Results
// ----------------------
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// ----------------------
// Validators
// ----------------------

// 1. User Registration
const registerValidator = [
  body('username')
    .trim()
    .notEmpty().withMessage('Username is required')
    .isLength({ min: 3, max: 30 }).withMessage('Username must be 3-30 characters long'),

  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Must be a valid email'),

  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters long'),

  body('role')
    .optional()
    .isIn(['Guest', 'User', 'Merchant', 'Admin']).withMessage('Invalid role'),

  validateRequest
];

// 2. User Login
const loginValidator = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Must be a valid email'),

  body('password')
    .notEmpty().withMessage('Password is required'),

  validateRequest
];

// 3. Update User Profile
const updateProfileValidator = [
  body('username')
    .optional()
    .isLength({ min: 3, max: 30 }).withMessage('Username must be 3-30 characters long'),

  body('email')
    .optional()
    .isEmail().withMessage('Must be a valid email'),

  body('password')
    .optional()
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters long'),

  validateRequest
];

// 4. Params Validators (like userId in routes)
const userIdParamValidator = [
  param('userId')
    .notEmpty().withMessage('User ID is required')
    .isMongoId().withMessage('Invalid user ID format'),
  validateRequest
];

// ----------------------
// Export Validators
// ----------------------
module.exports = {
  registerValidator,
  loginValidator,
  updateProfileValidator,
  userIdParamValidator
};