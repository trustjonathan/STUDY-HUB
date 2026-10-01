import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const frontendRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const sourceRoot = join(frontendRoot, 'src', 'html');
const pagesRoot = join(frontendRoot, 'src', 'pages', 'frontend', 'src', 'html');
const layoutPath = join(frontendRoot, 'src', 'layouts', 'LegacyPageLayout.astro');
let converted = 0;

function attribute(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, 'i'));
  return match?.[2] || '';
}

function prepareHead(head) {
  return head
    .replace(/<title\b[^>]*>[\s\S]*?<\/title\s*>/i, '')
    .replace(/<meta\b[^>]*charset=[^>]*>/i, '')
    .replace(/<meta\b[^>]*name=["']viewport["'][^>]*>/i, '')
    .replace(/<meta\b[^>]*name=["']description["'][^>]*>/i, '')
    .replace(/<script\b[^>]*\bsrc=["'][^"']*home\.js["'][^>]*>\s*<\/script\s*>/gi, '')
    .replace(/<script\b(?![^>]*\bis:inline\b)([^>]*)>/gi, '<script is:inline$1>')
    .replace(/<style\b(?![^>]*\bis:global\b)([^>]*)>/gi, '<style is:global$1>');
}

function migratePage(sourcePath) {
  const source = readFileSync(sourcePath, 'utf8');
  const headMatch = source.match(/<head\b[^>]*>([\s\S]*?)<\/head\s*>/i);
  const bodyOpen = source.match(/<body\b[^>]*>/i);
  const bodyEnd = source.toLowerCase().lastIndexOf('</body>');
  if (!headMatch || !bodyOpen || bodyEnd < bodyOpen.index) {
    throw new Error(`Expected a complete HTML document: ${sourcePath}`);
  }

  const title = headMatch[1].match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i)?.[1]?.trim();
  if (!title) throw new Error(`Missing title in ${sourcePath}`);

  const descriptionTag = headMatch[1].match(/<meta\b[^>]*name=["']description["'][^>]*>/i)?.[0] || '';
  const description = attribute(descriptionTag, 'content');
  const bodyClass = attribute(bodyOpen[0], 'class');
  const dataPage = attribute(bodyOpen[0], 'data-page');
  const head = prepareHead(headMatch[1]);
  const body = source
    .slice(bodyOpen.index + bodyOpen[0].length, bodyEnd)
    .replace(/<body\b([^>]*)>/gi, '<div$1>')
    .replace(/<\/body\s*>/gi, '</div>')
    .replace(/<script\b(?![^>]*\bis:inline\b)([^>]*)>/gi, '<script is:inline$1>');

  const routePath = join(pagesRoot, relative(sourceRoot, sourcePath) + '.astro');
  const importPath = relative(dirname(routePath), layoutPath).split(sep).join('/');
  const importSpecifier = importPath.startsWith('.') ? importPath : `./${importPath}`;
  const page = `---\nimport LegacyPageLayout from ${JSON.stringify(importSpecifier)};\n---\n\n<LegacyPageLayout title=${JSON.stringify(title)}${description ? ` description=${JSON.stringify(description)}` : ''}${dataPage ? ` dataPage=${JSON.stringify(dataPage)}` : ''}${bodyClass ? ` bodyClass=${JSON.stringify(bodyClass)}` : ''}>\n  <Fragment slot="head">\n${head}\n  </Fragment>\n${body}\n</LegacyPageLayout>\n`;

  mkdirSync(dirname(routePath), { recursive: true });
  writeFileSync(routePath, page);
  converted++;
}

function walk(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) walk(path);
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.html')) migratePage(path);
  }
}

if (!existsSync(layoutPath)) throw new Error(`Missing shared layout: ${layoutPath}`);
walk(sourceRoot);
console.log(`Wrapped ${converted} source pages with LegacyPageLayout.`);