import { useCallback, useEffect, useState } from 'react';
import { readAuthSession, type AuthSession } from '../utils/authSession';

type ServiceState = 'operational' | 'fallback' | 'unavailable';

interface HourlyTraffic {
  label: string;
  requests: number;
}

interface EndpointMetric {
  route: string;
  requests: number;
  errors: number;
  averageLatencyMs: number;
  p95LatencyMs: number;
}

interface DailyMetric {
  day: string;
  signups: number;
  paymentRequests: number;
  downloads: number;
}

interface PerformanceMetrics {
  observedAt: string;
  runtime: {
    process: {
      startedAt: string;
      uptimeSeconds: number;
      memoryBytes: number;
      nodeVersion: string;
    };
    api: {
      windowMinutes: number;
      requests: number;
      errors: number;
      errorRate: number;
      averageLatencyMs: number;
      p95LatencyMs: number;
      hourlyTraffic: HourlyTraffic[];
      endpoints: EndpointMetric[];
    };
    retention: {
      maxSamples: number;
      maxAgeHours: number;
      scope: string;
    };
  };
  services: {
    api: ServiceState;
    postgres: ServiceState;
    resourceCatalog: ServiceState;
  };
  product: {
    accounts: { total: number; new14Days: number };
    payments: {
      total: number;
      pending: number;
      approved: number;
      downloadsCompleted: number;
      rejected: number;
    };
    resources: { total: number; source: string; warning: string | null };
    daily: DailyMetric[];
  };
}

interface AdminUser {
  role?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readNumber(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`Metrics response is missing ${name}.`);
  return value;
}

function readString(value: unknown, name: string): string {
  if (typeof value !== 'string') throw new Error(`Metrics response is missing ${name}.`);
  return value;
}

function readServiceState(value: unknown): ServiceState {
  if (value === 'operational' || value === 'fallback' || value === 'unavailable') return value;
  throw new Error('Metrics response contains an invalid service status.');
}

function parseMetrics(payload: unknown): PerformanceMetrics {
  if (!isRecord(payload) || !isRecord(payload.metrics)) throw new Error('The metrics response is invalid.');
  const metrics = payload.metrics;
  const runtime = metrics.runtime;
  const product = metrics.product;
  const services = metrics.services;
  if (!isRecord(runtime) || !isRecord(runtime.process) || !isRecord(runtime.api) || !isRecord(runtime.retention)
    || !isRecord(product) || !isRecord(product.accounts) || !isRecord(product.payments)
    || !isRecord(product.resources) || !isRecord(services)
    || !Array.isArray(runtime.api.hourlyTraffic) || !Array.isArray(runtime.api.endpoints) || !Array.isArray(product.daily)) {
    throw new Error('The metrics response is incomplete.');
  }

  const hourlyTraffic = runtime.api.hourlyTraffic.map((item) => {
    if (!isRecord(item)) throw new Error('The traffic chart data is invalid.');
    return { label: readString(item.label, 'traffic timestamp'), requests: readNumber(item.requests, 'traffic count') };
  });
  const endpoints = runtime.api.endpoints.map((item) => {
    if (!isRecord(item)) throw new Error('The endpoint metrics are invalid.');
    return {
      route: readString(item.route, 'route'),
      requests: readNumber(item.requests, 'route request count'),
      errors: readNumber(item.errors, 'route error count'),
      averageLatencyMs: readNumber(item.averageLatencyMs, 'route average latency'),
      p95LatencyMs: readNumber(item.p95LatencyMs, 'route p95 latency'),
    };
  });
  const daily = product.daily.map((item) => {
    if (!isRecord(item)) throw new Error('The analytics chart data is invalid.');
    return {
      day: readString(item.day, 'analytics date'),
      signups: readNumber(item.signups, 'signup count'),
      paymentRequests: readNumber(item.paymentRequests, 'payment request count'),
      downloads: readNumber(item.downloads, 'download count'),
    };
  });

  return {
    observedAt: readString(metrics.observedAt, 'observation time'),
    runtime: {
      process: {
        startedAt: readString(runtime.process.startedAt, 'process start time'),
        uptimeSeconds: readNumber(runtime.process.uptimeSeconds, 'process uptime'),
        memoryBytes: readNumber(runtime.process.memoryBytes, 'memory usage'),
        nodeVersion: readString(runtime.process.nodeVersion, 'Node.js version'),
      },
      api: {
        windowMinutes: readNumber(runtime.api.windowMinutes, 'API window'),
        requests: readNumber(runtime.api.requests, 'API request count'),
        errors: readNumber(runtime.api.errors, 'API error count'),
        errorRate: readNumber(runtime.api.errorRate, 'API error rate'),
        averageLatencyMs: readNumber(runtime.api.averageLatencyMs, 'API average latency'),
        p95LatencyMs: readNumber(runtime.api.p95LatencyMs, 'API p95 latency'),
        hourlyTraffic,
        endpoints,
      },
      retention: {
        maxSamples: readNumber(runtime.retention.maxSamples, 'sample limit'),
        maxAgeHours: readNumber(runtime.retention.maxAgeHours, 'sample retention'),
        scope: readString(runtime.retention.scope, 'sample scope'),
      },
    },
    services: {
      api: readServiceState(services.api),
      postgres: readServiceState(services.postgres),
      resourceCatalog: readServiceState(services.resourceCatalog),
    },
    product: {
      accounts: {
        total: readNumber(product.accounts.total, 'account count'),
        new14Days: readNumber(product.accounts.new14Days, 'new account count'),
      },
      payments: {
        total: readNumber(product.payments.total, 'payment count'),
        pending: readNumber(product.payments.pending, 'pending payment count'),
        approved: readNumber(product.payments.approved, 'approved payment count'),
        downloadsCompleted: readNumber(product.payments.downloadsCompleted, 'completed download count'),
        rejected: readNumber(product.payments.rejected, 'rejected payment count'),
      },
      resources: {
        total: readNumber(product.resources.total, 'resource count'),
        source: readString(product.resources.source, 'resource source'),
        warning: typeof product.resources.warning === 'string' ? product.resources.warning : null,
      },
      daily,
    },
  };
}

