import { useEffect, useMemo, useState, type SubmitEvent } from 'react';
import { readAuthSession } from '../utils/authSession';

interface PlanTopic {
  id: string;
  title: string;
  subject: string;
  day: number;
  objective: string;
  practice: string;
  status: 'upcoming' | 'completed';
}

interface StudyPlan {
  title: string;
  summary: string;
  topics: PlanTopic[];
}

interface ActivityDay {
  activity_date: string;
  completed_topics: number;
  reading_minutes: number;
}

interface PlanResponse {
  plan: StudyPlan | null;
  streakCount: number;
  activity: ActivityDay[];
  message?: string;
  error?: string;
}

interface LibraryResource {
  id: string;
  title: string;
  subject: string;
  type: string;
  url: string;
  classKeys: string[];
  source: 'fresh-teacher' | 'study-hub';
}

interface Recommendation {
  id: string;
  reason: string;
}

interface Props {
  apiBase: string;
  catalogUrl: string;
  readerBase: string;
  classLevel: string;
  subjects: string[];
  supabaseUrl: string;
  anonKey: string;
  compact?: boolean;
}

function studyKey() {
  return readAuthSession<{ id?: number }>()?.token || '';
}

function classKeyForLevel(classLevel: string): string {
  const nurseryKeys: Record<string, string> = { 'Baby Class': 'baby', 'Top Class': 'top', 'Middle Class': 'middle' };
  if (nurseryKeys[classLevel]) return nurseryKeys[classLevel];
  const match = /^(?:P|S)\.(\d+)$/.exec(classLevel);
  return match ? `${classLevel.startsWith('P.') ? 'p' : 's'}${match[1]}` : '';
}

function readerHref(readerBase: string, baseHref: string, resource: LibraryResource, classKey: string): string {
  const url = new URL(readerBase, window.location.origin);
  url.searchParams.set('file', resource.url);
  url.searchParams.set('title', resource.title);
  url.searchParams.set('subject', resource.subject.toLowerCase());
  url.searchParams.set('resource_id', resource.id);
  if (resource.source === 'fresh-teacher') {
    url.searchParams.set('source', 'fresh-teacher');
    if (resource.classKeys[0]) url.searchParams.set('class_key', resource.classKeys[0]);
  }
  url.searchParams.set('return', `${baseHref}library.html?class=${encodeURIComponent(classLevelFromKey(classKey))}`);
  return url.href;
}

function classLevelFromKey(key: string): string {
  if (/^p\d$/.test(key)) return `${key[0].toUpperCase()}.${key[1]}`;
  if (/^s\d$/.test(key)) return `${key[0].toUpperCase()}.${key[1]}`;
  return ({ baby: 'Baby Class', top: 'Top Class', middle: 'Middle Class' } as Record<string, string>)[key] || '';
}

const SUPABASE_CLASS_KEYS: Record<string, string[]> = {
  'S.3': ['s3'],
  'S.4': ['s4'],
  'S.5': ['s5'],
  'S.6': ['s6'],
  'A-Level': ['s5', 's6'],
  'O-Level': ['s1', 's2', 's3', 's4'],
};

