// backend/scripts/lib/resourceWalker.js
//
// Walks the local `resources/` folder and hashes every file so the uploader can
// plan, resume and de-duplicate safely.

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// backend/scripts/lib -> backend/scripts -> backend -> repo root
const DEFAULT_RESOURCES_DIR = path.resolve(__dirname, '..', '..', '..', 'resources');

function resolveResourcesDir(dir) {
  return path.resolve(dir || process.env.RESOURCES_DIR || DEFAULT_RESOURCES_DIR);
}

function toPosix(value) {
  return String(value).split(path.sep).join('/');
}

function walkFiles(rootDir, { skipExtensions = [] } = {}) {
  const resolvedRoot = resolveResourcesDir(rootDir);

  if (!fs.existsSync(resolvedRoot)) {
    throw new Error(`Resources folder not found: ${resolvedRoot}`);
  }

  const wanted = skipExtensions.map((ext) => String(ext).toLowerCase());
  const collected = [];

  const visit = (currentDir) => {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const absolutePath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        visit(absolutePath);
        continue;
      }

      if (!entry.isFile()) continue; // ignore symlinks and sockets

      const extension = path.extname(entry.name).toLowerCase();
      if (wanted.includes(extension)) continue;

      const stats = fs.statSync(absolutePath);
      collected.push({
        absPath: absolutePath,
        relPath: toPosix(path.relative(resolvedRoot, absolutePath)),
        originalFilename: entry.name,
        extension,
        sizeBytes: stats.size,
        isEmpty: stats.size === 0
      });
    }
  };

  visit(resolvedRoot);

  return collected.sort((a, b) => a.relPath.localeCompare(b.relPath));
}

function sha256File(absPath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(absPath);

    stream.on('error', reject);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

module.exports = {
  DEFAULT_RESOURCES_DIR,
  resolveResourcesDir,
  walkFiles,
  sha256File,
  toPosix
};