const { afterEach, test } = require('node:test');
const assert = require('node:assert/strict');
const controller = require('../api/controllers/studyPlan.controller');
const sequelize = require('../database/config/database');
const User = require('../database/models/postgres/user');

const originalQuery = sequelize.query;
const originalTransaction = sequelize.transaction;
const originalFindByPk = User.findByPk;
const originalFetch = global.fetch;
const envKeys = ['GEMINI_API_KEY', 'GEMINI_MODEL', 'GEMINI_FALLBACK_MODEL', 'STUDY_RESOURCE_GEMINI_MODEL'];
const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));

function responseMock() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

function testUser() {
  return {
    id: 41,
    learnerType: 'student',
    educationLevel: 'secondary',
    classLevel: 'S.2',
    secondaryTrack: 'O-Level',
    universityCourse: null,
    universityYear: null,
    subjects: ['Biology', 'Chemistry'],
  };
}

afterEach(() => {
  sequelize.query = originalQuery;
  sequelize.transaction = originalTransaction;
  User.findByPk = originalFindByPk;
  global.fetch = originalFetch;
  for (const key of envKeys) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
});

test('generates and persists a study plan tailored to the signed-in learner profile', async () => {
  process.env.GEMINI_API_KEY = 'test-key';
  User.findByPk = async () => testUser();
  const queries = [];
  sequelize.query = async (sql, options) => {
    queries.push({ sql, options });
    if (sql.includes('SELECT plan, streak_count')) return [[]];
    return [[{
      plan: JSON.parse(options.replacements.plan),
      streak_count: 5,
      last_study_date: new Date().toISOString().slice(0, 10),
    }]];
  };
  const plan = {
    title: 'Biology and Chemistry foundations',
    summary: 'Build understanding through short daily sessions.',
    topics: [1, 2, 3, 4, 5].map((day) => ({
      id: `topic-${day}`,
      title: `Study topic ${day}`,
      subject: day % 2 ? 'Biology' : 'Chemistry',
      day,
      objective: 'Explain one core concept.',
      practice: 'Complete a short practice question.',
      status: 'upcoming',
    })),
  };
  let modelRequest;
  global.fetch = async (url, options) => {
    modelRequest = { url: new URL(url), body: JSON.parse(options.body) };
    return {
      ok: true,
      status: 200,
      json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(plan) }] } }] }),
    };
  };
  const res = responseMock();

  await controller.generatePlan({ user: { id: 41 }, body: {} }, res);

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.plan.topics.length, 5);
  assert.equal(res.body.streakCount, 5);
  assert.match(modelRequest.body.contents[0].parts[0].text, /S\.2/);
  assert.match(modelRequest.body.contents[0].parts[0].text, /Biology/);
  assert.match(queries[1].sql, /streak_count, last_study_date/);
  assert.match(queries[1].sql, /VALUES \(:userId, CAST\(:plan AS jsonb\), 5, CURRENT_DATE\)/);
  assert.match(queries[1].sql, /ON CONFLICT \(user_id\) DO NOTHING/);
});

test('uses the resource-curator model and returns only IDs from the supplied library candidates', async () => {
  process.env.GEMINI_API_KEY = 'test-key';
  process.env.STUDY_RESOURCE_GEMINI_MODEL = 'gemini-resource-curator';
  User.findByPk = async () => testUser();
  sequelize.query = async (sql) => {
    if (sql.includes('SELECT plan, streak_count')) return [[{
      plan: { title: 'Study week', topics: [{ subject: 'Biology', title: 'Cells', status: 'upcoming' }] },
      streak_count: 5,
    }]];
    return [[{ topic: 'Cell structure' }]];
  };
  let requestedModel;
  global.fetch = async (url) => {
    requestedModel = new URL(url).pathname;
    return {
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({ recommendations: [
                { id: 'ft:valid-resource', reason: 'Supports your upcoming cell topic.' },
                { id: 'ft:not-in-the-catalog', reason: 'Should not be returned.' },
              ] }),
            }],
          },
        }],
      }),
    };
  };
  const res = responseMock();

  await controller.recommendResources({
    user: { id: 41 },
    body: {
      candidates: [{ id: 'ft:valid-resource', title: 'Cell Biology Notes', subject: 'Biology', type: 'Notes' }],
    },
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(requestedModel, '/v1beta/models/gemini-resource-curator:generateContent');
  assert.deepEqual(res.body.recommendations, [{
    id: 'ft:valid-resource',
    reason: 'Supports your upcoming cell topic.',
  }]);
});

test('records completed study topics once and advances the daily streak', async () => {
  User.findByPk = async () => testUser();
  const row = {
    plan: {
      title: 'Study week',
      summary: 'Daily revision.',
      topics: [{
        id: 'cell-structure',
        title: 'Cell structure',
        subject: 'Biology',
        day: 1,
        objective: 'Name cell structures.',
        practice: 'Label a cell diagram.',
        status: 'upcoming',
      }],
    },
    streak_count: 0,
    last_study_date: null,
  };
  const activity = [];
  let activityInsertCount = 0;
  sequelize.transaction = async () => ({ commit: async () => {}, rollback: async () => {} });
  sequelize.query = async (sql, options = {}) => {
    if (sql.includes('SELECT plan, streak_count')) return [[row]];
    if (sql.includes('SELECT CURRENT_DATE')) {
      const today = new Date().toISOString().slice(0, 10);
      const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
      return [[{ today, yesterday }]];
    }
    if (sql.includes('UPDATE public.study_hub_study_plans')) {
      row.plan = JSON.parse(options.replacements.plan);
      row.streak_count = options.replacements.streak;
      row.last_study_date = new Date().toISOString().slice(0, 10);
      return [[]];
    }
    if (sql.includes('INSERT INTO public.study_hub_study_activity')) {
      activityInsertCount += 1;
      activity.push({ activity_date: new Date().toISOString().slice(0, 10), completed_topics: 1, reading_minutes: 20 });
      return [[]];
    }
    if (sql.includes('FROM public.study_hub_study_activity')) return [activity];
    throw new Error('Unexpected study-plan query in test.');
  };

  const firstResponse = responseMock();
  await controller.completeTopic({ user: { id: 41 }, body: { topicId: 'cell-structure' } }, firstResponse);
  assert.equal(firstResponse.statusCode, 200);
  assert.equal(firstResponse.body.plan.topics[0].status, 'completed');
  assert.equal(firstResponse.body.streakCount, 1);

  const repeatedResponse = responseMock();
  await controller.completeTopic({ user: { id: 41 }, body: { topicId: 'cell-structure' } }, repeatedResponse);
  assert.equal(activityInsertCount, 1);
  assert.equal(repeatedResponse.body.activity[0].completed_topics, 1);
});
