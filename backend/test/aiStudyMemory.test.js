const { afterEach, beforeEach, test } = require('node:test');
const assert = require('node:assert/strict');
const sequelize = require('../database/config/database');
const memoryService = require('../services/aiStudyMemory');

const envKeys = [
  'OPEN_AI_API_KEY',
  'OPEN_AI_API_KEY_1',
  'OPEN_AI_API_KEY_2',
  'OPENAI_API_KEY',
  'OPENAI_KEY',
];
const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
const originalFetch = global.fetch;
const originalQuery = sequelize.query;

beforeEach(() => {
  for (const key of envKeys) delete process.env[key];
});

afterEach(() => {
  for (const key of envKeys) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
  global.fetch = originalFetch;
  sequelize.query = originalQuery;
});

test('creates a server-side embedding with the configured OpenAI key alias', async () => {
  process.env.OPEN_AI_API_KEY_2 = 'test-key';
  let request;
  global.fetch = async (url, options) => {
    request = { url: new URL(url), options, body: JSON.parse(options.body) };
    return {
      ok: true,
      json: async () => ({ data: [{ embedding: Array(1_536).fill(0.25) }] }),
    };
  };
  sequelize.query = async () => [[], {}];

  const memories = await memoryService.findRelevantMemories(12, 'Explain photosynthesis');

  assert.deepEqual(memories, []);
  assert.equal(request.url.pathname, '/v1/embeddings');
  assert.equal(request.options.headers.Authorization, 'Bearer test-key');
  assert.equal(request.body.model, 'text-embedding-3-small');
  assert.equal(request.body.input, 'Explain photosynthesis');
});

test('retries embeddings with the next numbered key when the first key is unavailable', async () => {
  process.env.OPEN_AI_API_KEY = 'first-key';
  process.env.OPEN_AI_API_KEY_1 = 'second-key';
  const usedKeys = [];
  global.fetch = async (_url, options) => {
    usedKeys.push(options.headers.Authorization);
    if (usedKeys.length === 1) return { ok: false, status: 429 };
    return {
      ok: true,
      json: async () => ({ data: [{ embedding: Array(1_536).fill(0.25) }] }),
    };
  };
  sequelize.query = async () => [[], {}];

  const memories = await memoryService.findRelevantMemories(12, 'Explain photosynthesis');

  assert.deepEqual(memories, []);
  assert.equal(usedKeys.length, 2);
  assert.notEqual(usedKeys[0], usedKeys[1]);
});

test('scopes vector retrieval, export, and deletion to the authenticated learner ID', async () => {
  process.env.OPENAI_API_KEY = 'test-key';
  global.fetch = async () => ({
    ok: true,
    json: async () => ({ data: [{ embedding: Array(1_536).fill(0.1) }] }),
  });
  const queries = [];
  sequelize.query = async (sql, options) => {
    queries.push({ sql, options });
    if (sql.includes('SELECT topic')) {
      return [[{ topic: 'Earlier algebra topic', created_at: '2026-01-01T00:00:00.000Z' }], {}];
    }
    if (sql.includes('SELECT id')) {
      return [[{ id: 1, topic: 'Earlier algebra topic', embedding: '[0.1]', created_at: '2026-01-01T00:00:00.000Z' }], {}];
    }
    return [[{ id: 1 }, { id: 2 }], {}];
  };

  const related = await memoryService.findRelevantMemories(27, 'Solve a quadratic equation');
  const exported = await memoryService.exportStudyMemory(27);
  const deleted = await memoryService.deleteStudyMemory(27);

  assert.equal(related[0].topic, 'Earlier algebra topic');
  assert.equal(exported.length, 1);
  assert.equal(deleted, 2);
  assert.equal(queries.length, 3);
  assert.ok(queries.every(({ sql, options }) =>
    sql.includes('WHERE user_id = :userId') && options.replacements.userId === 27
  ));
  assert.match(queries[0].sql, /embedding <=> CAST\(:embedding AS vector\)/);
});

test('rejects malformed embedding dimensions before querying the learner table', async () => {
  process.env.OPENAI_API_KEY = 'test-key';
  global.fetch = async () => ({
    ok: true,
    json: async () => ({ data: [{ embedding: [0.1, 0.2] }] }),
  });
  let queried = false;
  sequelize.query = async () => {
    queried = true;
    return [[], {}];
  };

  await assert.rejects(memoryService.findRelevantMemories(27, 'Photosynthesis'), /invalid vector/);
  assert.equal(queried, false);
});
