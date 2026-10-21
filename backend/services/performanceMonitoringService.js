const { QueryTypes } = require('sequelize');
const sequelize = require('../database/config/database');
const resourceService = require('./resourceService');

const MAX_REQUEST_SAMPLES = 5000;
const REQUEST_RETENTION_MS = 24 * 60 * 60 * 1000;
const requestSamples = [];
const startedAt = Date.now();

function percentile(values, fraction) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(Math.ceil(sorted.length * fraction) - 1, sorted.length - 1)];
}

function routeLabel(req) {
  const route = req.route?.path;
  if (typeof route === 'string') return `${req.method} ${req.baseUrl || ''}${route}`;
  return `${req.method} ${req.baseUrl || '/api'} (unmatched)`;
}

function recordApiSample({ method, route, statusCode, durationMs, timestamp = Date.now() }) {
  if (!Number.isFinite(timestamp) || !Number.isFinite(durationMs) || durationMs < 0) return;
  requestSamples.push({
    method: String(method || 'GET').toUpperCase(),
    route: String(route || 'API (unmatched)').slice(0, 180),
    statusCode: Number(statusCode) || 0,
    durationMs,
    timestamp,
  });

  const cutoff = timestamp - REQUEST_RETENTION_MS;
  while (requestSamples.length && (requestSamples[0].timestamp < cutoff || requestSamples.length > MAX_REQUEST_SAMPLES)) {
    requestSamples.shift();
  }
}

function recordApiRequest(req, res, next) {
  if (typeof req.path !== 'string' || !req.path.startsWith('/api/')) return next();
  const started = performance.now();
  res.once('finish', () => {
    recordApiSample({
      method: req.method,
      route: routeLabel(req),
      statusCode: res.statusCode,
      durationMs: Math.max(0, performance.now() - started),
    });
  });
  return next();
}

function getRuntimeMetrics(now = Date.now()) {
  const windowStart = now - 60 * 60 * 1000;
  const recent = requestSamples.filter((sample) => sample.timestamp >= windowStart);
  const latencies = recent.map((sample) => sample.durationMs);
  const failed = recent.filter((sample) => sample.statusCode >= 500).length;
  const endpoints = new Map();

  for (const sample of recent) {
    const endpoint = endpoints.get(sample.route) || { route: sample.route, requests: 0, errors: 0, latencies: [] };
    endpoint.requests += 1;
    if (sample.statusCode >= 500) endpoint.errors += 1;
    endpoint.latencies.push(sample.durationMs);
    endpoints.set(sample.route, endpoint);
  }

  const hourlyTraffic = Array.from({ length: 12 }, (_, index) => {
    const bucketStart = now - (11 - index) * 60 * 60 * 1000;
    const bucketEnd = bucketStart + 60 * 60 * 1000;
    return {
      label: new Date(bucketStart).toISOString(),
      requests: requestSamples.filter((sample) => sample.timestamp >= bucketStart && sample.timestamp < bucketEnd).length,
    };
  });

  return {
    observedAt: new Date(now).toISOString(),
    process: {
      startedAt: new Date(startedAt).toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      memoryBytes: process.memoryUsage().rss,
      nodeVersion: process.version,
    },
    api: {
      windowMinutes: 60,
      requests: recent.length,
      errors: failed,
      errorRate: recent.length ? failed / recent.length : 0,
      averageLatencyMs: latencies.length ? latencies.reduce((sum, value) => sum + value, 0) / latencies.length : 0,
      p95LatencyMs: percentile(latencies, 0.95),
      hourlyTraffic,
      endpoints: [...endpoints.values()]
        .map(({ route, requests, errors, latencies: samples }) => ({
          route,
          requests,
          errors,
          averageLatencyMs: samples.reduce((sum, value) => sum + value, 0) / samples.length,
          p95LatencyMs: percentile(samples, 0.95),
        }))
        .sort((left, right) => right.requests - left.requests)
        .slice(0, 8),
    },
    retention: {
      maxSamples: MAX_REQUEST_SAMPLES,
      maxAgeHours: 24,
      scope: 'This backend process only. Samples reset when the process restarts.',
    },
  };
}

