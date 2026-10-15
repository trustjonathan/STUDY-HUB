// backend/api/validators/identityValidator.js

const { body, validationResult } = require('express-validator');
const { allowedSubjectSet, allowedClassSet, subjectLevels, levelsForClass } = require('../constants/learningProfile');

// Validate registration input
const validateRegister = [
  body('username')
    .trim()
    .notEmpty()
    .withMessage('Username is required')
    .isLength({ max: 80 })
    .withMessage('Name must be 80 characters or fewer'),
  body('email')
    .trim()
    .isEmail()
    .withMessage('Valid email is required')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters')
    .bail()
    .custom((value) => Buffer.byteLength(value, 'utf8') <= 72)
    .withMessage('Password must be 72 bytes or fewer'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  }
];

// Validate login input
const validateLogin = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('Valid email is required')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .bail()
    .custom((value) => Buffer.byteLength(value, 'utf8') <= 72)
    .withMessage('Password must be 72 bytes or fewer'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  }
];

const validateProfileUpdate = [
  body('classLevel')
    .optional({ nullable: true })
    .isString()
    .bail()
    .custom((value) => value === '' || allowedClassSet.has(value))
    .withMessage('Choose a class or level from the Study Hub library.'),
  body('subjects')
    .optional()
    .isArray({ max: allowedSubjectSet.size })
    .bail()
    .custom((values, { req }) => {
      const levels = levelsForClass(req.body.classLevel);
      return new Set(values).size === values.length
        && values.every((value) => allowedSubjectSet.has(value))
        && (!levels || values.every((value) => subjectLevels.get(value)?.some((level) => levels.includes(level))));
    })
    .withMessage('Choose only available Study Hub subjects.'),
  body('onboardingComplete')
    .optional()
    .isBoolean()
    .withMessage('The onboarding status must be a boolean.')
    .toBoolean(),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  }
];

module.exports = {
  validateRegister,
  validateLogin,
  validateProfileUpdate
};