const { afterEach, test } = require("node:test");
const assert = require("node:assert/strict");
const { handler } = require("../api/controllers/lessonGuide.controller");

const envKeys = [
  "GEMINI_API_KEY",
  "GEMINI_MODEL",
  "GEMINI_FALLBACK_MODEL",
  "GITHUB_TOKEN",
  "GITHUB_OWNER",
  "GITHUB_REPO",
  "GITHUB_BRANCH",
  "GITHUB_NOTES_PATH"
];
const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
const originalFetch = global.fetch;

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
