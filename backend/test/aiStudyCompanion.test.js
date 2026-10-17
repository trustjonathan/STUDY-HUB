const { afterEach, test } = require("node:test");
const assert = require("node:assert/strict");
const { handler } = require("../api/controllers/aiStudyCompanion.controller");

const originalApiKey = process.env.GEMINI_API_KEY;
const originalGeminiModel = process.env.GEMINI_MODEL;
const originalFetch = global.fetch;

function responseMock() {
  return {
    statusCode: 200,
    headers: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
    set(name, value) {
      this.headers[name] = value;
      return this;
    }
  };
}

afterEach(() => {
  if (originalApiKey === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = originalApiKey;
  if (originalGeminiModel === undefined) delete process.env.GEMINI_MODEL;
  else process.env.GEMINI_MODEL = originalGeminiModel;
  global.fetch = originalFetch;
});

test("rejects missing page images before calling Gemini", async () => {
  process.env.GEMINI_API_KEY = "test-key";
  delete process.env.GEMINI_MODEL;
  const res = responseMock();

  await handler({ body: { prompt: "Explain this page", pageNumber: 1 } }, res);

  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /page image/i);
});

test("sends the page and conversation to Gemini without returning credentials", async () => {
  process.env.GEMINI_API_KEY = "test-key";
  let requestUrl;
  let requestBody;
  let requestHeaders;
  global.fetch = async (url, options) => {
    requestUrl = url;
    requestHeaders = options.headers;
    requestBody = JSON.parse(options.body);
    return {
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: "Here is the explanation." }] } }]
      })
    };
  };
  const res = responseMock();

  await handler({
    body: {
      prompt: "Explain the diagram",
      pageNumber: 4,
      pageImage: Buffer.from("page image").toString("base64"),
      history: [{ role: "user", text: "What is shown?" }, { role: "model", text: "A diagram." }]
    }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { reply: "Here is the explanation." });
  assert.equal(new URL(requestUrl).pathname, "/v1beta/models/gemini-3.5-flash:generateContent");
  assert.equal(new URL(requestUrl).searchParams.has("key"), false);
  assert.equal(requestHeaders["x-goog-api-key"], "test-key");
  assert.equal(requestBody.systemInstruction.parts.length, 1);
  assert.equal(requestBody.contents.at(-1).parts[1].inlineData.mimeType, "image/jpeg");
  assert.equal(requestBody.contents.at(-1).parts[1].inlineData.data, Buffer.from("page image").toString("base64"));
  assert.match(requestBody.contents.at(-1).parts[0].text, /page 4/i);
  assert.equal(JSON.stringify(res.body).includes("test-key"), false);
});
