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
  if (
    catalog.resources.some((item) => item.path === resource.path)
    || (Array.isArray(catalog.archivedResources) && catalog.archivedResources.some((item) => item.path === resource.path))
  ) {
    throw new GitHubResourceError('A catalog entry already exists for this file path.', 409);
  }

  return recalculateCatalog({
    ...catalog,
    resources: [resource, ...catalog.resources],
  });
}

function recalculateCatalog(catalog) {
  const resources = catalog.resources;
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

async function getCatalog(repositoryPath, branch) {
  const catalogContent = await githubRequest(
    `${repositoryPath}/contents/resource-catalog.json?ref=${encodeURIComponent(branch)}`,
  );
  if (typeof catalogContent?.content !== 'string' || typeof catalogContent.sha !== 'string') {
    throw new GitHubResourceError('The resource catalog could not be read from GitHub.');
  }

  try {
    const catalog = JSON.parse(Buffer.from(catalogContent.content, 'base64').toString('utf8'));
    if (!catalog || typeof catalog !== 'object' || !Array.isArray(catalog.resources)) {
      throw new Error('Invalid resource catalog shape.');
    }
    if (!Array.isArray(catalog.archivedResources)) catalog.archivedResources = [];
    return { catalog, sha: catalogContent.sha };
  } catch {
    throw new GitHubResourceError('The resource catalog contains invalid JSON or an unsupported format.');
  }
}

async function writeCatalogCommit({ repositoryPath, branch, catalog, fileChanges = [], message }) {
  const catalogBlob = await githubRequest(`${repositoryPath}/git/blobs`, {
    method: 'POST',
    body: JSON.stringify({
      content: Buffer.from(JSON.stringify(catalog, null, 2), 'utf8').toString('base64'),
      encoding: 'base64',
    }),
  });
  const branchPath = encodePath(branch);
  const branchRef = await githubRequest(`${repositoryPath}/git/ref/heads/${branchPath}`);
  const parentCommit = await githubRequest(`${repositoryPath}/git/commits/${branchRef.object.sha}`);
  const tree = await githubRequest(`${repositoryPath}/git/trees`, {
    method: 'POST',
    body: JSON.stringify({
      base_tree: parentCommit.tree.sha,
      tree: [
        ...fileChanges,
        { path: 'resource-catalog.json', mode: '100644', type: 'blob', sha: catalogBlob.sha },
      ],
    }),
  });
  const commit = await githubRequest(`${repositoryPath}/git/commits`, {
    method: 'POST',
    body: JSON.stringify({
      message,
      tree: tree.sha,
      parents: [branchRef.object.sha],
    }),
  });

  await githubRequest(`${repositoryPath}/git/refs/heads/${branchPath}`, {
    method: 'PATCH',
    body: JSON.stringify({ sha: commit.sha, force: false }),
  });
  return commit.sha;
}

function findCatalogResource(catalog, filePath, collectionName) {
  const index = catalog[collectionName].findIndex((resource) => resource.path === filePath);
  if (index < 0) {
    throw new GitHubResourceError('The requested resource was not found in the selected catalog.', 404);
  }
  return index;
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

async function listResources() {
  const { owner, repo, branch } = getConfiguration();
  const repositoryPath = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  const { catalog } = await getCatalog(repositoryPath, branch);
  return {
    resources: catalog.resources,
    archivedResources: catalog.archivedResources,
  };
}

async function commitResource({ filePath, fileBuffer, resource }) {
  const { owner, repo, branch } = getConfiguration();
  const repositoryPath = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  const resourceContent = await githubRequest(
    `${repositoryPath}/contents/${encodePath(filePath)}?ref=${encodeURIComponent(branch)}`,
    {},
    true,
  );
  if (resourceContent) {
    throw new GitHubResourceError('A file with this name already exists in that category and year. Rename the file or choose another year.', 409);
  }

  const { catalog } = await getCatalog(repositoryPath, branch);
  const updatedCatalog = buildUpdatedCatalog(catalog, resource);
  const resourceBlob = await githubRequest(`${repositoryPath}/git/blobs`, {
    method: 'POST',
    body: JSON.stringify({ content: fileBuffer.toString('base64'), encoding: 'base64' }),
  });
  const commitSha = await writeCatalogCommit({
    repositoryPath,
    branch,
    catalog: updatedCatalog,
    fileChanges: [{ path: filePath, mode: '100644', type: 'blob', sha: resourceBlob.sha }],
    message: `Add ${resource.title} to ${resource.category}`,
  });

  return {
    commitSha,
    catalog: updatedCatalog,
  };
}

async function archiveResource(filePath) {
  const { owner, repo, branch } = getConfiguration();
  const repositoryPath = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  const { catalog } = await getCatalog(repositoryPath, branch);
  const index = findCatalogResource(catalog, filePath, 'resources');
  const [resource] = catalog.resources.splice(index, 1);
  catalog.archivedResources.unshift({ ...resource, archivedAt: new Date().toISOString() });
  const updatedCatalog = recalculateCatalog(catalog);
  const commitSha = await writeCatalogCommit({
    repositoryPath,
    branch,
    catalog: updatedCatalog,
    message: `Archive ${resource.title} from the public library`,
  });
  return { commitSha, resource };
}

async function restoreResource(filePath) {
  const { owner, repo, branch } = getConfiguration();
  const repositoryPath = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  const { catalog } = await getCatalog(repositoryPath, branch);
  const index = findCatalogResource(catalog, filePath, 'archivedResources');
  const [resource] = catalog.archivedResources.splice(index, 1);
  const { archivedAt, ...activeResource } = resource;
  if (catalog.resources.some((item) => item.path === activeResource.path)) {
    throw new GitHubResourceError('A public resource already uses this repository path.', 409);
  }
  catalog.resources.unshift(activeResource);
  const updatedCatalog = recalculateCatalog(catalog);
  const commitSha = await writeCatalogCommit({
    repositoryPath,
    branch,
    catalog: updatedCatalog,
    message: `Restore ${resource.title} to the public library`,
  });
  return { commitSha, resource: activeResource };
}

async function moveResource({ filePath, category, year, filename, title }) {
  if (
    typeof category !== 'string'
    || !category.trim()
    || category.trim().length > 100
    || /[\\/\u0000-\u001f\u007f]/.test(category)
    || !/^(?:19\d{2}|20\d{2}|Undated)$/.test(year)
  ) {
    throw new GitHubResourceError('Choose a valid destination category and year.', 400);
  }
  const destinationCategory = category.trim();
  const { owner, repo, branch } = getConfiguration();
  const repositoryPath = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  const { catalog } = await getCatalog(repositoryPath, branch);
  const collections = ['resources', 'archivedResources'];
  const collectionName = collections.find((name) => catalog[name].some((resource) => resource.path === filePath));
  if (!collectionName) throw new GitHubResourceError('The requested resource was not found in the selected catalog.', 404);

  const resourceIndex = findCatalogResource(catalog, filePath, collectionName);
  const resource = catalog[collectionName][resourceIndex];
  const currentFilename = filePath.split('/').pop();
  const destinationFilename = typeof filename === 'string' && filename.trim() ? filename.trim() : currentFilename;
  const destinationTitle = typeof title === 'string' && title.trim() ? title.trim() : resource.title;
  if (
    destinationFilename.length > 180
    || destinationFilename === '.'
    || destinationFilename === '..'
    || /[\\/\u0000-\u001f\u007f]/.test(destinationFilename)
    || !/\.[A-Za-z0-9]+$/.test(destinationFilename)
  ) {
    throw new GitHubResourceError('Choose a valid filename with its extension.', 400);
  }
  const destinationPath = `${destinationCategory}/${year}/${destinationFilename}`;
  if (destinationPath === filePath && destinationTitle === resource.title) {
    throw new GitHubResourceError('Change the destination or library title before saving.', 400);
  }
  if (
    destinationPath !== filePath
    && catalog.resources.concat(catalog.archivedResources).some((item) => item.path === destinationPath)
  ) {
    throw new GitHubResourceError('A catalog entry already uses that category, year, and filename.', 409);
  }

  const fileChanges = [];
  if (destinationPath !== filePath) {
    const sourceContent = await githubRequest(
      `${repositoryPath}/contents/${encodePath(filePath)}?ref=${encodeURIComponent(branch)}`,
    );
    if (typeof sourceContent?.sha !== 'string') {
      throw new GitHubResourceError('The source file could not be read from the repository.');
    }
    const destinationContent = await githubRequest(
      `${repositoryPath}/contents/${encodePath(destinationPath)}?ref=${encodeURIComponent(branch)}`,
      {},
      true,
    );
    if (destinationContent) {
      throw new GitHubResourceError('A file with this name already exists in the destination folder.', 409);
    }
    fileChanges.push(
      { path: filePath, mode: '100644', type: 'blob', sha: null },
      { path: destinationPath, mode: '100644', type: 'blob', sha: sourceContent.sha },
    );
  }

  const movedResource = {
    ...resource,
    title: destinationTitle,
    filename: destinationFilename,
    path: destinationPath,
    url: resourceUrlForPath(destinationPath),
    category: destinationCategory,
    body: destinationCategory,
    year,
  };
  catalog[collectionName][resourceIndex] = movedResource;
  const updatedCatalog = recalculateCatalog(catalog);
  const commitSha = await writeCatalogCommit({
    repositoryPath,
    branch,
    catalog: updatedCatalog,
    fileChanges,
    message: `Move or rename ${resource.title} to ${destinationPath}`,
  });

  return { commitSha, resource: movedResource };
}

module.exports = {
  archiveResource,
  GitHubResourceError,
  buildUpdatedCatalog,
  commitResource,
  listCategories,
  listResources,
  moveResource,
  restoreResource,
  resourceUrlForPath,
};
