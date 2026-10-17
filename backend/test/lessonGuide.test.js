const { afterEach, beforeEach, test } = require("node:test");
const assert = require("node:assert/strict");
const { handler } = require("../api/controllers/lessonGuide.controller");
const sequelize = require("../database/config/database");

const envKeys = [
  "GEMINI_API_KEY",
  "GEMINI_MODEL",
  "GEMINI_FALLBACK_MODEL",
  "OPENAI_API_KEY",
  "OPENAI_KEY",
  "OPEN_AI_API_KEY",
  "OPEN_AI_API_KEY_1",
  "OPEN_AI_API_KEY_2",
  "GITHUB_TOKEN",
  "GITHUB_OWNER",
  "GITHUB_REPO",
  "GITHUB_BRANCH",
  "GITHUB_NOTES_PATH"
];
const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
const originalFetch = global.fetch;
const originalQuery = sequelize.query;

beforeEach(() => {
  for (const key of ["OPENAI_API_KEY", "OPENAI_KEY", "OPEN_AI_API_KEY", "OPEN_AI_API_KEY_1", "OPEN_AI_API_KEY_2"]) {
    delete process.env[key];
  }
});

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
    }
  };
}

afterEach(() => {
  for (const key of envKeys) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
  global.fetch = originalFetch;
  sequelize.query = originalQuery;
});

test("answers a study question through the server-side Gemini model", async () => {
  process.env.GEMINI_API_KEY = "test-key";
  delete process.env.GEMINI_MODEL;
  for (const key of envKeys.slice(2)) delete process.env[key];

  const requests = [];
  global.fetch = async (url, options) => {
    requests.push({ url: new URL(url), body: JSON.parse(options.body) });
    if (requests.length === 1) {
      return { ok: false, status: 503 };
    }
    const text = requests.length === 2 ? "YES" : "Photosynthesis converts light energy into chemical energy.";
    return {
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] })
    };
  };
  const res = responseMock();

  await handler({ body: { topic: "Explain photosynthesis in simple steps" } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.markdown, "Photosynthesis converts light energy into chemical energy.");
  assert.equal(res.body.source, "generated-unsaved");
  assert.equal(requests.length, 3);
  assert.ok(requests.every(({ url }) =>
    url.pathname === "/v1beta/models/gemini-3.8-flash:generateContent"
  ));
  assert.equal(requests[0].body.systemInstruction.parts.length, 1);
  assert.equal(
    requests[2].body.contents[0].parts[0].text,
    "Explain photosynthesis in simple steps"
  );
});

test("tailors Study AI to validated class and subject preferences without publishing a generic cached guide", async () => {
  process.env.GEMINI_API_KEY = "test-key";
  delete process.env.GEMINI_MODEL;
  for (const key of envKeys.slice(2)) delete process.env[key];

  const requests = [];
  global.fetch = async (url, options) => {
    const body = JSON.parse(options.body);
    requests.push({ url: new URL(url), body });
    const isTopicCheck = body.systemInstruction.parts[0].text.includes('strict subject classifier');
    const text = isTopicCheck ? "YES" : "A tailored biology explanation.";
    return {
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] })
    };
  };
  const res = responseMock();

  await handler({
    body: {
      topic: "Explain photosynthesis",
      learningProfile: { classLevel: "S.4", subjects: ["Biology", "Chemistry"] }
    }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.markdown, "A tailored biology explanation.");
  assert.equal(res.body.source, "personalized-unsaved");
  const tutorRequest = requests.find(({ body }) =>
    body.systemInstruction.parts[0].text.includes("Study Hub's academic tutor")
  );
  assert.match(tutorRequest.body.systemInstruction.parts[0].text, /S\.4/);
  assert.match(tutorRequest.body.systemInstruction.parts[0].text, /Biology, Chemistry/);
});

test("rejects unsupported learning preferences before calling Gemini", async () => {
  process.env.GEMINI_API_KEY = "test-key";
  let called = false;
  global.fetch = async () => {
    called = true;
    throw new Error("Gemini should not be called for invalid learning preferences");
  };
  const res = responseMock();

  await handler({
    body: {
      topic: "Explain photosynthesis",
      learningProfile: { classLevel: "Admin", subjects: ["Biology"] }
    }
  }, res);

  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /available class and subject/);
  assert.equal(called, false);
});

test("rejects overlong study questions without calling Gemini", async () => {
  process.env.GEMINI_API_KEY = "test-key";
  let called = false;
  global.fetch = async () => {
    called = true;
    throw new Error("Gemini should not be called for invalid input");
  };
  const res = responseMock();

  await handler({ body: { topic: "x".repeat(301) } }, res);

  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /300 characters/);
  assert.equal(called, false);
});

