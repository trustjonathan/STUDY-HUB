import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const frontendRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const sourceRoot = join(frontendRoot, 'src', 'html');
const pagesRoot = join(frontendRoot, 'src', 'pages', 'frontend', 'src', 'html');
let created = 0;
let existing = 0;

function addInlineDirective(markup) {
  let insideScript = false;
  return markup
    .replace(/<script\b[^>]*\bsrc=["'][^"']*home\.js["'][^>]*>\s*<\/script\s*>/gi, '')
    .replace(/<script\b[^>]*>|<\/script\s*>/gi, (tag) => {
    if (/^<\/script/i.test(tag)) {
      insideScript = false;
      return tag;
    }

    if (insideScript) return tag;
    insideScript = true;
    if (/\bis:inline\b/i.test(tag)) return tag;
    return tag.replace(/^<script\b/i, '<script is:inline');
    });
}

function migrateDirectory(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const sourcePath = join(directory, entry.name);
    if (entry.isDirectory()) {
      migrateDirectory(sourcePath);
      continue;
    }
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.html')) continue;

    const routePath = join(pagesRoot, relative(sourceRoot, sourcePath) + '.astro');
    if (existsSync(routePath)) {
      existing++;
      continue;
    }
    mkdirSync(dirname(routePath), { recursive: true });
    writeFileSync(routePath, addInlineDirective(readFileSync(sourcePath, 'utf8')));
    created++;
  }
}

migrateDirectory(sourceRoot);
console.log(`Created ${created} Astro routes; skipped ${existing} existing routes.`);