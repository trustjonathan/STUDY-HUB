import { readdirSync, renameSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const frontendRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const outputRoot = join(frontendRoot, 'dist');
let flattened = 0;

function flatten(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const sourcePath = join(directory, entry.name);
    if (entry.isDirectory()) {
      flatten(sourcePath);
      continue;
    }
    if (!entry.isFile() || !entry.name.endsWith('.html.html')) continue;

    const targetPath = sourcePath.slice(0, -'.html'.length);
    renameSync(sourcePath, targetPath);
    flattened++;
  }
}

flatten(outputRoot);
console.log(`Restored ${flattened} original .html route paths.`);