export default function StudyPlanWorkspace({
  apiBase,
  catalogUrl,
  readerBase,
  classLevel,
  subjects,
  supabaseUrl,
  anonKey,
  compact = false,
}: Props) {
  const [plan, setPlan] = useState<StudyPlan | null>(null);
  const [streakCount, setStreakCount] = useState(0);
  const [activity, setActivity] = useState<ActivityDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingAction, setSavingAction] = useState<'complete' | 'adjust' | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [adjustment, setAdjustment] = useState('');
  const [resources, setResources] = useState<LibraryResource[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [recommendationsBusy, setRecommendationsBusy] = useState(false);
  const [recommendationsError, setRecommendationsError] = useState('');

  async function requestPlan(path = '', method = 'GET', body?: unknown): Promise<PlanResponse> {
    const token = studyKey();
    if (!token) throw new Error('Sign in again to access your saved study plan.');
    if (!apiBase) throw new Error('Your study plan is unavailable because the account service is not configured.');
    const response = await fetch(`${apiBase}/api/study-plan${path}`, {
      method,
      signal: AbortSignal.timeout(20_000),
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        Authorization: `Bearer ${token}`,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'Your study plan request could not be completed.');
    return result as PlanResponse;
  }

  function applyPlanResponse(result: PlanResponse) {
    setPlan(result.plan);
    setStreakCount(result.streakCount || 0);
    setActivity(Array.isArray(result.activity) ? result.activity : []);
  }

  async function loadPlan(createIfMissing: boolean) {
    setLoading(true);
    setError('');
    try {
      let result = await requestPlan();
      if (!result.plan && createIfMissing) result = await requestPlan('', 'POST', {});
      applyPlanResponse(result);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Your study plan could not be loaded.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPlan(true);
    // A new signed-in account gets its own server-stored plan.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBase]);

  const completedCount = plan?.topics.filter((topic) => topic.status === 'completed').length || 0;
  const completionPercent = plan?.topics.length ? Math.round((completedCount / plan.topics.length) * 100) : 0;
  const chartPoints = useMemo(() => {
    const byDate = new Map(activity.map((day) => [String(day.activity_date).slice(0, 10), Number(day.completed_topics)]));
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - index));
      const key = date.toISOString().slice(0, 10);
      return { key, label: date.toLocaleDateString(undefined, { weekday: 'short' }), count: byDate.get(key) || 0 };
    });
  }, [activity]);

  useEffect(() => {
    let active = true;
    async function loadRecommendations() {
      if (!plan || (!classLevel && !subjects.length) || !catalogUrl || !apiBase || !studyKey()) {
        if (plan) setRecommendationsError('Add your class and subjects in profile settings to get matching Library recommendations.');
        return;
      }
      setRecommendationsBusy(true);
      setRecommendationsError('');
      try {
        const response = await fetch(catalogUrl, { signal: AbortSignal.timeout(15_000) });
        if (!response.ok) throw new Error(`The Study Library catalog is unavailable (HTTP ${response.status}).`);
        const catalog: unknown = await response.json();
        const catalogItems: unknown = catalog && typeof catalog === 'object' && 'items' in catalog
          ? (catalog as { items: unknown }).items
          : [];
        const freshItems: LibraryResource[] = Array.isArray(catalogItems)
          ? (catalogItems as Array<{ title?: string; subject?: string; type?: string; url?: string; classKey?: string }>)
            .filter((item) => typeof item.url === 'string' && item.url)
            .map((item) => ({
              id: `ft:${item.url}`,
              title: item.title || item.url || 'Untitled resource',
              subject: item.subject?.toLowerCase() === 'all subjects' ? 'General' : item.subject || 'General',
              type: item.type || 'Resources',
              url: item.url as string,
              classKeys: item.classKey ? [item.classKey] : [],
              source: 'fresh-teacher',
            }))
          : [];
        let studyHubItems: LibraryResource[] = [];
        if (supabaseUrl && anonKey) {
          const endpoint = new URL('/rest/v1/study_hub_resources', supabaseUrl);
          endpoint.searchParams.set('select', 'subject,category,storage_bucket,storage_path,original_filename,title,level,resource_type');
          endpoint.searchParams.set('limit', '1000');
          const headers: Record<string, string> = { apikey: anonKey };
          if (anonKey.startsWith('eyJ')) headers.Authorization = `Bearer ${anonKey}`;
          const supabaseResponse = await fetch(endpoint, { headers, signal: AbortSignal.timeout(15_000) });
          if (!supabaseResponse.ok) throw new Error(`Study Hub Library resource lookup failed (HTTP ${supabaseResponse.status}).`);
          const rows: unknown = await supabaseResponse.json();
          if (!Array.isArray(rows)) throw new Error('Study Hub Library returned an invalid resource list.');
          studyHubItems = (rows as Array<Record<string, unknown>>).map((row) => {
            const bucket = typeof row.storage_bucket === 'string' ? row.storage_bucket : 'study-hub-resources';
            const path = typeof row.storage_path === 'string' ? row.storage_path : '';
            const level = typeof row.level === 'string' ? row.level : '';
            return {
              id: `sh:${path}`,
              title: String(row.title || row.original_filename || 'Untitled resource'),
              subject: String(row.subject || '').toLowerCase() === 'all subjects' ? 'General' : String(row.subject || 'General'),
              type: row.category === 'papers' ? 'Past Papers' : row.resource_type === 'guide' ? 'Guides' : 'Lesson Notes',
              url: path ? `${supabaseUrl.replace(/\/+$/, '')}/storage/v1/object/public/${bucket}/${path}` : '',
              classKeys: SUPABASE_CLASS_KEYS[level] || [],
              source: 'study-hub' as const,
            };
          }).filter((item) => item.url);
        }
        if (!active) return;
        const items = [...freshItems, ...studyHubItems];
        const key = classKeyForLevel(classLevel);
        const preferred = new Set(subjects.map((subject) => subject.toLowerCase()));
        const subjectTopics = new Set(plan.topics
          .filter((topic) => topic.status !== 'completed')
          .map((topic) => topic.subject.toLowerCase()));
        const candidates = items
          .filter((item) => item.url && item.title && (key ? item.classKeys.includes(key) : preferred.has(item.subject.toLowerCase())))
          .filter((item) => preferred.size === 0 || preferred.has(item.subject.toLowerCase()) || item.subject.toLowerCase() === 'general')
          .sort((left, right) => {
            const leftScore = Number(subjectTopics.has(left.subject.toLowerCase())) + Number(preferred.has(left.subject.toLowerCase()));
            const rightScore = Number(subjectTopics.has(right.subject.toLowerCase())) + Number(preferred.has(right.subject.toLowerCase()));
            return rightScore - leftScore;
          })
          .slice(0, 30);
        setResources(candidates);
        if (!candidates.length) {
          setRecommendations([]);
          setRecommendationsError('No class-and-subject-matched Library resources were found yet.');
          return;
        }
        const ranked = await requestPlan('/recommend-resources', 'POST', {
          candidates: candidates.map(({ id, title, subject, type }) => ({ id, title, subject, type })),
        });
        if (!active) return;
        const result = ranked as unknown as { recommendations?: Recommendation[] };
        setRecommendations(Array.isArray(result.recommendations) ? result.recommendations : []);
        if (!result.recommendations?.length) setRecommendationsError('No close Library matches were found for your current plan topics.');
      } catch (recommendationError) {
        if (active) setRecommendationsError(recommendationError instanceof Error ? recommendationError.message : 'Your Library recommendations could not be loaded.');
      } finally {
        if (active) setRecommendationsBusy(false);
      }
    }
    void loadRecommendations();
    return () => { active = false; };
  }, [plan, classLevel, subjects, catalogUrl, apiBase, supabaseUrl, anonKey]);

  async function markComplete(topicId: string) {
    setSaving(true);
    setSavingAction('complete');
    setError('');
    setNotice('');
    try {
      const result = await requestPlan('/complete', 'POST', { topicId });
      applyPlanResponse(result);
      setNotice('Study session saved. Keep coming back daily to build your streak.');
    } catch (completeError) {
      setError(completeError instanceof Error ? completeError.message : 'Progress could not be saved.');
    } finally {
      setSaving(false);
      setSavingAction(null);
    }
  }

  async function adjustPlan(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!adjustment.trim() || saving) return;
    setSaving(true);
    setSavingAction('adjust');
    setError('');
    setNotice('');
    try {
      const result = await requestPlan('/chat', 'PUT', { message: adjustment.trim() });
      setPlan(result.plan);
      setAdjustment('');
      setNotice(result.message || 'Your plan has been updated.');
    } catch (adjustError) {
      setError(adjustError instanceof Error ? adjustError.message : 'Your plan could not be adjusted.');
    } finally {
      setSaving(false);
      setSavingAction(null);
    }
  }

  return (
    <section className={`study-plan${compact ? ' study-plan-compact' : ''}`} aria-label="Personal study plan" aria-busy={loading || saving}>
      <header className="study-plan-header">
        <div>
          <p className="study-section-kicker">YOUR AI STUDY PLAN</p>
          <h2>{plan?.title || 'Your next steps, made personal'}</h2>
          <p>{plan?.summary || 'Your class and subjects are being used to prepare a practical plan you can adjust with your tutor.'}</p>
        </div>
        {plan && <div className="study-plan-completion"><strong>{completionPercent}%</strong><span>complete</span></div>}
      </header>

      {error && <p className="study-plan-message is-error" role="alert">{error}</p>}
      {notice && <p className="study-plan-message" role="status">{notice}</p>}

      {loading ? (
        <p className="study-plan-loading" role="status"><span className="study-progress-spinner" aria-hidden="true" />Building your personalized study plan…</p>
      ) : !plan ? (
        <button type="button" className="study-plan-retry" onClick={() => void loadPlan(true)}>Create my study plan</button>
      ) : (
        <>
          <div className="study-plan-stats">
            <div><strong>🔥 {streakCount}</strong><span>day study streak</span></div>
            <div><strong>{completedCount}/{plan.topics.length}</strong><span>topics completed</span></div>
          </div>
          <p className="study-plan-start-note">Your plan starts with a 5-day streak. Complete a topic daily to keep it growing.</p>
          {saving && <p className="study-plan-loading" role="status"><span className="study-progress-spinner" aria-hidden="true" />{savingAction === 'adjust' ? 'Updating your study plan…' : 'Saving your study progress…'}</p>}

          <div className="study-plan-chart" aria-label="Study activity over the last seven days">
            <div className="study-plan-chart-bars">
              {chartPoints.map((day) => (
                <div className="study-plan-chart-day" key={day.key} aria-label={`${day.label}: ${day.count} completed topics`}>
                  <span style={{ height: `${Math.max(7, Math.min(100, day.count * 24))}%` }} />
                  <small>{day.label}</small>
                </div>
              ))}
            </div>
            <span className="study-plan-chart-caption">Your completed study sessions · last 7 days</span>
          </div>

          <div className="study-plan-topics">
            {plan.topics.map((topic) => (
              <article className={`study-plan-topic${topic.status === 'completed' ? ' is-complete' : ''}`} key={topic.id}>
                <div>
                  <span className="study-plan-topic-meta">DAY {topic.day} · {topic.subject}</span>
                  <h3>{topic.title}</h3>
                  <p>{topic.objective}</p>
                  <small>Try: {topic.practice}</small>
                </div>
                <button type="button" onClick={() => void markComplete(topic.id)} disabled={saving || topic.status === 'completed'}>
                  {topic.status === 'completed' ? 'Mastered' : saving ? 'Saving…' : 'Mark studied'}
                </button>
              </article>
            ))}
          </div>

          <form className="study-plan-chat" onSubmit={(event) => void adjustPlan(event)}>
            <label htmlFor="study-plan-adjustment">Chat with your planner to adjust this plan</label>
            <div>
              <input
                id="study-plan-adjustment"
                value={adjustment}
                onChange={(event) => setAdjustment(event.target.value)}
                maxLength={500}
                placeholder="e.g. Give me more Biology revision this week"
                disabled={saving}
              />
              <button type="submit" disabled={saving || !adjustment.trim()}>{saving ? 'Updating…' : 'Adjust plan'}</button>
            </div>
          </form>

          <section className="study-plan-recommendations" aria-labelledby="study-plan-resources-heading">
            <div className="study-plan-subheading">
              <div><p className="study-section-kicker">PICKED FOR YOUR CLASS</p><h3 id="study-plan-resources-heading">Recommended Library resources</h3></div>
            </div>
            {recommendationsBusy ? <p className="study-plan-loading" role="status"><span className="study-progress-spinner" aria-hidden="true" />Matching Library resources to your plan and recent study activity…</p>
              : recommendationsError ? <p className="study-plan-resource-note" role="status">{recommendationsError}</p>
                : (
                  <ul>
                    {recommendations.map((recommendation) => {
                      const resource = resources.find((item) => item.id === recommendation.id);
                      if (!resource) return null;
                      const key = classKeyForLevel(classLevel);
                      return <li key={recommendation.id}>
                        <a href={readerHref(readerBase, catalogUrl.replace(/fresh-teacher-catalog\.json(?:\?.*)?$/, ''), resource, key)} target="_blank" rel="noreferrer">{resource.title} <span aria-hidden="true">↗</span></a>
                        <small>{resource.subject} · {resource.type}</small>
                        <p>{recommendation.reason}</p>
                      </li>;
                    })}
                  </ul>
                )}
          </section>
        </>
      )}
    </section>
  );
}