async function getProductMetrics() {
  const [accounts, payments, daily, resources] = await Promise.all([
    sequelize.query(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (
                WHERE "createdAt" >=
                  (((CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Kampala')::date - INTERVAL '13 days') AT TIME ZONE 'Africa/Kampala')
              )::int AS new_14_days
       FROM public.users`,
      { type: QueryTypes.SELECT },
    ),
    sequelize.query(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
              COUNT(*) FILTER (WHERE status = 'approved')::int AS approved,
              COUNT(*) FILTER (WHERE status = 'downloaded')::int AS downloads_completed,
              COUNT(*) FILTER (WHERE status = 'rejected')::int AS rejected
       FROM public.study_hub_document_payments`,
      { type: QueryTypes.SELECT },
    ),
    sequelize.query(
      `WITH days AS (
         SELECT generate_series(
           ((CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Kampala')::date - INTERVAL '13 days')::timestamp,
           (CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Kampala')::date::timestamp,
           INTERVAL '1 day'
         )::date AS day
       ),
       account_activity AS (
         SELECT ("createdAt" AT TIME ZONE 'Africa/Kampala')::date AS day, COUNT(*)::int AS signups
         FROM public.users
         WHERE "createdAt" >=
           (((CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Kampala')::date - INTERVAL '13 days') AT TIME ZONE 'Africa/Kampala')
         GROUP BY ("createdAt" AT TIME ZONE 'Africa/Kampala')::date
       ),
       payment_activity AS (
         SELECT (created_at AT TIME ZONE 'Africa/Kampala')::date AS day,
                COUNT(*)::int AS requests,
                COUNT(*) FILTER (WHERE status = 'downloaded')::int AS downloads
         FROM public.study_hub_document_payments
         WHERE created_at >=
           (((CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Kampala')::date - INTERVAL '13 days') AT TIME ZONE 'Africa/Kampala')
         GROUP BY (created_at AT TIME ZONE 'Africa/Kampala')::date
       )
       SELECT to_char(days.day, 'YYYY-MM-DD') AS day,
              COALESCE(account_activity.signups, 0)::int AS signups,
              COALESCE(payment_activity.requests, 0)::int AS payment_requests,
              COALESCE(payment_activity.downloads, 0)::int AS downloads
       FROM days
       LEFT JOIN account_activity USING (day)
       LEFT JOIN payment_activity USING (day)
       ORDER BY days.day`,
      { type: QueryTypes.SELECT },
    ),
    resourceService.list({ limit: 1 }),
  ]);

  const accountTotals = accounts[0] || {};
  const paymentTotals = payments[0] || {};
  return {
    accounts: {
      total: Number(accountTotals.total) || 0,
      new14Days: Number(accountTotals.new_14_days) || 0,
    },
    payments: {
      total: Number(paymentTotals.total) || 0,
      pending: Number(paymentTotals.pending) || 0,
      approved: Number(paymentTotals.approved) || 0,
      downloadsCompleted: Number(paymentTotals.downloads_completed) || 0,
      rejected: Number(paymentTotals.rejected) || 0,
    },
    resources: {
      total: Number(resources.total) || 0,
      source: resources.source,
      warning: resources.warning || null,
    },
    daily: daily.map((row) => ({
      day: row.day,
      signups: Number(row.signups) || 0,
      paymentRequests: Number(row.payment_requests) || 0,
      downloads: Number(row.downloads) || 0,
    })),
  };
}

async function getDashboardMetrics() {
  const product = await getProductMetrics();
  return {
    observedAt: new Date().toISOString(),
    runtime: getRuntimeMetrics(),
    services: {
      api: 'operational',
      postgres: 'operational',
      resourceCatalog: product.resources.source === 'supabase' ? 'operational'
        : product.resources.source === 'manifest' ? 'fallback'
          : 'unavailable',
    },
    product,
  };
}

module.exports = {
  getDashboardMetrics,
  getRuntimeMetrics,
  recordApiRequest,
  recordApiSample,
};
