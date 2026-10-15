const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateProfileUpdate } = require('../api/validators/identityValidator');

async function validateProfile(body) {
  const req = { body };
  const res = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };

  for (const middleware of validateProfileUpdate) {
    await middleware(req, res, () => {});
    if (res.statusCode !== 200) break;
  }
  return res;
}

test('accepts catalog subjects that apply to the selected class', async () => {
  const res = await validateProfile({
    classLevel: 'S.4',
    subjects: ['Biology', 'English Language', 'Geography'],
  });

  assert.equal(res.statusCode, 200);
});

test('rejects subjects that do not apply to the selected class level', async () => {
  const res = await validateProfile({
    classLevel: 'S.5',
    subjects: ['English Language'],
  });

  assert.equal(res.statusCode, 400);
  assert.match(res.payload.errors[0].msg, /available Study Hub subjects/);
});

test('accepts A-Level and subsidiary subjects for upper secondary classes', async () => {
  const res = await validateProfile({
    classLevel: 'S.5',
    subjects: ['Mathematics', 'General Paper (GP)', 'Information & Communication Technology (ICT)'],
  });

  assert.equal(res.statusCode, 200);
});

test('rejects subjects outside the Study Hub catalog', async () => {
  const res = await validateProfile({
    classLevel: 'S.4',
    subjects: ['Made-up subject'],
  });

  assert.equal(res.statusCode, 400);
});
