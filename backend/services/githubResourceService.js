const GITHUB_API = 'https://api.github.com';
const OWNER = 'trustjonathan';
const REPO = 'STUDT-HUB-RESOURCES-2026';
const BRANCH = 'main';

class GitHubResourceError extends Error {
  constructor(message, statusCode = 502) {
    super(message);
    this.name = 'GitHubResourceError';
    this.statusCode = statusCode;
  }
}

function getConfiguration() {
  const token = process.env.GITHUB_RESOURCES_PAT;
  if (!token) {
    throw new GitHubResourceError('GitHub resource uploads are not configured on the server.', 503);
  }

  return {
    owner: OWNER,
    repo: REPO,
    branch: BRANCH,
    token,
  };
}

function encodePath(value) {
  return String(value).split('/').map(encodeURIComponent).join('/');
}

function resourceUrlForPath(filePath) {
  return `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${encodePath(filePath)}`;
}

async function githubRequest(path, options = {}, allowNotFound = false) {
  const { token } = getConfiguration();
  const response = await fetch(`${GITHUB_API}${path}`, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'StudyHub-Backend',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });

  if (allowNotFound && response.status === 404) return null;

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new GitHubResourceError('GitHub returned an invalid API response.');
  }
  if (!response.ok) {
    const statusCode = response.status === 422 ? 409 : 502;
    const detail = typeof payload?.message === 'string' ? ` ${payload.message}` : '';
    throw new GitHubResourceError(`GitHub request failed (HTTP ${response.status}).${detail}`, statusCode);
  }
  return payload;
}

function categoryCounts(resources, property) {
  return resources.reduce((counts, resource) => {
    const value = resource[property];
    if (typeof value === 'string' && value.trim()) {
      counts[value] = (counts[value] || 0) + 1;
    }
    return counts;
  }, Object.create(null));
}

function buildUpdatedCatalog(catalog, resource) {
  if (!catalog || typeof catalog !== 'object' || !Array.isArray(catalog.resources)) {
    throw new GitHubResourceError('The resource catalog has an invalid format.', 502);
  }
  if (catalog.resources.some((item) => item.path === resource.path)) {
    throw new GitHubResourceError('A catalog entry already exists for this file path.', 409);
  }

  const resources = [resource, ...catalog.resources];
  const countsByYear = categoryCounts(
    resources.map((item) => ({ year: typeof item.year === 'string' && item.year ? item.year : 'Undated' })),
    'year',
  );
  return {
    ...catalog,
    schemaVersion: catalog.schemaVersion || 2,
    generatedAt: new Date().toISOString(),
    count: resources.length,
    trending2026Count: countsByYear['2026'] || 0,
    countsByBody: categoryCounts(resources, 'body'),
    countsByCategory: categoryCounts(resources, 'category'),
    countsByYear,
    resources,
  };
}

async function listCategories() {
  const { owner, repo, branch } = getConfiguration();
  const contents = await githubRequest(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents?ref=${encodeURIComponent(branch)}`,
  );
  if (!Array.isArray(contents)) {
    throw new GitHubResourceError('The resource repository root returned an invalid listing.');
  }

  const ignored = new Set(['.git', '.github', 'node_modules', 'scripts']);
  return contents
    .filter((entry) => entry.type === 'dir' && !ignored.has(entry.name))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

async function commitResource({ filePath, fileBuffer, resource }) {
  const { owner, repo, branch } = getConfiguration();
  const repositoryPath = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  const branchPath = encodePath(branch);
  const resourceContent = await githubRequest(
    `${repositoryPath}/contents/${encodePath(filePath)}?ref=${encodeURIComponent(branch)}`,
    {},
    true,
  );
  if (resourceContent) {
    throw new GitHubResourceError('A file with this name already exists in that category and year. Rename the file or choose another year.', 409);
  }

  const catalogContent = await githubRequest(
    `${repositoryPath}/contents/resource-catalog.json?ref=${encodeURIComponent(branch)}`,
  );
  if (typeof catalogContent?.content !== 'string') {
    throw new GitHubResourceError('The resource catalog could not be read from GitHub.');
  }

  let catalog;
  try {
    catalog = JSON.parse(Buffer.from(catalogContent.content, 'base64').toString('utf8'));
  } catch {
    throw new GitHubResourceError('The resource catalog contains invalid JSON.');
  }
  const updatedCatalog = buildUpdatedCatalog(catalog, resource);
  const catalogBuffer = Buffer.from(JSON.stringify(updatedCatalog, null, 2), 'utf8');
  const createBlob = async (content) => githubRequest(`${repositoryPath}/git/blobs`, {
    method: 'POST',
    body: JSON.stringify({ content: content.toString('base64'), encoding: 'base64' }),
  });

  const [resourceBlob, catalogBlob] = await Promise.all([
    createBlob(fileBuffer),
    createBlob(catalogBuffer),
  ]);
  const branchRef = await githubRequest(`${repositoryPath}/git/ref/heads/${branchPath}`);
  const parentCommit = await githubRequest(`${repositoryPath}/git/commits/${branchRef.object.sha}`);
  const tree = await githubRequest(`${repositoryPath}/git/trees`, {
    method: 'POST',
    body: JSON.stringify({
      base_tree: parentCommit.tree.sha,
      tree: [
        { path: filePath, mode: '100644', type: 'blob', sha: resourceBlob.sha },
        { path: 'resource-catalog.json', mode: '100644', type: 'blob', sha: catalogBlob.sha },
      ],
    }),
  });
  const commit = await githubRequest(`${repositoryPath}/git/commits`, {
    method: 'POST',
    body: JSON.stringify({
      message: `Add ${resource.title} to ${resource.category}`,
      tree: tree.sha,
      parents: [branchRef.object.sha],
    }),
  });

  await githubRequest(`${repositoryPath}/git/refs/heads/${branchPath}`, {
    method: 'PATCH',
    body: JSON.stringify({ sha: commit.sha, force: false }),
  });

  return {
    commitSha: commit.sha,
    catalog: updatedCatalog,
  };
}

module.exports = {
  GitHubResourceError,
  buildUpdatedCatalog,
  commitResource,
  listCategories,
  resourceUrlForPath,
};
