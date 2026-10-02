import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const frontendRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const sourceRoot = join(frontendRoot, 'src');
const publicRoot = join(frontendRoot, 'public', 'frontend', 'src');
const flipbookPublic = join(frontendRoot, 'public', 'full_page_flipbook_viewer');
const sharedDirectories = ['styles', 'script', 'data', 'assets'];

mkdirSync(publicRoot, { recursive: true });
rmSync(join(publicRoot, 'html'), { recursive: true, force: true });

for (const directory of sharedDirectories) {
  cpSync(join(sourceRoot, directory), join(publicRoot, directory), { recursive: true });
}

rmSync(flipbookPublic, { recursive: true, force: true });
