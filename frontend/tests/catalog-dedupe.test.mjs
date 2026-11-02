import assert from 'node:assert/strict';
import test from 'node:test';
import { canonicalCatalogUrl, dedupeCatalogItemsByUrl } from '../scripts/catalog-dedupe.mjs';

test('canonicalizes equivalent resource URLs', () => {
  assert.equal(
    canonicalCatalogUrl('https://EXAMPLE.com:443/a.pdf?b=2&a=1#preview'),
    'https://example.com/a.pdf?a=1&b=2',
  );
});

test('merges class and subject keys for duplicate URLs', () => {
  const items = dedupeCatalogItemsByUrl([
    { url: 'https://example.com/a.pdf', classKey: 's5', subject: 'Biology', title: 'Same title' },
    { url: 'https://example.com/a.pdf#preview', classKey: 's6', subject: 'Chemistry', title: 'Different title' },
  ]);

  assert.equal(items.length, 1);
  assert.deepEqual(items[0].classKeys, ['s5', 's6']);
  assert.deepEqual(items[0].subjects, ['Biology', 'Chemistry']);
  assert.deepEqual(items[0].classSubjects, [
    { classKey: 's5', subject: 'Biology' },
    { classKey: 's6', subject: 'Chemistry' },
  ]);
  assert.equal(items[0].title, 'Same title');
});

test('keeps different resource URLs even when their titles match', () => {
  const items = dedupeCatalogItemsByUrl([
    { url: 'https://example.com/a.pdf', title: 'Same title', subject: 'Biology' },
    { url: 'https://example.com/b.pdf', title: 'Same title', subject: 'Biology' },
  ]);

  assert.equal(items.length, 2);
});
