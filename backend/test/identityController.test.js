const { afterEach, test } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { OAuth2Client } = require('google-auth-library');

process.env.JWT_SECRET = 'test-only-jwt-secret-that-is-long-enough';
process.env.GOOGLE_CLIENT_ID = 'study-hub-test.apps.googleusercontent.com';

const User = require('../database/models/postgres/user');
const controller = require('../api/controllers/identityController');
const originalVerifyIdToken = OAuth2Client.prototype.verifyIdToken;
const originalFindOne = User.findOne;
const originalCreate = User.create;
const originalFindByPk = User.findByPk;

function responseMock() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

afterEach(() => {
  OAuth2Client.prototype.verifyIdToken = originalVerifyIdToken;
  User.findOne = originalFindOne;
  User.create = originalCreate;
  User.findByPk = originalFindByPk;
});

test('creates a verified Google account and returns a Study Hub session', async () => {
  const verifiedPayload = {
    sub: 'google-subject-123',
    email: 'learner@example.com',
    email_verified: true,
    name: 'Study Learner',
  };
  OAuth2Client.prototype.verifyIdToken = async ({ idToken, audience }) => {
    assert.equal(idToken, 'signed-google-credential');
    assert.equal(audience, process.env.GOOGLE_CLIENT_ID);
    return { getPayload: () => verifiedPayload };
  };

  let lookups = 0;
  User.findOne = async () => {
    lookups += 1;
    return null;
  };
  User.create = async (attributes) => ({ id: 42, ...attributes, onboardingComplete: false, subjects: [] });
  const res = responseMock();

  await controller.googleLogin({ body: { credential: 'signed-google-credential' } }, res);

  assert.equal(lookups, 2);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.user.email, 'learner@example.com');
  assert.equal(res.body.user.username, 'Study Learner');
  assert.equal(res.body.user.onboardingComplete, false);
  const session = jwt.verify(res.body.token, process.env.JWT_SECRET);
  assert.equal(session.userId, 42);
  assert.equal(session.exp - session.iat, 30 * 24 * 60 * 60);
});

test('links an existing email account only after Google verifies the same email', async () => {
  OAuth2Client.prototype.verifyIdToken = async () => ({
    getPayload: () => ({
      sub: 'google-subject-456',
      email: 'learner@example.com',
      email_verified: true,
    }),
  });
  const existing = {
    id: 7,
    username: 'Learner',
    email: 'learner@example.com',
    role: 'user',
    classLevel: null,
    subjects: [],
    onboardingComplete: true,
    save: async () => {},
  };
  let lookup = 0;
  User.findOne = async () => {
    lookup += 1;
    return lookup === 1 ? null : existing;
  };
  const res = responseMock();

  await controller.googleLogin({ body: { credential: 'signed-google-credential' } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(existing.googleId, 'google-subject-456');
  assert.equal(res.body.user.id, 7);
});

test('rejects Google identities without a verified email before accessing the account store', async () => {
  OAuth2Client.prototype.verifyIdToken = async () => ({
    getPayload: () => ({
      sub: 'google-subject-unverified',
      email: 'learner@example.com',
      email_verified: false,
    }),
  });
  let queried = false;
  User.findOne = async () => {
    queried = true;
    return null;
  };
  const res = responseMock();

  await controller.googleLogin({ body: { credential: 'signed-google-credential' } }, res);

  assert.equal(res.statusCode, 401);
  assert.equal(queried, false);
});

test('does not compare a password for Google-only accounts', async () => {
  User.findOne = async () => ({ password: null });
  const res = responseMock();

  await controller.loginUser({
    body: { email: 'learner@example.com', password: 'not-a-real-password' },
  }, res);

  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, { message: 'Invalid credentials' });
});

test('changes a password only after verifying the current password', async () => {
  const user = {
    password: await bcrypt.hash('old-password', 4),
    save: async function save() {},
  };
  User.findByPk = async () => user;
  const res = responseMock();

  await controller.updatePassword({
    user: { id: 42 },
    body: { currentPassword: 'old-password', newPassword: 'new-password' },
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(await bcrypt.compare('new-password', user.password), true);
  assert.equal(res.body.message, 'Your password has been updated.');
});

test('rejects password updates when the current password is incorrect', async () => {
  const user = {
    password: await bcrypt.hash('old-password', 4),
    save: async () => assert.fail('Password must not be saved.'),
  };
  User.findByPk = async () => user;
  const res = responseMock();

  await controller.updatePassword({
    user: { id: 42 },
    body: { currentPassword: 'wrong-password', newPassword: 'new-password' },
  }, res);

  assert.equal(res.statusCode, 401);
  assert.equal(res.body.error, 'Your current password is incorrect.');
});
