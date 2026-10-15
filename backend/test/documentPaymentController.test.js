const { afterEach, test } = require('node:test');
const assert = require('node:assert/strict');
const { Writable } = require('node:stream');
const sequelize = require('../database/config/database');
const resourceService = require('../services/resourceService');
const emailService = require('../services/paymentEmailService');
const controller = require('../api/controllers/documentPaymentController');

const originalQuery = sequelize.query;
const originalGetByStoragePath = resourceService.getByStoragePath;
const originalCreateSignedUrl = resourceService.createSignedUrl;
const originalSendDocumentAccessEmail = emailService.sendDocumentAccessEmail;
const originalFetch = global.fetch;
const originalNodeEnv = process.env.NODE_ENV;
const originalPreviewFlag = process.env.PAYMENT_DELIVERY_PREVIEW_ENABLED;

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
      transactionId: 'ABC1234567',
      payerSms: 'You have sent UGX 1,000. Transaction ABC1234567.',
      ...overrides,
    },
    user: { id: 42, role: 'user' },
  };
}

afterEach(() => {
  sequelize.query = originalQuery;
  resourceService.getByStoragePath = originalGetByStoragePath;
  resourceService.createSignedUrl = originalCreateSignedUrl;
  emailService.sendDocumentAccessEmail = originalSendDocumentAccessEmail;
  global.fetch = originalFetch;
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;
  if (originalPreviewFlag === undefined) delete process.env.PAYMENT_DELIVERY_PREVIEW_ENABLED;
  else process.env.PAYMENT_DELIVERY_PREVIEW_ENABLED = originalPreviewFlag;
});

test('submits a fixed-price payment request for a catalogued Study Hub document', async () => {
  resourceService.getByStoragePath = async (path) => {
    assert.equal(path, 'documents/biology/notes.pdf');
    return {
      title: 'Biology notes',
      originalFilename: 'notes.pdf',
      storagePath: path,
      storageBucket: 'study-hub-resources',
    };
  };
  sequelize.query = async (sql, options) => {
    assert.match(sql, /INSERT INTO public\.study_hub_document_payments/);
    assert.equal(options.replacements.userId, 42);
    assert.equal(options.replacements.resourceTitle, 'Biology notes');
    assert.equal(options.replacements.amount, 1000);
    assert.equal(options.replacements.senderPhone, '0701234567');
    return [{ id: 5, resourceTitle: 'Biology notes', amountUgx: 1000, status: 'pending' }];
  };
  const res = responseMock();

  await controller.submitPayment(validRequest(), res);

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.payment.status, 'pending');
});

test('rejects invalid phone numbers and unsupported resource URLs before querying', async () => {
  let queried = false;
  sequelize.query = async () => { queried = true; return []; };
  resourceService.getByStoragePath = async () => { queried = true; return null; };

  const phoneResponse = responseMock();
  await controller.submitPayment(validRequest({ senderPhone: '123' }), phoneResponse);
  assert.equal(phoneResponse.statusCode, 400);

  const resourceResponse = responseMock();
  await controller.submitPayment(validRequest({ resourceId: 'ft:https://unapproved.example/file.pdf' }), resourceResponse);
  assert.equal(resourceResponse.statusCode, 400);
  assert.equal(queried, false);
});

test('accepts an allowlisted Fresh Teacher resource and stores its delivery URL', async () => {
  sequelize.query = async (sql, options) => {
    assert.match(sql, /delivery_url/);
    assert.equal(
      options.replacements.deliveryUrl,
      'https://fresh-teacher.github.io/biology/lesson.pdf',
    );
    assert.equal(options.replacements.resourceTitle, 'Biology lesson');
    return [{ id: 6, resourceTitle: 'Biology lesson', amountUgx: 1000, status: 'pending' }];
  };
  const res = responseMock();

  await controller.submitPayment(validRequest({
    resourceId: 'ft:https://fresh-teacher.github.io/biology/lesson.pdf',
    resourceTitle: 'Biology lesson',
  }), res);

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.payment.status, 'pending');
});

