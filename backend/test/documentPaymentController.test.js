const { afterEach, test } = require('node:test');
const assert = require('node:assert/strict');
const { Writable } = require('node:stream');
const sequelize = require('../database/config/database');
const resourceService = require('../services/resourceService');
const controller = require('../api/controllers/documentPaymentController');

const originalQuery = sequelize.query;
const originalGetByStoragePath = resourceService.getByStoragePath;
const originalCreateSignedUrl = resourceService.createSignedUrl;
const originalFetch = global.fetch;

function responseMock() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

function validRequest(overrides = {}) {
  return {
    body: {
      resourceId: 'sh:documents/biology/notes.pdf',
      senderPhone: '0701234567',
      transactionId: 'ignored-legacy-field',
      payerSms: 'ignored legacy SMS',
      ...overrides,
    },
    user: { id: 42, role: 'user' },
  };
}

afterEach(() => {
  sequelize.query = originalQuery;
  resourceService.getByStoragePath = originalGetByStoragePath;
  resourceService.createSignedUrl = originalCreateSignedUrl;
  global.fetch = originalFetch;
});

test('submits a fixed-price payment request using only the sender phone number', async () => {
  resourceService.getByStoragePath = async (path) => ({
    title: 'Biology notes',
    originalFilename: 'notes.pdf',
    storagePath: path,
    storageBucket: 'study-hub-resources',
  });
  sequelize.query = async (sql, options) => {
    assert.match(sql, /INSERT INTO public\.study_hub_document_payments/);
    assert.doesNotMatch(sql, /transaction_id|payer_sms/i);
    assert.equal(options.replacements.userId, 42);
    assert.equal(options.replacements.resourceTitle, 'Biology notes');
    assert.equal(options.replacements.amount, 1000);
    assert.equal(options.replacements.senderPhone, '0701234567');
    assert.equal('transactionId' in options.replacements, false);
    assert.equal('payerSms' in options.replacements, false);
    return [{ id: 5, resourceTitle: 'Biology notes', amountUgx: 1000, status: 'pending' }];
  };
  const res = responseMock();

  await controller.submitPayment(validRequest(), res);

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.payment.status, 'pending');
});

test('rejects invalid phone numbers and unsupported resource URLs before inserting', async () => {
  let inserted = false;
  sequelize.query = async () => { inserted = true; return []; };
  resourceService.getByStoragePath = async () => null;

  const invalidPhone = responseMock();
  await controller.submitPayment(validRequest({ senderPhone: '123' }), invalidPhone);
  assert.equal(invalidPhone.statusCode, 400);

  const invalidResource = responseMock();
  await controller.submitPayment(validRequest({ resourceId: 'ft:https://unapproved.example/file.pdf' }), invalidResource);
  assert.equal(invalidResource.statusCode, 400);
  assert.equal(inserted, false);
});

test('admin verification releases an eligible request without sending the document outside the one-time flow', async () => {
  sequelize.query = async (sql, options) => {
    assert.match(sql, /SET status = 'approved'/);
    assert.match(sql, /verified_by = :adminId/);
    assert.deepEqual(options.replacements, { id: 17, adminId: 8 });
    return [{ id: 17, status: 'approved', verifiedAt: '2026-10-15T12:00:00Z' }];
  };
  const res = responseMock();

  await controller.verifyPayment({ params: { id: '17' }, user: { id: 8 } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.payment.status, 'approved');
});

test('an interrupted direct download restores the request so the user can resume it', async () => {
  let downloadAttempt = 0;
  sequelize.query = async (sql) => {
    if (/SET status = 'downloading'/.test(sql)) {
      downloadAttempt += 1;
      return [{
        resourceId: 'ft:https://fresh-teacher.github.io/biology/lesson.pdf',
        resourceTitle: 'Biology lesson',
        deliveryUrl: 'https://fresh-teacher.github.io/biology/lesson.pdf',
      }];
    }
    if (/SELECT status/.test(sql)) return [];
    if (/SET status = 'downloaded'/.test(sql)) return [];
    assert.match(sql, /SET status = 'approved'/);
    return [];
  };
  global.fetch = async () => new Response(
    new ReadableStream({
      start(stream) {
        stream.enqueue(new TextEncoder().encode('partial'));
        stream.error(new Error('network interrupted'));
      },
    }),
    { headers: { 'content-type': 'application/pdf' } },
  );

  const res = new Writable({
    write(chunk, encoding, callback) { callback(); },
  });
  res.statusCode = 200;
  res.headers = {};
  res.setHeader = (name, value) => { res.headers[name.toLowerCase()] = value; return res; };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (payload) => { res.body = payload; return res; };
  res.on('error', () => {});

  await controller.downloadApprovedPayment({ params: { id: '23' }, user: { id: 42 } }, res);

  assert.equal(downloadAttempt, 1);
  assert.equal(res.destroyed, true);
});

test('a completed download is rejected on reuse and is scoped to its owner', async () => {
  sequelize.query = async (sql, options) => {
    assert.match(sql, /WHERE id = :id AND user_id = :userId/);
    assert.deepEqual(options.replacements, { id: 23, userId: 42 });
    if (/SET status = 'downloading'/.test(sql)) return [];
    return [{ status: 'downloaded' }];
  };
  const res = responseMock();

  await controller.downloadApprovedPayment({ params: { id: '23' }, user: { id: 42 } }, res);

  assert.equal(res.statusCode, 410);
});

test('streams an approved document and marks its one-time request consumed', async () => {
  const sqlCalls = [];
  sequelize.query = async (sql, options) => {
    sqlCalls.push(sql);
    assert.deepEqual(options.replacements, { id: 23, userId: 42 });
    if (/SET status = 'downloading'/.test(sql)) {
      return [{
        resourceId: 'ft:https://fresh-teacher.github.io/biology/lesson.pdf',
        resourceTitle: 'Biology lesson',
        deliveryUrl: 'https://fresh-teacher.github.io/biology/lesson.pdf',
      }];
    }
    assert.match(sql, /SET status = 'downloaded'/);
    return [];
  };
  global.fetch = async (url) => {
    assert.equal(url, 'https://fresh-teacher.github.io/biology/lesson.pdf');
    return new Response('pdf test bytes', { headers: { 'content-length': '14' } });
  };

  const chunks = [];
  const res = new Writable({
    write(chunk, encoding, callback) {
      chunks.push(Buffer.from(chunk));
      callback();
    },
  });
  res.statusCode = 200;
  res.headers = {};
  res.setHeader = (name, value) => { res.headers[name.toLowerCase()] = value; return res; };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (payload) => { res.body = payload; return res; };
  const finished = new Promise((resolve, reject) => {
    res.once('finish', resolve);
    res.once('error', reject);
  });

  await controller.downloadApprovedPayment({ params: { id: '23' }, user: { id: 42 } }, res);
  await finished;

  assert.equal(res.headers['content-type'], 'application/octet-stream');
  assert.equal(res.headers['content-disposition'], "attachment; filename*=UTF-8''Biology%20lesson.pdf");
  assert.equal(Buffer.concat(chunks).toString(), 'pdf test bytes');
  assert.equal(sqlCalls.length, 2);
});
