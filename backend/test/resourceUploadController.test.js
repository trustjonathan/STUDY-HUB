const { afterEach, test } = require('node:test');
const assert = require('node:assert/strict');
const githubResourceService = require('../services/githubResourceService');
const controller = require('../api/controllers/resourceUploadController');

const originalCommitResource = githubResourceService.commitResource;
const originalListResources = githubResourceService.listResources;
const originalArchiveResource = githubResourceService.archiveResource;
const originalRestoreResource = githubResourceService.restoreResource;
const originalMoveResource = githubResourceService.moveResource;

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
  githubResourceService.listResources = originalListResources;
  githubResourceService.archiveResource = originalArchiveResource;
  githubResourceService.restoreResource = originalRestoreResource;
  githubResourceService.moveResource = originalMoveResource;
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

test('returns active and archived resources for the protected archive manager', async () => {
  githubResourceService.listResources = async () => ({
    resources: [{ path: 'ACEITEKA/2026/paper.pdf' }],
    archivedResources: [{ path: 'JJEB/2025/old.pdf', archivedAt: '2026-10-20T00:00:00.000Z' }],
  });
  const response = responseMock();

  await controller.getResources({}, response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.resources[0].path, 'ACEITEKA/2026/paper.pdf');
  assert.equal(response.body.archivedResources[0].path, 'JJEB/2025/old.pdf');
});

test('validates resource paths and move destinations before invoking archive operations', async () => {
  let moved = false;
  githubResourceService.moveResource = async () => { moved = true; };
  const invalidPath = responseMock();
  await controller.archiveResource({ body: { path: '../resource-catalog.json' } }, invalidPath);
  assert.equal(invalidPath.statusCode, 400);

  const invalidYear = responseMock();
  await controller.moveResource({
    body: { path: 'ACEITEKA/2026/paper.pdf', category: 'JJEB', year: '../' },
  }, invalidYear);
  assert.equal(invalidYear.statusCode, 400);
  const invalidFilename = responseMock();
  await controller.moveResource({
    body: { path: 'ACEITEKA/2026/paper.pdf', category: 'JJEB', year: '2025', filename: '../paper.pdf' },
  }, invalidFilename);
  assert.equal(invalidFilename.statusCode, 400);
  assert.equal(moved, false);
});

test('archives, restores, and moves valid archive resource paths', async () => {
  githubResourceService.archiveResource = async (path) => ({ resource: { path } });
  githubResourceService.restoreResource = async (path) => ({ resource: { path } });
  githubResourceService.moveResource = async (input) => ({ resource: input });

  const archived = responseMock();
  await controller.archiveResource({ body: { path: 'ACEITEKA/2026/paper.pdf' } }, archived);
  assert.equal(archived.statusCode, 200);
  assert.equal(archived.body.resource.path, 'ACEITEKA/2026/paper.pdf');

  const restored = responseMock();
  await controller.restoreResource({ body: { path: 'ACEITEKA/2026/paper.pdf' } }, restored);
  assert.equal(restored.statusCode, 200);

  const moved = responseMock();
  await controller.moveResource({
    body: {
      path: 'ACEITEKA/2026/paper.pdf',
      category: 'JJEB',
      year: '2025',
      filename: 'new-name.pdf',
      title: 'New title',
    },
  }, moved);
  assert.equal(moved.statusCode, 200);
  assert.deepEqual(moved.body.resource, {
    filePath: 'ACEITEKA/2026/paper.pdf',
    category: 'JJEB',
    year: '2025',
    filename: 'new-name.pdf',
    title: 'New title',
  });
});