test('matches tally against payer, receiver, amount, and transaction ID', async () => {
  let updateCalled = false;
  sequelize.query = async (sql, options) => {
    if (/SELECT sender_phone/.test(sql)) {
      assert.deepEqual(options.replacements, { id: 17 });
      return [{
        senderPhone: '0701234567',
        transactionId: 'abc1234567',
        amountUgx: 1000,
        status: 'pending',
      }];
    }
    updateCalled = true;
    assert.match(sql, /status = 'verified'/);
    assert.equal(options.replacements.adminId, 8);
    return [{ id: 17, status: 'verified', verifiedAt: '2026-10-15T12:00:00Z' }];
  };
  const res = responseMock();

  await controller.tallyPayment({
    params: { id: '17' },
    user: { id: 8 },
    body: {
      senderPhone: '+256 701 234567',
      recipientPhone: '0701810497',
      amountUgx: 1000,
      transactionId: 'ABC1234567',
      receivedSms: 'You received UGX 1,000 from 0701234567. Ref ABC1234567.',
    },
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.tallyMatched, true);
  assert.equal(updateCalled, true);
});

test('does not mark a mismatched payment as tallied', async () => {
  let updateCalled = false;
  sequelize.query = async (sql) => {
    if (/SELECT sender_phone/.test(sql)) {
      return [{
        senderPhone: '0701234567',
        transactionId: 'ABC1234567',
        amountUgx: 1000,
        status: 'pending',
      }];
    }
    updateCalled = true;
    return [];
  };
  const res = responseMock();

  await controller.tallyPayment({
    params: { id: '17' },
    user: { id: 8 },
    body: {
      senderPhone: '0709999999',
      recipientPhone: '0701810497',
      amountUgx: 500,
      transactionId: 'OTHER12345',
      receivedSms: 'Received UGX 500 from 0709999999. Ref OTHER12345.',
    },
  }, res);

  assert.equal(res.statusCode, 422);
  assert.equal(updateCalled, false);
  assert.match(res.body.error, /sender number, amount, transaction ID/);
});

test('previews development delivery URLs without altering payment status or sending email', async () => {
  process.env.NODE_ENV = 'development';
  process.env.PAYMENT_DELIVERY_PREVIEW_ENABLED = 'true';
  let queryCount = 0;
  sequelize.query = async (sql, options) => {
    queryCount += 1;
    assert.match(sql, /SELECT resource_id AS "resourceId", delivery_url AS "deliveryUrl"/);
    assert.deepEqual(options.replacements, { id: 19 });
    return [{
      resourceId: 'ft:https://fresh-teacher.github.io/biology/lesson.pdf',
      deliveryUrl: 'https://fresh-teacher.github.io/biology/lesson.pdf',
    }];
  };
  emailService.sendDocumentAccessEmail = async () => {
    assert.fail('A development preview must not send email.');
  };
  const res = responseMock();

  await controller.previewPaymentDelivery({ params: { id: '19' } }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, {
    deliveryUrl: 'https://fresh-teacher.github.io/biology/lesson.pdf',
    simulated: true,
  });
  assert.equal(queryCount, 1);
});

test('disables delivery preview unless explicitly enabled outside production', async () => {
  process.env.NODE_ENV = 'production';
  process.env.PAYMENT_DELIVERY_PREVIEW_ENABLED = 'true';
  let queried = false;
  sequelize.query = async () => { queried = true; return []; };
  const res = responseMock();

  await controller.previewPaymentDelivery({ params: { id: '19' } }, res);

  assert.equal(res.statusCode, 404);
  assert.equal(queried, false);
});

test('emails a short-lived signed document link only after a verified tally', async () => {
  resourceService.getByStoragePath = async () => ({
    storagePath: 'documents/biology/notes.pdf',
    storageBucket: 'study-hub-resources',
  });
  resourceService.createSignedUrl = async (path, ttl, bucket) => {
    assert.equal(path, 'documents/biology/notes.pdf');
    assert.equal(ttl, 7 * 24 * 60 * 60);
    assert.equal(bucket, 'study-hub-resources');
    return 'https://files.example.test/signed-document';
  };
  let emailSent = false;
  emailService.sendDocumentAccessEmail = async (message) => {
    emailSent = true;
    assert.equal(message.to, 'learner@example.test');
    assert.equal(message.signedUrl, 'https://files.example.test/signed-document');
  };
  sequelize.query = async (sql, options) => {
    if (/UPDATE public\.study_hub_document_payments AS p/.test(sql)) {
      assert.match(sql, /p\.status = 'verified'/);
      return [{
        id: 17,
        resourceId: 'sh:documents/biology/notes.pdf',
        resourceTitle: 'Biology notes',
        email: 'learner@example.test',
      }];
    }
    assert.match(sql, /status = 'approved'/);
    return [{ id: 17, status: 'approved' }];
  };
  const res = responseMock();

  await controller.approvePayment({ params: { id: '17' } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.payment.status, 'approved');
  assert.equal(emailSent, true);
});

test('approves a verified payment for direct download when email delivery fails', async () => {
  process.env.NODE_ENV = 'test';
  resourceService.getByStoragePath = async () => ({
    storagePath: 'documents/biology/notes.pdf',
    storageBucket: 'study-hub-resources',
  });
  resourceService.createSignedUrl = async () => 'https://files.example.test/fallback-document';
  emailService.sendDocumentAccessEmail = async () => {
    throw new Error('SMTP unavailable');
  };
  let statusApproved = false;
  sequelize.query = async (sql) => {
    if (/UPDATE public\.study_hub_document_payments AS p/.test(sql)) {
      return [{
        id: 21,
        resourceId: 'sh:documents/biology/notes.pdf',
        resourceTitle: 'Biology notes',
        email: 'learner@example.test',
      }];
    }
    if (/SET status = 'approved'/.test(sql)) {
      statusApproved = true;
      return [{ id: 21, status: 'approved' }];
    }
    assert.fail('Unexpected payment status update.');
    return [];
  };
  const res = responseMock();

  await controller.approvePayment({ params: { id: '21' } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(statusApproved, true);
  assert.deepEqual(res.body, {
    payment: { id: 21, status: 'approved' },
    emailSent: false,
    directDownloadAvailable: true,
  });
});

test('streams an approved document only to the account that submitted its payment', async () => {
  sequelize.query = async (sql, options) => {
    assert.match(sql, /WHERE id = :id AND user_id = :userId/);
    assert.deepEqual(options.replacements, { id: 23, userId: 42 });
    return [{
      resourceId: 'ft:https://fresh-teacher.github.io/biology/lesson.pdf',
      resourceTitle: 'Biology lesson',
      deliveryUrl: 'https://fresh-teacher.github.io/biology/lesson.pdf',
      status: 'approved',
    }];
  };
  global.fetch = async (url, options) => {
    assert.equal(url, 'https://fresh-teacher.github.io/biology/lesson.pdf');
    assert.equal(options.signal instanceof AbortSignal, true);
    return new Response('pdf test bytes', {
      headers: { 'content-length': '14' },
    });
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

  await controller.downloadApprovedPayment({
    params: { id: '23' },
    user: { id: 42 },
  }, res);
  await finished;

  assert.equal(res.headers['content-type'], 'application/octet-stream');
  assert.equal(res.headers['content-disposition'], "attachment; filename*=UTF-8''Biology%20lesson.pdf");
  assert.equal(Buffer.concat(chunks).toString(), 'pdf test bytes');
});

test('emails an allowlisted Fresh Teacher delivery URL after manual final approval', async () => {
  let emailed = false;
  emailService.sendDocumentAccessEmail = async (message) => {
    emailed = true;
    assert.equal(message.to, 'learner@example.test');
    assert.equal(message.signedUrl, 'https://fresh-teacher.github.io/biology/lesson.pdf');
  };
  sequelize.query = async (sql) => {
    if (/UPDATE public\.study_hub_document_payments AS p/.test(sql)) {
      return [{
        id: 19,
        resourceId: 'ft:https://fresh-teacher.github.io/biology/lesson.pdf',
        deliveryUrl: 'https://fresh-teacher.github.io/biology/lesson.pdf',
        resourceTitle: 'Biology lesson',
        email: 'learner@example.test',
      }];
    }
    assert.match(sql, /status = 'approved'/);
    return [{ id: 19, status: 'approved' }];
  };
  const res = responseMock();

  await controller.approvePayment({ params: { id: '19' } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.payment.status, 'approved');
  assert.equal(emailed, true);
});
