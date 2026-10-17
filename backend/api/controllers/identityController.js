// backend/api/controllers/identityController.js

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const User = require('../../database/models/postgres/user');
const { auth } = require('../../config');
const googleIdentityClient = new OAuth2Client();

const accountServiceUnavailable = (res) => res.status(503).json({
  error: 'The account service is not configured correctly. Please try again later.'
});

const hasSecureAuthSecret = typeof auth.jwtSecret === 'string'
  && Buffer.byteLength(auth.jwtSecret, 'utf8') >= 32;

const createSessionToken = (user) => jwt.sign(
  { id: user.id, userId: user.id, role: user.role },
  auth.jwtSecret,
  { expiresIn: auth.tokenExpiry }
);

const publicUser = (user) => ({
  id: user.id,
  username: user.username,
  email: user.email,
  hasPassword: typeof user.password === 'string' && user.password.length > 0,
  role: user.role,
  reputation: user.reputation,
  classLevel: user.classLevel || null,
  subjects: Array.isArray(user.subjects) ? user.subjects : [],
  learnerType: user.learnerType || null,
  educationLevel: user.educationLevel || null,
  universityCourse: user.universityCourse || null,
  universityYear: user.universityYear || null,
  secondaryTrack: user.secondaryTrack || null,
  onboardingComplete: user.onboardingComplete === true
});

// ----------------------
// Register a new user
// ----------------------
const registerUser = async (req, res) => {
  try {
    if (!hasSecureAuthSecret) {
      console.error('Account registration unavailable: JWT_SECRET must contain at least 32 bytes.');
      return accountServiceUnavailable(res);
    }

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
    if (!hasSecureAuthSecret) {
      console.error('Account login unavailable: JWT_SECRET must contain at least 32 bytes.');
      return accountServiceUnavailable(res);
    }

    const { email, password } = req.body;

    const user = await User.findOne({ where: { email } });
    if (!user || typeof user.password !== 'string' || !(await bcrypt.compare(password, user.password))) {
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

const googleLogin = async (req, res) => {
  if (!hasSecureAuthSecret) {
    console.error('Google sign-in unavailable: JWT_SECRET must contain at least 32 bytes.');
    return accountServiceUnavailable(res);
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return res.status(503).json({ error: 'Google sign-in is not configured yet. Please try email sign-in.' });
  }

  const credential = req.body && req.body.credential;
  if (typeof credential !== 'string' || credential.length > 8192) {
    return res.status(400).json({ error: 'A valid Google sign-in credential is required.' });
  }

  let payload;
  try {
    const ticket = await googleIdentityClient.verifyIdToken({ idToken: credential, audience: clientId });
    payload = ticket.getPayload();
  } catch (error) {
    console.error('Google identity token verification failed:', error instanceof Error ? error.message : error);
    return res.status(401).json({ error: 'Google sign-in could not verify your account. Please try again.' });
  }

  if (!payload || typeof payload.sub !== 'string' || typeof payload.email !== 'string' || payload.email_verified !== true) {
    return res.status(401).json({ error: 'Use a Google account with a verified email address.' });
  }

  try {
    const email = payload.email.trim().toLowerCase();
    let user = await User.findOne({ where: { googleId: payload.sub } });

    if (!user) {
      user = await User.findOne({ where: { email } });
      if (user) {
        if (user.googleId && user.googleId !== payload.sub) {
          return res.status(409).json({ error: 'This email is already linked to another Google account.' });
        }
        user.googleId = payload.sub;
        await user.save();
      } else {
        const username = typeof payload.name === 'string' && payload.name.trim()
          ? payload.name.trim().slice(0, 80)
          : email.split('@')[0].slice(0, 80);
        user = await User.create({
          username,
          email,
          password: null,
          googleId: payload.sub,
          role: 'user',
        });
      }
    }

    return res.status(200).json({
      message: 'Google sign-in successful',
      token: createSessionToken(user),
      user: publicUser(user),
    });
  } catch (error) {
    console.error('Google sign-in account error:', error);
    return res.status(500).json({ error: 'Google sign-in could not be completed. Please try again.' });
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
    const {
      username,
      email,
      classLevel,
      subjects,
      learnerType,
      educationLevel,
      universityCourse,
      universityYear,
      secondaryTrack,
      onboardingComplete
    } = req.body;

    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.username = username || user.username;
    user.email = email || user.email;
    if (Object.hasOwn(req.body, 'classLevel')) user.classLevel = classLevel || null;
    if (Object.hasOwn(req.body, 'subjects')) user.subjects = subjects;
    if (Object.hasOwn(req.body, 'learnerType')) user.learnerType = learnerType;
    if (Object.hasOwn(req.body, 'educationLevel')) user.educationLevel = educationLevel || null;
    if (Object.hasOwn(req.body, 'universityCourse')) user.universityCourse = universityCourse || null;
    if (Object.hasOwn(req.body, 'universityYear')) user.universityYear = universityYear || null;
    if (Object.hasOwn(req.body, 'secondaryTrack')) user.secondaryTrack = secondaryTrack || null;
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

const updatePassword = async (req, res) => {
  try {
    if (!hasSecureAuthSecret) {
      console.error('Password update unavailable: JWT_SECRET must contain at least 32 bytes.');
      return accountServiceUnavailable(res);
    }

    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (typeof user.password !== 'string' || !user.password) {
      return res.status(409).json({ error: 'This account signs in with Google and does not have a password to change.' });
    }
    if (!(await bcrypt.compare(req.body.currentPassword, user.password))) {
      return res.status(401).json({ error: 'Your current password is incorrect.' });
    }
    if (req.body.currentPassword === req.body.newPassword) {
      return res.status(400).json({ error: 'Choose a new password different from your current password.' });
    }

    user.password = await bcrypt.hash(req.body.newPassword, 10);
    await user.save();
    return res.status(200).json({ message: 'Your password has been updated.' });
  } catch (error) {
    console.error('Password update error:', error);
    return res.status(500).json({ error: 'Your password could not be updated right now.' });
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
  googleLogin,
  getProfile,
  updateProfile,
  updatePassword,
  updateReputation
};