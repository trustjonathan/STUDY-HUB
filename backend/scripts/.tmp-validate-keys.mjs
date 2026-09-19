import path from 'path';
import { sanitizeFileName, buildObjectKey, collectFiles } from './upload.mjs';

// Supabase Storage allowed object-key characters (docs: Storage > Limits)
const ALLOWED = /^[A-Za-z0-9_\-.'!,*&$@=;:?() ]+$/;

const files = collectFiles(path.resolve('..', 'resources'));

let checked = 0;
let invalid = 0;
let rewritten = 0;
let emptySegments = 0;
const rewrittenSamples = [];
const keyOwners = new Map();
let collisions = 0;

for (const file of files) {
  const key = buildObjectKey(file.relative);
  checked += 1;

  const segments = key.split('/');
  for (const segment of segments) {
    if (!segment.length) emptySegments += 1;
    if (!ALLOWED.test(segment)) {
      invalid += 1;
      console.log(`INVALID SEGMENT: ${JSON.stringify(segment)}  (from ${file.relative})`);
    }
  }

  if (keyOwners.has(key)) {
    collisions += 1;
    console.log(`KEY COLLISION: ${key}\n   ${keyOwners.get(key)}\n   ${file.relative}`);
  } else {
    keyOwners.set(key, file.relative);
  }

  const base = file.relative.split('/').pop();
  const sanitized = sanitizeFileName(base);
  if (sanitized !== base) {
    rewritten += 1;
    if (rewrittenSamples.length < 6) rewrittenSamples.push(`  ${base}\n    -> ${sanitized}`);
  }
}

console.log('');
console.log(`files checked    : ${checked}`);
console.log(`invalid keys     : ${invalid}`);
console.log(`empty segments   : ${emptySegments}`);
console.log(`key collisions   : ${collisions}`);
console.log(`unique keys      : ${keyOwners.size}`);
console.log(`names rewritten  : ${rewritten}`);
console.log('');
console.log('sample rewrites:');
console.log(rewrittenSamples.join('\n'));