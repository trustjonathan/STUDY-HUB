const { afterEach, test } = require('node:test');
const assert = require('node:assert/strict');
const githubResourceService = require('../services/githubResourceService');

const originalFetch = global.fetch;
const originalEnvironment = {
  GITHUB_RESOURCES_PAT: process.env.GITHUB_RESOURCES_PAT,
};

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  global.fetch = originalFetch;
  for (const [key, value] of Object.entries(originalEnvironment)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test('updates the premium archive catalog counts while preserving schema metadata', () => {
  const updated = githubResourceService.buildUpdatedCatalog({
    schemaVersion: 2,
    repository: 'https://github.com/trustjonathan/STUDT-HUB-RESOURCES-2026',
    resources: [
      { path: 'ACEITEKA/Undated/old.pdf', category: 'ACEITEKA', body: 'ACEITEKA', year: 'Undated' },
      { path: 'JJEB/2026/current.pdf', category: 'JJEB', body: 'JJEB', year: '2026' },
    ],
  }, {
    path: 'New Board/2026/new.pdf',
    category: 'New Board',
    body: 'New Board',
    year: '2026',
  });

  assert.equal(updated.schemaVersion, 2);
  assert.equal(updated.repository, 'https://github.com/trustjonathan/STUDT-HUB-RESOURCES-2026');
  assert.equal(updated.count, 3);
  assert.equal(updated.trending2026Count, 2);
  assert.equal(updated.countsByCategory['New Board'], 1);
  assert.equal(updated.countsByBody['New Board'], 1);
  assert.equal(updated.countsByYear.Undated, 1);
  assert.equal(updated.resources[0].path, 'New Board/2026/new.pdf');
});

test('commits the file and catalog together in one non-forced branch update', async () => {
  process.env.GITHUB_RESOURCES_PAT = 'test-token';
  const calls = [];
  global.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url).includes('/contents/ACEITEKA/2026/new.pdf')) return jsonResponse({ message: 'Not Found' }, 404);
    if (String(url).includes('/contents/resource-catalog.json')) {
      return jsonResponse({
        content: Buffer.from(JSON.stringify({ schemaVersion: 2, resources: [] })).toString('base64'),
      });
    }
    if (String(url).endsWith('/git/blobs')) return jsonResponse({ sha: `blob-${calls.length}` }, 201);
    if (String(url).endsWith('/git/ref/heads/main')) return jsonResponse({ object: { sha: 'parent-sha' } });
    if (String(url).endsWith('/git/commits/parent-sha')) return jsonResponse({ tree: { sha: 'base-tree' } });
    if (String(url).endsWith('/git/trees')) return jsonResponse({ sha: 'new-tree' }, 201);
    if (String(url).endsWith('/git/commits')) return jsonResponse({ sha: 'new-commit' }, 201);
    if (String(url).endsWith('/git/refs/heads/main')) return jsonResponse({ object: { sha: 'new-commit' } });
    throw new Error(`Unexpected GitHub API request: ${url}`);
  };

  const result = await githubResourceService.commitResource({
    filePath: 'ACEITEKA/2026/new.pdf',
    fileBuffer: Buffer.from('pdf content'),
    resource: {
      title: 'New paper',
      path: 'ACEITEKA/2026/new.pdf',
      category: 'ACEITEKA',
      body: 'ACEITEKA',
      year: '2026',
      classKeys: ['s4'],
    },
  });

  const treeRequest = calls.find((call) => call.url.endsWith('/git/trees'));
  const treeBody = JSON.parse(treeRequest.options.body);
  const refUpdate = calls.find((call) => call.url.endsWith('/git/refs/heads/main') && call.options.method === 'PATCH');
  assert.equal(result.commitSha, 'new-commit');
  assert.equal(result.catalog.count, 1);
  assert.deepEqual(treeBody.tree.map((item) => item.path).sort(), ['ACEITEKA/2026/new.pdf', 'resource-catalog.json']);
  assert.equal(refUpdate.options.method, 'PATCH');
  assert.deepEqual(JSON.parse(refUpdate.options.body), { sha: 'new-commit', force: false });
  assert.equal(calls[0].options.headers.Authorization, 'Bearer test-token');
});

test('rejects a duplicate repository path without changing the branch', async () => {
  process.env.GITHUB_RESOURCES_PAT = 'test-token';
  global.fetch = async () => jsonResponse({ type: 'file', sha: 'existing-sha' });

  await assert.rejects(
    githubResourceService.commitResource({
      filePath: 'ACEITEKA/2026/existing.pdf',
      fileBuffer: Buffer.from('pdf content'),
      resource: { path: 'ACEITEKA/2026/existing.pdf' },
    }),
    { statusCode: 409 },
  );
});