function errorFromPayload(payload: unknown, fallback: string): string {
  if (isRecord(payload) && typeof payload.error === 'string') return payload.error;
  return fallback;
}

function formatDuration(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return days ? `${days}d ${hours}h` : hours ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function formatBytes(bytes: number): string {
  const megabytes = bytes / (1024 * 1024);
  return `${megabytes.toFixed(0)} MB`;
}

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat('en-UG', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Africa/Kampala',
  }).format(new Date(value));
}

function formatDay(value: string): string {
  return new Intl.DateTimeFormat('en-UG', {
    day: 'numeric',
    month: 'short',
    timeZone: 'Africa/Kampala',
  }).format(new Date(`${value}T12:00:00Z`));
}

function formatLatency(value: number): string {
  return `${Math.round(value).toLocaleString()} ms`;
}

async function readResponse(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new Error('The Study Hub API returned an invalid response.');
  }
}

export default function AdminPerformanceDashboard({ apiUrl }: { apiUrl: string }) {
  const [session, setSession] = useState<AuthSession<AdminUser> | null>(null);
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [insights, setInsights] = useState('');
  const [insightError, setInsightError] = useState('');
  const [generatingInsights, setGeneratingInsights] = useState(false);
  const apiBase = apiUrl.replace(/\/+$/, '');

  useEffect(() => {
    const syncSession = () => setSession(readAuthSession<AdminUser>());
    syncSession();
    window.addEventListener('study-hub-auth-change', syncSession);
    return () => window.removeEventListener('study-hub-auth-change', syncSession);
  }, []);

  const loadMetrics = useCallback(async (showLoading: boolean) => {
    if (!session?.token || !apiBase) {
      setLoading(false);
      if (!apiBase) setError('The Study Hub API is not configured.');
      return;
    }
    if (showLoading) setLoading(true);
    else setRefreshing(true);
    setError('');
    try {
      const response = await fetch(`${apiBase}/api/admin/performance/metrics`, {
        headers: { Authorization: `Bearer ${session.token}` },
        signal: AbortSignal.timeout(30_000),
      });
      const payload = await readResponse(response);
      if (!response.ok) throw new Error(errorFromPayload(payload, 'Performance data could not be loaded.'));
      setMetrics(parseMetrics(payload));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Performance data could not be loaded.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [apiBase, session?.token]);

  useEffect(() => {
    void loadMetrics(true);
    const interval = window.setInterval(() => void loadMetrics(false), 60_000);
    return () => window.clearInterval(interval);
  }, [loadMetrics]);

  async function generateInsights() {
    if (!session?.token || !apiBase) {
      setInsightError('Sign in with an administrator account and confirm the API is configured.');
      return;
    }
    setGeneratingInsights(true);
    setInsightError('');
    setInsights('');
    try {
      const response = await fetch(`${apiBase}/api/admin/performance/insights`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.token}` },
        signal: AbortSignal.timeout(35_000),
      });
      const payload = await readResponse(response);
      if (!response.ok) throw new Error(errorFromPayload(payload, 'AI analysis could not be completed.'));
      if (!isRecord(payload) || typeof payload.insights !== 'string' || typeof payload.model !== 'string') {
        throw new Error('The AI insights response is invalid.');
      }
      setInsights(payload.insights);
    } catch (analysisError) {
      setInsightError(analysisError instanceof Error ? analysisError.message : 'AI analysis could not be completed.');
    } finally {
      setGeneratingInsights(false);
    }
  }

  if (!session) return <p className="admin-performance-notice">Sign in with an administrator account to view application performance.</p>;
  if (session.user.role !== 'admin') return <p className="admin-performance-notice">Administrator access is required.</p>;

  const runtime = metrics?.runtime;
  const product = metrics?.product;
  const maxRequests = Math.max(1, ...(runtime?.api.hourlyTraffic.map((point) => point.requests) ?? []));
  const maxDaily = Math.max(1, ...(product?.daily.map((point) => Math.max(point.signups, point.paymentRequests, point.downloads)) ?? []));
  const resourceState = metrics?.services.resourceCatalog;

  return (
    <main className="admin-performance">
      <header className="admin-performance-header">
        <div>
          <p className="admin-performance-kicker">Operations overview · Africa/Kampala</p>
          <h1>Application performance</h1>
          <p>Live backend health and product activity from Study Hub’s existing database and resource catalog.</p>
        </div>
        <button type="button" onClick={() => void loadMetrics(false)} disabled={refreshing}>
          {refreshing ? 'Refreshing…' : 'Refresh metrics'}
        </button>
      </header>

      {error && <p className="admin-performance-error" role="alert">{error}<button type="button" onClick={() => void loadMetrics(true)}>Retry</button></p>}
      {!apiBase && <p className="admin-performance-error" role="alert">Performance monitoring needs the Study Hub API URL to be configured.</p>}
      {loading && !metrics && <p className="admin-performance-loading" role="status"><span className="admin-performance-spinner" />Loading live performance metrics…</p>}

      {metrics && runtime && product && (
        <>
          <div className="admin-performance-status-row" aria-label="Service status">
            <span><i className={`is-${metrics.services.api}`} />Study Hub API <strong>{metrics.services.api}</strong></span>
            <span><i className={`is-${metrics.services.postgres}`} />PostgreSQL <strong>{metrics.services.postgres}</strong></span>
            <span><i className={`is-${resourceState}`} />Resource catalog <strong>{resourceState === 'fallback' ? 'manifest fallback' : resourceState}</strong></span>
            <span className="admin-performance-updated">Updated {formatTimestamp(metrics.observedAt)}</span>
          </div>

          {product.resources.warning && <p className="admin-performance-warning" role="status">{product.resources.warning}</p>}

          <section className="admin-performance-kpis" aria-label="Performance metrics">
            <article><span>API requests · last hour</span><strong>{runtime.api.requests.toLocaleString()}</strong><small>{runtime.api.errors.toLocaleString()} server errors (5xx)</small></article>
            <article><span>Average API latency</span><strong>{runtime.api.requests ? formatLatency(runtime.api.averageLatencyMs) : '—'}</strong><small>{runtime.api.requests ? `p95 ${formatLatency(runtime.api.p95LatencyMs)}` : 'No recent API samples'}</small></article>
            <article><span>Server error rate</span><strong>{runtime.api.requests ? `${(runtime.api.errorRate * 100).toFixed(1)}%` : '—'}</strong><small>5xx errors across observed API requests</small></article>
            <article><span>Process uptime</span><strong>{formatDuration(runtime.process.uptimeSeconds)}</strong><small>{formatBytes(runtime.process.memoryBytes)} resident memory · {runtime.process.nodeVersion}</small></article>
            <article><span>Registered accounts</span><strong>{product.accounts.total.toLocaleString()}</strong><small>{product.accounts.new14Days.toLocaleString()} created in the last 14 days</small></article>
            <article><span>Supabase resources</span><strong>{product.resources.total.toLocaleString()}</strong><small>Catalog source: {product.resources.source}</small></article>
            <article><span>Pending payments</span><strong>{product.payments.pending.toLocaleString()}</strong><small>Requested amount is not reported as revenue</small></article>
            <article><span>Completed downloads</span><strong>{product.payments.downloadsCompleted.toLocaleString()}</strong><small>{product.payments.total.toLocaleString()} payment requests total</small></article>
          </section>

          <section className="admin-performance-charts" aria-label="Usage trends">
            <article className="admin-performance-card">
              <div className="admin-performance-card-heading"><div><h2>API traffic</h2><p>Requests per hour, process-local sample window</p></div><span>Last 12 hours</span></div>
              <div className="admin-performance-bars" role="img" aria-label="API requests received in each of the last 12 hours">
                {runtime.api.hourlyTraffic.map((point) => (
                  <div className="admin-performance-bar-column" key={point.label} title={`${formatTimestamp(point.label)}: ${point.requests} requests`}>
                    <span>{point.requests || ''}</span>
                    <i style={{ height: `${Math.max(point.requests ? 8 : 2, (point.requests / maxRequests) * 100)}%` }} />
                    <small>{new Intl.DateTimeFormat('en-UG', { hour: 'numeric', timeZone: 'Africa/Kampala' }).format(new Date(point.label))}</small>
                  </div>
                ))}
              </div>
            </article>
            <article className="admin-performance-card">
              <div className="admin-performance-card-heading"><div><h2>Product activity</h2><p>Registrations, payment requests and completed downloads</p></div><span>Last 14 days</span></div>
              <div className="admin-performance-legend"><span><i />Sign-ups</span><span><i />Payment requests</span><span><i />Downloads</span></div>
              <div className="admin-performance-daily" role="img" aria-label="Daily sign-ups, payment requests, and downloads for the last 14 days">
                {product.daily.map((point) => (
                  <div className="admin-performance-daily-column" key={point.day} title={`${formatDay(point.day)}: ${point.signups} sign-ups, ${point.paymentRequests} payment requests, ${point.downloads} downloads`}>
                    <div className="admin-performance-bar-set">
                      <i className="is-signups" style={{ height: `${Math.max(point.signups ? 6 : 2, (point.signups / maxDaily) * 100)}%` }} />
                      <i className="is-payments" style={{ height: `${Math.max(point.paymentRequests ? 6 : 2, (point.paymentRequests / maxDaily) * 100)}%` }} />
                      <i className="is-downloads" style={{ height: `${Math.max(point.downloads ? 6 : 2, (point.downloads / maxDaily) * 100)}%` }} />
                    </div>
                    <small>{formatDay(point.day)}</small>
                  </div>
                ))}
              </div>
            </article>
          </section>

          <section className="admin-performance-card admin-performance-endpoints">
            <div className="admin-performance-card-heading"><div><h2>API endpoints</h2><p>Most-requested routes during the last hour</p></div><span>{runtime.api.windowMinutes} minute window</span></div>
            {runtime.api.endpoints.length ? (
              <div className="admin-performance-table-wrap">
                <table>
                  <thead><tr><th scope="col">Route</th><th scope="col">Requests</th><th scope="col">5xx errors</th><th scope="col">Average</th><th scope="col">p95</th></tr></thead>
                  <tbody>{runtime.api.endpoints.map((endpoint) => (
                    <tr key={endpoint.route}><td><code>{endpoint.route}</code></td><td>{endpoint.requests.toLocaleString()}</td><td>{endpoint.errors.toLocaleString()}</td><td>{formatLatency(endpoint.averageLatencyMs)}</td><td>{formatLatency(endpoint.p95LatencyMs)}</td></tr>
                  ))}</tbody>
                </table>
              </div>
            ) : <p className="admin-performance-empty">No API traffic has been recorded in the current process yet.</p>}
          </section>

          <section className="admin-performance-ai">
            <div className="admin-performance-ai-heading">
              <div><p className="admin-performance-kicker">AI operations analyst</p><h2>Get an evidence-based health summary</h2><p>GPT-4.1-mini reviews aggregate metrics only. No learner names, emails, or payment details are sent.</p></div>
              <button type="button" onClick={() => void generateInsights()} disabled={generatingInsights}>
                {generatingInsights ? 'Analyzing metrics…' : 'Analyze current metrics'}
              </button>
            </div>
            {insightError && <p className="admin-performance-error" role="alert">{insightError}</p>}
            {generatingInsights && <p className="admin-performance-loading" role="status"><span className="admin-performance-spinner" />Asking GPT-4.1-mini to review the current aggregate metrics…</p>}
            {insights && <div className="admin-performance-insight" aria-live="polite">{insights}</div>}
          </section>

          <p className="admin-performance-footnote">
            API request samples are held in this backend process only (up to {runtime.retention.maxSamples.toLocaleString()} requests or {runtime.retention.maxAgeHours} hours) and reset on restart. Account, payment, and catalog totals come from current Study Hub data; charts use database records in Africa/Kampala time.
          </p>
        </>
      )}
    </main>
  );
}
