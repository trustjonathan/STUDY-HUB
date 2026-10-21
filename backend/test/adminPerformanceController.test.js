const test = require('node:test');
const assert = require('node:assert/strict');
const openAiKeyPool = require('../services/openAiKeyPool');
const performanceMonitoringService = require('../services/performanceMonitoringService');

const originalGetOpenAiKeys = openAiKeyPool.getOpenAiKeys;
const originalWithOpenAiClient = openAiKeyPool.withOpenAiClient;
const originalGetDashboardMetrics = performanceMonitoringService.getDashboardMetrics;
let getOpenAiKeys = originalGetOpenAiKeys;
let withOpenAiClient = originalWithOpenAiClient;
openAiKeyPool.getOpenAiKeys = (...args) => getOpenAiKeys(...args);
openAiKeyPool.withOpenAiClient = (...args) => withOpenAiClient(...args);
const controller = require('../api/controllers/adminPerformanceController');

function responseMock() {
  return {
    statusCode: 200,
    body: null,
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

test.afterEach(() => {
  getOpenAiKeys = originalGetOpenAiKeys;
  withOpenAiClient = originalWithOpenAiClient;
  performanceMonitoringService.getDashboardMetrics = originalGetDashboardMetrics;
});

test('generates GPT-4.1-mini insights from aggregate metrics only', async () => {
  const aggregateMetrics = {
    services: { api: 'operational', postgres: 'operational', resourceCatalog: 'fallback' },
    runtime: { api: { requests: 20, errors: 1, averageLatencyMs: 35 } },
    product: { accounts: { total: 120 }, payments: { pending: 4 }, resources: { total: 800 } },
  };
  let request;
  getOpenAiKeys = () => ['configured-key'];
  withOpenAiClient = async (operation) => operation({
    responses: {
      create: async (value) => {
        request = value;
        return { output_text: 'Health summary: API is operational with one recent server error.' };
      },
    },
  });
  performanceMonitoringService.getDashboardMetrics = async () => aggregateMetrics;
  const res = responseMock();

  await controller.getInsights({}, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.model, 'gpt-4.1-mini');
  assert.match(res.body.insights, /one recent server error/);
  assert.equal(request.model, 'gpt-4.1-mini');
  assert.equal(request.max_output_tokens, 650);
  assert.equal(JSON.stringify(request.input).includes('configured-key'), false);
  assert.equal(JSON.stringify(request.input).includes('@'), false);
});

test('returns a clear unavailable response when OpenAI is not configured', async () => {
  getOpenAiKeys = () => [];
  const res = responseMock();

  await controller.getInsights({}, res);

  assert.equal(res.statusCode, 503);
  assert.match(res.body.error, /no OpenAI key is configured/);
});
