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
  body('learnerType')
    .optional()
    .isIn(['student', 'non-student'])
    .withMessage('Choose whether you are a student.'),
  body('educationLevel')
    .optional({ nullable: true })
    .isIn(['university', 'secondary', 'primary', 'nursery'])
    .withMessage('Choose a supported education level.'),
  body('universityCourse')
    .optional({ nullable: true })
    .isString()
    .bail()
    .trim()
    .isLength({ max: 160 })
    .withMessage('University course must be 160 characters or fewer.'),
  body('universityYear')
    .optional({ nullable: true })
    .isInt({ min: 1, max: 8 })
    .withMessage('Choose a university year from 1 to 8.')
    .toInt(),
  body('secondaryTrack')
    .optional({ nullable: true })
    .isIn(['O-Level', 'A-Level'])
    .withMessage('Choose O-Level or A-Level.'),
  body('learnerType')
    .optional()
    .custom((value, { req }) => {
      if (value === 'non-student') {
        return !req.body.educationLevel
          && !req.body.classLevel
          && !req.body.universityCourse
          && !req.body.universityYear
          && !req.body.secondaryTrack
          && (!Array.isArray(req.body.subjects) || req.body.subjects.length === 0);
      }
      if (value !== 'student') return true;

      const { educationLevel, classLevel, universityCourse, universityYear, secondaryTrack } = req.body;
      if (!['university', 'secondary', 'primary', 'nursery'].includes(educationLevel)) return false;
      if (educationLevel === 'university') {
        return typeof universityCourse === 'string'
          && universityCourse.trim().length > 0
          && Number.isInteger(universityYear)
          && universityYear >= 1
          && universityYear <= 8
          && !classLevel
          && !secondaryTrack;
      }
      if (educationLevel === 'secondary') {
        const isOLevel = secondaryTrack === 'O-Level' && /^S\.[1-4]$/.test(classLevel || '');
        const isALevel = secondaryTrack === 'A-Level' && /^S\.[5-6]$/.test(classLevel || '');
        return (isOLevel || isALevel)
          && Array.isArray(req.body.subjects)
          && req.body.subjects.length > 0
          && !universityCourse
          && !universityYear;
      }
      if (educationLevel === 'primary') return /^P\.[1-7]$/.test(classLevel || '') && !secondaryTrack;
      return ['Baby Class', 'Top Class', 'Middle Class'].includes(classLevel) && !secondaryTrack;
    })
    .withMessage('Complete the required education and class details for your learner type.'),
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

const validatePasswordUpdate = [
  body('currentPassword')
    .isString()
    .withMessage('Current password is required.')
    .bail()
    .notEmpty()
    .withMessage('Current password is required.')
    .bail()
    .custom((value) => Buffer.byteLength(value, 'utf8') <= 72)
    .withMessage('Password must be 72 bytes or fewer.'),
  body('newPassword')
    .isString()
    .withMessage('New password is required.')
    .bail()
    .isLength({ min: 6 })
    .withMessage('New password must be at least 6 characters.')
    .bail()
    .custom((value) => Buffer.byteLength(value, 'utf8') <= 72)
    .withMessage('Password must be 72 bytes or fewer.'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    next();
  }
];

module.exports = {
  validateRegister,
  validateLogin,
  validateProfileUpdate,
  validatePasswordUpdate
};