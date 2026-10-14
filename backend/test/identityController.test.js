const { afterEach, test } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');

process.env.JWT_SECRET = 'test-only-jwt-secret-that-is-long-enough';
process.env.GOOGLE_CLIENT_ID = 'study-hub-test.apps.googleusercontent.com';

const User = require('../database/models/postgres/user');
const controller = require('../api/controllers/identityController');
const originalVerifyIdToken = OAuth2Client.prototype.verifyIdToken;
const originalFindOne = User.findOne;
const originalCreate = User.create;

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
  assert.equal(jwt.verify(res.body.token, process.env.JWT_SECRET).userId, 42);
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
