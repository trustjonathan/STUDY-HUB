// backend/api/controllers/identityController.js

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../../database/models/postgres/user');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../../config');

// ----------------------
// Register a new user
// ----------------------
const registerUser = async (req, res) => {
  try {
    const { username, email, password, role } = req.body;

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const user = await User.create({
      username,
      email,
      password_hash,
      role
    });

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: user.id,
        username,
        email,
        role: user.role
      }
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
    const { email, password } = req.body;

    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      }
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
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      reputation: user.reputation
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
    const { username, email } = req.body;

    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.username = username || user.username;
    user.email = email || user.email;

    await user.save();

    res.json({
      message: 'Profile updated successfully',
      user
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