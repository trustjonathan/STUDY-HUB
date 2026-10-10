import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSync } from 'esbuild';

const frontendRoot = dirname(dirname(fileURLToPath(import.meta.url)));
for (const envFile of ['.env.local', '.env']) {
	const path = join(frontendRoot, envFile);
	if (existsSync(path)) process.loadEnvFile(path);
}

function configuredApiBase() {
	const configured = process.env.PUBLIC_STUDY_HUB_API_URL?.trim();
	if (!configured) return '';
	const url = new URL(configured);
	const localHost = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
	if (
		!['http:', 'https:'].includes(url.protocol) ||
		(url.protocol !== 'https:' && !localHost) ||
		url.username ||
		url.password ||
		url.search ||
		url.hash
	) {
		throw new Error('PUBLIC_STUDY_HUB_API_URL must be an HTTPS origin (HTTP is allowed only for localhost).');
	}
	return url.href.replace(/\/+$/, '').replace(/&/g, '&amp;');
}

const source = join(frontendRoot, '..', 'full_page_flipbook_viewer');
const destination = join(frontendRoot, 'public', 'full_page_flipbook_viewer');

mkdirSync(join(frontendRoot, 'public'), { recursive: true });
rmSync(destination, { recursive: true, force: true });
cpSync(source, destination, { recursive: true });
const readerIndex = join(destination, 'index.html');
writeFileSync(
	readerIndex,
	readFileSync(readerIndex, 'utf8').replace('__STUDY_HUB_API_BASE__', configuredApiBase()),
	'utf8'
);

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

buildSync({
	entryPoints: [join(source, 'js', 'reader.js')],
	bundle: true,
	format: 'iife',
	nodePaths: [join(frontendRoot, 'node_modules')],
	platform: 'browser',
	target: 'es2020',
	minify: true,
	outfile: join(destination, 'js', 'reader.bundle.js')
});

rmSync(join(destination, 'js', 'reader.js'), { force: true });