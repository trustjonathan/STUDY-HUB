import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const frontendRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const source = join(frontendRoot, '..', 'full_page_flipbook_viewer');
const destination = join(frontendRoot, 'public', 'full_page_flipbook_viewer');

mkdirSync(join(frontendRoot, 'public'), { recursive: true });
rmSync(destination, { recursive: true, force: true });
cpSync(source, destination, { recursive: true });

const browserLibraries = [
	['jszip/dist/jszip.min.js', 'js/jszip.min.js'],
	['jszip/LICENSE.markdown', 'js/jszip.LICENSE.txt'],
	['docx-preview/dist/docx-preview.min.js', 'js/docx-preview.min.js'],
	['docx-preview/LICENSE', 'js/docx-preview.LICENSE.txt'],
	['rtf.js/dist/WMFJS.bundle.min.js', 'js/WMFJS.bundle.min.js'],
	['rtf.js/dist/EMFJS.bundle.min.js', 'js/EMFJS.bundle.min.js'],
	['rtf.js/dist/RTFJS.bundle.min.js', 'js/RTFJS.bundle.min.js'],
	['rtf.js/dist/RTFJS.bundle.min.js.LICENSE.txt', 'js/RTFJS.LICENSE.txt'],
	['rtf.js/LICENSE', 'js/rtf.js.LICENSE.txt']
];

for (const [libraryPath, viewerPath] of browserLibraries) {
	cpSync(join(frontendRoot, 'node_modules', libraryPath), join(destination, viewerPath));
}