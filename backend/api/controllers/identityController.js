// backend/api/controllers/identityController.js

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../../database/models/postgres/user');
const { auth } = require('../../config');

const accountServiceUnavailable = (res) => res.status(503).json({
  error: 'The account service is not configured yet. Please try again later.'
});

const createSessionToken = (user) => jwt.sign(
  { id: user.id, userId: user.id, role: user.role },
  auth.jwtSecret,
  { expiresIn: auth.tokenExpiry }
);

const publicUser = (user) => ({
  id: user.id,
  username: user.username,
  email: user.email,
  role: user.role,
  reputation: user.reputation,
  classLevel: user.classLevel || null,
  subjects: Array.isArray(user.subjects) ? user.subjects : [],
  onboardingComplete: user.onboardingComplete === true
});

// ----------------------
// Register a new user
// ----------------------
const registerUser = async (req, res) => {
  try {
    if (!auth.jwtSecret) return accountServiceUnavailable(res);

    const { username, email, password } = req.body;

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      username: username.trim(),
      email,
      password: passwordHash
    });
    const token = createSessionToken(user);

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: publicUser(user)
    });

  } catch (err) {
    console.error('Register Error:', err);
    res.status(500).json({ error: 'Server error during registration' });
  }
};

// ----------------------
// Login user
// ----------------------
const loginUser = async (req, res) => {
  try {
    if (!auth.jwtSecret) return accountServiceUnavailable(res);

    const { email, password } = req.body;

    const user = await User.findOne({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = createSessionToken(user);

    res.json({
      message: 'Login successful',
      token,
      user: publicUser(user)
    });

  } catch (err) {
    console.error('Login Error:', err);
    res.status(500).json({ error: 'Server error during login' });
  }
};

// ----------------------
// Get user profile
// ----------------------
const getProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      ...publicUser(user)
    });

  } catch (err) {
    console.error('GetProfile Error:', err);
    res.status(500).json({ error: 'Server error fetching profile' });
  }
};

// ----------------------
// Update profile
// ----------------------
const updateProfile = async (req, res) => {
  try {
    const { username, email, classLevel, subjects, onboardingComplete } = req.body;

    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.username = username || user.username;
    user.email = email || user.email;
    if (Object.hasOwn(req.body, 'classLevel')) user.classLevel = classLevel || null;
    if (Object.hasOwn(req.body, 'subjects')) user.subjects = subjects;
    if (Object.hasOwn(req.body, 'onboardingComplete')) user.onboardingComplete = onboardingComplete;

    await user.save();

    res.json({
      message: 'Profile updated successfully',
      user: publicUser(user)
    });

  } catch (err) {
    console.error('UpdateProfile Error:', err);
    res.status(500).json({ error: 'Server error updating profile' });
  }
};

// ----------------------
// Update reputation
// ----------------------
const updateReputation = async (req, res) => {
  try {
    const { points } = req.body;

    const user = await User.findByPk(req.params.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.reputation = (user.reputation || 0) + points;

    await user.save();

    res.json({
      message: 'Reputation updated',
      reputation: user.reputation
    });

  } catch (err) {
    console.error('UpdateReputation Error:', err);
    res.status(500).json({ error: 'Server error updating reputation' });
  }
};

module.exports = {
  registerUser,
  loginUser,
  getProfile,
  updateProfile,
  updateReputation
};