test("keeps an academic question when the topic check returns no clear decision", async () => {
  process.env.GEMINI_API_KEY = "test-key";
  delete process.env.GEMINI_MODEL;
  for (const key of envKeys.slice(3)) delete process.env[key];
  let calls = 0;
  global.fetch = async () => {
    calls += 1;
    const text = calls === 1 ? "" : "Photosynthesis turns light energy into chemical energy.";
    return {
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] })
    };
  };
  const res = responseMock();

  await handler({ body: { topic: "Explain photosynthesis" } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.markdown, "Photosynthesis turns light energy into chemical energy.");
});

test("refuses a clearly nonacademic topic", async () => {
  process.env.GEMINI_API_KEY = "test-key";
  let calls = 0;
  global.fetch = async () => {
    calls += 1;
    return {
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: "NO" }] } }] })
    };
  };
  const res = responseMock();

  await handler({ body: { topic: "Tell me a joke" } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.refused, true);
  assert.equal(calls, 1);
});

test("uses the fallback Gemini model when the primary model stays unavailable", async () => {
  process.env.GEMINI_API_KEY = "test-key";
  delete process.env.GEMINI_MODEL;
  delete process.env.GEMINI_FALLBACK_MODEL;
  for (const key of envKeys.slice(3)) delete process.env[key];

  const requestedModels = [];
  global.fetch = async (url) => {
    const model = new URL(url).pathname.match(/\/models\/([^:]+)/)?.[1];
    requestedModels.push(model);
    if (model === "gemini-3.8-flash") return { ok: false, status: 503 };
    const text = requestedModels.filter((name) => name === "gemini-3.5-flash").length === 1
      ? "YES"
      : "Photosynthesis converts light energy into chemical energy.";
    return {
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] })
    };
  };
  const res = responseMock();

  await handler({ body: { topic: "Explain photosynthesis" } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.markdown, "Photosynthesis converts light energy into chemical energy.");
  assert.equal(requestedModels.filter((name) => name === "gemini-3.8-flash").length, 6);
  assert.equal(requestedModels.filter((name) => name === "gemini-3.5-flash").length, 2);
});

test("uses and stores only the signed-in learner's relevant study topics", async () => {
  process.env.GEMINI_API_KEY = "test-gemini-key";
  process.env.OPENAI_API_KEY = "test-openai-key";
  process.env.GITHUB_TOKEN = "test-github-token";
  process.env.GITHUB_OWNER = "study-hub";
  process.env.GITHUB_REPO = "notes";
  delete process.env.GITHUB_BRANCH;
  delete process.env.GITHUB_NOTES_PATH;

  const requests = [];
  global.fetch = async (url, options) => {
    const parsedUrl = new URL(url);
    const body = JSON.parse(options.body);
    if (parsedUrl.hostname === "api.openai.com") {
      requests.push({ provider: "openai", body, url: parsedUrl });
      return {
        ok: true,
        json: async () => ({ data: [{ embedding: Array(1_536).fill(0.2) }] })
      };
    }
    requests.push({ provider: "gemini", body, url: parsedUrl });
    const isTopicCheck = body.systemInstruction.parts[0].text.includes("strict subject classifier");
    return {
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: isTopicCheck ? "YES" : "A personalized study guide." }] } }]
      })
    };
  };
  const queries = [];
  sequelize.query = async (sql, options) => {
    queries.push({ sql, options });
    if (sql.includes("SELECT topic")) {
      return [[{ topic: "Earlier algebra questions", created_at: "2026-01-01T00:00:00.000Z" }], {}];
    }
    return [[], {}];
  };
  const res = responseMock();

  await handler({ body: { topic: "Explain quadratic equations" }, user: { id: 42 } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.memorySaved, true);
  assert.equal(requests.filter((request) => request.provider === "openai").length, 1);
  assert.equal(requests.some((request) => request.url?.hostname === "api.github.com"), false);
  const tutorRequest = requests.find((request) =>
    request.provider === "gemini"
    && request.body.systemInstruction.parts[0].text.includes("Study Hub's academic tutor")
  );
  assert.match(tutorRequest.body.systemInstruction.parts[0].text, /Earlier algebra questions/);
  assert.equal(queries.length, 2);
  assert.ok(queries.every(({ options }) => options.replacements.userId === 42));
});

test("keeps tutor answers available and reports when learner memory cannot be saved", async () => {
  process.env.GEMINI_API_KEY = "test-gemini-key";
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_KEY;
  delete process.env.OPEN_AI_API_KEY;
  for (const key of envKeys.slice(5)) delete process.env[key];

  global.fetch = async (_url, options) => {
    const body = JSON.parse(options.body);
    const isTopicCheck = body.systemInstruction.parts[0].text.includes("strict subject classifier");
    return {
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: isTopicCheck ? "YES" : "A study guide without memory." }] } }]
      })
    };
  };
  const res = responseMock();

  await handler({ body: { topic: "Explain quadratic equations" }, user: { id: 42 } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.markdown, "A study guide without memory.");
  assert.equal(res.body.memorySaved, false);
  assert.match(res.body.memoryWarning, /could not retrieve or save account memory/);
});
