const { afterEach, test } = require('node:test');
const assert = require('node:assert/strict');
const githubResourceService = require('../services/githubResourceService');
const controller = require('../api/controllers/resourceUploadController');

const originalCommitResource = githubResourceService.commitResource;

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

function uploadRequest(body = {}, fileOverrides = {}) {
  return {
    body: {
      category: 'ACEITEKA',
      year: '2026',
      title: 'Mathematics paper',
      subject: 'Mathematics',
      type: 'Past Papers',
      classKeys: '["s4","s5"]',
      ...body,
    },
    file: {
      originalname: 'paper.pdf',
      buffer: Buffer.from('pdf content'),
      ...fileOverrides,
    },
  };
}

afterEach(() => {
  githubResourceService.commitResource = originalCommitResource;
});

test('validates archive metadata and stores canonical class keys', async () => {
  githubResourceService.commitResource = async ({ filePath, resource }) => {
    assert.equal(filePath, 'ACEITEKA/2026/paper.pdf');
    assert.deepEqual(resource.classKeys, ['s4', 's5']);
    assert.equal(resource.url, 'https://raw.githubusercontent.com/trustjonathan/STUDT-HUB-RESOURCES-2026/main/ACEITEKA/2026/paper.pdf');
    return { commitSha: 'commit-sha' };
  };
  const response = responseMock();

  await controller.uploadResource(uploadRequest(), response);

  assert.equal(response.statusCode, 201);
  assert.equal(response.body.success, true);
  assert.equal(response.body.resource.category, 'ACEITEKA');
});

test('rejects unsupported file types and invalid class keys before writing', async () => {
  let committed = false;
  githubResourceService.commitResource = async () => { committed = true; };

  const unsupported = responseMock();
  await controller.uploadResource(uploadRequest({}, { originalname: 'archive.zip' }), unsupported);
  assert.equal(unsupported.statusCode, 400);

  const invalidClass = responseMock();
  await controller.uploadResource(uploadRequest({ classKeys: '["S.4"]' }), invalidClass);
  assert.equal(invalidClass.statusCode, 400);
  assert.equal(committed, false);
});

test('maps an empty class selection to the Unsorted library shelf', async () => {
  githubResourceService.commitResource = async ({ resource }) => {
    assert.deepEqual(resource.classKeys, ['unsorted']);
    return { commitSha: 'commit-sha' };
  };
  const response = responseMock();

  await controller.uploadResource(uploadRequest({ classKeys: '[]' }), response);

  assert.equal(response.statusCode, 201);
});
