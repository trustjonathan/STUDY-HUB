const test = require('node:test');
const assert = require('node:assert/strict');
const performanceMonitoringService = require('../services/performanceMonitoringService');

test('summarizes recent API request samples without retaining URL path parameters', () => {
  const now = Date.now();
  performanceMonitoringService.recordApiSample({
    method: 'GET',
    route: 'GET /api/resources/:id',
    statusCode: 200,
    durationMs: 20,
    timestamp: now - 10_000,
  });
  performanceMonitoringService.recordApiSample({
    method: 'POST',
    route: 'POST /api/document-payments/requests',
    statusCode: 503,
    durationMs: 80,
    timestamp: now - 5_000,
  });

  const metrics = performanceMonitoringService.getRuntimeMetrics(now);

  assert.equal(metrics.api.windowMinutes, 60);
  assert.equal(metrics.api.requests, 2);
  assert.equal(metrics.api.errors, 1);
  assert.equal(metrics.api.errorRate, 0.5);
  assert.equal(metrics.api.averageLatencyMs, 50);
  assert.equal(metrics.api.p95LatencyMs, 80);
  assert.equal(
    metrics.api.endpoints.find(({ route }) => route === 'POST /api/document-payments/requests').errors,
    1,
  );
  assert.equal(metrics.api.endpoints.some(({ route }) => route.includes('learner@example.com')), false);
  assert.equal(metrics.retention.maxAgeHours, 24);
});
