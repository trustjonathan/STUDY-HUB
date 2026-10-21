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

function mockGitHubRepository({ resources = [], archivedResources = [], files = {} } = {}) {
  const calls = [];
  let blobNumber = 0;
  const blobContents = new Map();
  const catalog = { schemaVersion: 2, resources, archivedResources };
  const initialFiles = new Map(Object.entries(files));
  global.fetch = async (url, options = {}) => {
    const requestUrl = new URL(String(url));
    const pathname = requestUrl.pathname;
    calls.push({ pathname, method: options.method || 'GET', options });

    if (pathname.endsWith('/contents/resource-catalog.json')) {
      return jsonResponse({
        sha: 'catalog-sha',
        content: Buffer.from(JSON.stringify(catalog)).toString('base64'),
      });
    }
    if (pathname.includes('/contents/')) {
      const filePath = decodeURIComponent(pathname.split('/contents/')[1]);
      if (initialFiles.has(filePath)) return jsonResponse({ sha: initialFiles.get(filePath) });
      return jsonResponse({ message: 'Not Found' }, 404);
    }
    if (pathname.endsWith('/git/blobs') && options.method === 'POST') {
      const body = JSON.parse(options.body);
      const sha = `blob-${++blobNumber}`;
      blobContents.set(sha, Buffer.from(body.content, 'base64').toString('utf8'));
      return jsonResponse({ sha }, 201);
    }
    if (pathname.endsWith('/git/ref/heads/main')) return jsonResponse({ object: { sha: 'parent-sha' } });
    if (pathname.endsWith('/git/commits/parent-sha')) return jsonResponse({ tree: { sha: 'base-tree' } });
    if (pathname.endsWith('/git/trees') && options.method === 'POST') {
      const body = JSON.parse(options.body);
      calls[calls.length - 1].tree = body.tree;
      return jsonResponse({ sha: 'new-tree' }, 201);
    }
    if (pathname.endsWith('/git/commits') && options.method === 'POST') {
      const body = JSON.parse(options.body);
      const catalogTreeEntry = calls.findLast((call) => call.pathname.endsWith('/git/trees'))?.tree
        .find((entry) => entry.path === 'resource-catalog.json');
      Object.assign(catalog, JSON.parse(blobContents.get(catalogTreeEntry.sha)));
      calls[calls.length - 1].message = body.message;
      return jsonResponse({ sha: 'new-commit' }, 201);
    }
    if (pathname.endsWith('/git/refs/heads/main') && options.method === 'PATCH') {
      return jsonResponse({ object: { sha: 'new-commit' } });
    }
    throw new Error(`Unexpected GitHub API request: ${url}`);
  };

  return { calls, catalog };
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
        sha: 'catalog-sha',
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

test('archives a resource without deleting its repository file', async () => {
  process.env.GITHUB_RESOURCES_PAT = 'test-token';
  const resource = {
    path: 'ACEITEKA/2026/paper.pdf',
    title: 'Paper',
    category: 'ACEITEKA',
    body: 'ACEITEKA',
    year: '2026',
  };
  const { calls, catalog } = mockGitHubRepository({ resources: [resource] });

  const result = await githubResourceService.archiveResource(resource.path);

  assert.equal(result.resource.path, resource.path);
  assert.equal(catalog.resources.length, 0);
  assert.equal(catalog.archivedResources[0].path, resource.path);
  assert.equal(catalog.archivedResources[0].archivedAt.length > 0, true);
  assert.equal(catalog.count, 0);
  assert.deepEqual(calls.find((call) => call.pathname.endsWith('/git/trees')).tree.map((item) => item.path), ['resource-catalog.json']);
});

test('restores an archived resource without changing its file path', async () => {
  process.env.GITHUB_RESOURCES_PAT = 'test-token';
  const resource = {
    path: 'ACEITEKA/2026/paper.pdf',
    title: 'Paper',
    category: 'ACEITEKA',
    body: 'ACEITEKA',
    year: '2026',
    archivedAt: '2026-10-20T00:00:00.000Z',
  };
  const { catalog } = mockGitHubRepository({ archivedResources: [resource] });

  await githubResourceService.restoreResource(resource.path);

  assert.equal(catalog.archivedResources.length, 0);
  assert.equal(catalog.resources[0].path, resource.path);
  assert.equal('archivedAt' in catalog.resources[0], false);
  assert.equal(catalog.count, 1);
});

test('moves a file and its catalog entry in the same GitHub commit', async () => {
  process.env.GITHUB_RESOURCES_PAT = 'test-token';
  const resource = {
    path: 'ACEITEKA/2026/paper.pdf',
    title: 'Paper',
    category: 'ACEITEKA',
    body: 'ACEITEKA',
    year: '2026',
  };
  const { calls, catalog } = mockGitHubRepository({
    resources: [resource],
    files: { 'ACEITEKA/2026/paper.pdf': 'file-sha' },
  });

  await githubResourceService.moveResource({
    filePath: resource.path,
    category: 'JJEB',
    year: '2025',
    filename: 'renamed-paper.pdf',
    title: 'Renamed paper',
  });

  const tree = calls.find((call) => call.pathname.endsWith('/git/trees')).tree;
  assert.deepEqual(tree.find((item) => item.path === resource.path), {
    path: resource.path,
    mode: '100644',
    type: 'blob',
    sha: null,
  });
  assert.deepEqual(tree.find((item) => item.path === 'JJEB/2025/renamed-paper.pdf'), {
    path: 'JJEB/2025/renamed-paper.pdf',
    mode: '100644',
    type: 'blob',
    sha: 'file-sha',
  });
  assert.equal(catalog.resources[0].path, 'JJEB/2025/renamed-paper.pdf');
  assert.equal(catalog.resources[0].filename, 'renamed-paper.pdf');
  assert.equal(catalog.resources[0].title, 'Renamed paper');
  assert.equal(catalog.resources[0].url, 'https://raw.githubusercontent.com/trustjonathan/STUDT-HUB-RESOURCES-2026/main/JJEB/2025/renamed-paper.pdf');
  assert.equal(catalog.resources[0].category, 'JJEB');
  assert.equal(catalog.resources[0].year, '2025');
});

test('updates a library title without changing the repository file path', async () => {
  process.env.GITHUB_RESOURCES_PAT = 'test-token';
  const resource = {
    path: 'ACEITEKA/2026/paper.pdf',
    title: 'Paper',
    category: 'ACEITEKA',
    body: 'ACEITEKA',
    year: '2026',
  };
  const { calls, catalog } = mockGitHubRepository({ resources: [resource] });

  await githubResourceService.moveResource({
    filePath: resource.path,
    category: 'ACEITEKA',
    year: '2026',
    filename: 'paper.pdf',
    title: 'Updated library title',
  });

  const tree = calls.find((call) => call.pathname.endsWith('/git/trees')).tree;
  assert.deepEqual(tree.map((item) => item.path), ['resource-catalog.json']);
  assert.equal(catalog.resources[0].path, resource.path);
  assert.equal(catalog.resources[0].title, 'Updated library title');
});
