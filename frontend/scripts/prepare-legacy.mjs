import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const frontendRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const sourceRoot = join(frontendRoot, 'src');
const publicRoot = join(frontendRoot, 'public', 'frontend', 'src');
const legacyDirectories = ['styles', 'script', 'data', 'assets'];

mkdirSync(publicRoot, { recursive: true });
rmSync(join(publicRoot, 'html'), { recursive: true, force: true });

for (const directory of legacyDirectories) {
  cpSync(join(sourceRoot, directory), join(publicRoot, directory), { recursive: true });
}