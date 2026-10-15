import { type SyntheticEvent, useEffect, useRef, useState } from 'react';
import { renderMarkdown } from './markdown';
import { readAuthSession } from '../utils/authSession';

interface Props {
  homeHref: string;
  libraryHref: string;
  documentationHref: string;
  legalHref: string;
}

interface Note {
  slug: string;
  title: string;
  markdown?: string;
  source?: string;
}
interface StudyProfile {
  username: string;
  classLevel: string;
  subjects: string[];
  onboardingComplete: boolean;
}
type WorkspaceIconName = 'home' | 'library' | 'plus' | 'document' | 'shield' | 'account';

function WorkspaceIcon({ name }: { name: WorkspaceIconName }) {
  const paths: Record<WorkspaceIconName, string> = {
    home: 'M3 10.5 12 3l9 7.5M5.5 9v12h13V9M9 21v-7h6v7',
    library: 'M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5zM4 5.5v16M8 7h8M8 11h8',
    plus: 'M12 5v14M5 12h14',
    document: 'M7 3h7l5 5v13H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM14 3v5h5M9 13h6M9 17h6',
    shield: 'M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11zM9 12l2 2 4-4',
    account: 'M15 21h4a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-4M10 17l5-5-5-5m5 5H3',
  };

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d={paths[name]} />
    </svg>
  );
}

const suggestedQuestions = [
  'Explain photosynthesis step by step',
  'How do quadratic equations work?',
  'Compare mitosis and meiosis'
];
const RECENTS_STORAGE_KEY = 'study-hub-ai-study-recents';
const MAX_RECENT_GUIDES = 20;

function isNote(value: unknown): value is Note {
  if (typeof value !== 'object' || value === null) return false;
  const note = value as Partial<Note>;
  return typeof note.slug === 'string'
    && typeof note.title === 'string'
    && (note.markdown === undefined || typeof note.markdown === 'string')
    && (note.source === undefined || typeof note.source === 'string');
}

function apiBase(): string {
  const configured = import.meta.env.PUBLIC_STUDY_HUB_API_URL?.trim();
  if (!configured) return '';
  try {
    const url = new URL(configured);
    const localHost = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    if (url.protocol !== 'https:' && !localHost) return '';
    if (url.username || url.password || url.search || url.hash) return '';
    return url.href.replace(/\/+$/, '');
  } catch {
    return '';
  }
}

function titleFromTopic(topic: string): string {
  const clean = topic.trim();
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

function slugifyTopic(topic: string): string {
  return topic.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export default function StudyWorkspace({
  homeHref,
  libraryHref,
  documentationHref,
  legalHref,
}: Props) {
  const base = apiBase();
  const [recents, setRecents] = useState<Note[]>([]);
  const [recentSearch, setRecentSearch] = useState('');
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [activeTitle, setActiveTitle] = useState('');
  const [markdown, setMarkdown] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [draft, setDraft] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [source, setSource] = useState('');
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState('');
  const [profile, setProfile] = useState<StudyProfile | null>(null);
  const [tourOpen, setTourOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const session = readAuthSession<{
        username?: unknown;
        classLevel?: unknown;
        subjects?: unknown;
        onboardingComplete?: unknown;
      }>();
      if (!session) return;
      const user = session.user;
      const subjects = Array.isArray(user.subjects)
        ? user.subjects.filter((subject): subject is string => typeof subject === 'string')
        : [];
      const studyProfile = {
        username: typeof user.username === 'string' ? user.username : '',
        classLevel: typeof user.classLevel === 'string' ? user.classLevel : '',
        subjects,
        onboardingComplete: user.onboardingComplete === true,
      };
      setProfile(studyProfile);
      setTourOpen(new URLSearchParams(window.location.search).get('welcome') === '1' && !studyProfile.onboardingComplete);
    } catch {
      setNotice('Your saved learning profile could not be read. AI Study will continue without personal preferences.');
    }
  }, []);

  async function refreshRecents() {
    if (!base) return;
    try {
      const response = await fetch(`${base}/api/lesson-guide`);
      if (!response.ok) return;
      const data = await response.json().catch(() => ({}));
      if (!Array.isArray(data.notes)) return;
      const serverNotes: Note[] = data.notes.filter((note: unknown): note is Note => isNote(note));
      setRecents((current) => {
        const localNotes = current.filter((note) => note.markdown);
        const merged = [...localNotes, ...serverNotes.filter((note) => !localNotes.some((local) => local.slug === note.slug))];
        return merged.slice(0, MAX_RECENT_GUIDES);
      });
    } catch { /* recents are optional */ }
  }

  // Load this browser's saved answers as well as shared backend guides.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(RECENTS_STORAGE_KEY);
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (Array.isArray(parsed)) setRecents(parsed.filter(isNote).slice(0, MAX_RECENT_GUIDES));
        else localStorage.removeItem(RECENTS_STORAGE_KEY);
      }
    } catch {
      setNotice('Saved recent study guides could not be read in this browser.');
    }
    void refreshRecents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base]);

  function saveRecentGuide(note: Note) {
    const next = [note, ...recents.filter((item) => item.slug !== note.slug)].slice(0, MAX_RECENT_GUIDES);
    setRecents(next);
    try {
      localStorage.setItem(RECENTS_STORAGE_KEY, JSON.stringify(next.filter((item) => item.markdown)));
    } catch {
      setNotice('Your answer is ready, but this browser could not save it to Recents.');
    }
  }

  function openRecent(note: Note) {
    if (!note.markdown) {
      void openNote(note.title);
      return;
    }
    setActiveSlug(note.slug);
    setActiveTitle(note.title);
    setMarkdown(note.markdown);
    setSource(note.source || '');
    setError('');
    setNotice('');
    setDraft('');
    setCopied(false);
    setCopyError('');
    setSidebarOpen(false);
  }

  async function openNote(topic: string) {
    const clean = topic.trim();
    if (!clean) return;
    setDraft(clean);
    if (!base) {
      setError('The Study Assistant is not connected yet. Configure the backend API URL to enable it.');
      return;
    }
    setLoading(true);
    setError('');
    setNotice('');
    setSource('');
    setCopied(false);
    setCopyError('');
    setActiveTitle(titleFromTopic(clean));
    setActiveSlug(null);
    setSidebarOpen(false);
    try {
      const response = await fetch(`${base}/api/lesson-guide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: clean,
          ...(profile && (profile.classLevel || profile.subjects.length)
            ? { learningProfile: { classLevel: profile.classLevel, subjects: profile.subjects } }
            : {})
        })
      });
      const result = await response.json().catch(() => ({}));
      if (result.refused) {
        setMarkdown('');
        setNotice(result.message || 'Study Hub can only generate notes for academic and educational subjects.');
        return;
      }
      if (!response.ok || typeof result.markdown !== 'string' || !result.markdown.trim()) {
        throw new Error(result.error || 'This study note could not be generated. Please try again.');
      }
      setMarkdown(result.markdown);
      setSource(typeof result.source === 'string' ? result.source : '');
      setActiveSlug(result.slug ?? null);
      setActiveTitle(result.topic ?? titleFromTopic(clean));
      setDraft('');
      saveRecentGuide({
        slug: typeof result.slug === 'string' ? result.slug : slugifyTopic(clean),
        title: typeof result.topic === 'string' ? result.topic : titleFromTopic(clean),
        markdown: result.markdown,
        source: typeof result.source === 'string' ? result.source : '',
      });
      await refreshRecents();
    } catch (err) {
      setMarkdown('');
      const message = err instanceof Error ? err.message : '';
      setError(message === 'Failed to fetch'
        ? 'Could not reach the Study Hub AI service. Check your connection and try again.'
        : message || 'This study response could not be generated. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const topic = draft.trim();
    if (!topic || loading) return;
    void openNote(topic);
  }

  function startNewQuestion() {
    setActiveSlug(null);
    setActiveTitle('');
    setMarkdown('');
    setSource('');
    setCopyError('');
    setError('');
    setNotice('');
    setDraft('');
    setSidebarOpen(false);
    inputRef.current?.focus();
  }

  async function copyResponse() {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setCopyError('');
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopyError('Copy was unavailable. Select the answer and copy it manually.');
    }
  }

  const hasNote = Boolean(markdown) && !loading;
  const visibleRecents = recents.filter((note) => note.title.toLowerCase().includes(recentSearch.trim().toLowerCase()));

  return (
    <div className={`ws ${sidebarOpen ? 'ws-sidebar-open' : ''}`}>
      <aside className="ws-sidebar" aria-label="Study Hub navigation">
        <div className="ws-brand">
          <span className="ws-brand-mark" aria-hidden="true">▰</span>
          <span className="ws-brand-name">STUDY-HUB</span>
          <button type="button" className="ws-sidebar-close" aria-label="Close navigation" onClick={() => setSidebarOpen(false)}>×</button>
        </div>

        <nav className="ws-nav" aria-label="Primary">
          <a className="ws-nav-item" href={homeHref}><WorkspaceIcon name="home" /> Home</a>
          <a className="ws-nav-item" href={libraryHref}><WorkspaceIcon name="library" /> Library</a>
          <button type="button" className="ws-nav-item" onClick={startNewQuestion} disabled={loading}><WorkspaceIcon name="plus" /> New question</button>
        </nav>

        <div className="ws-recents">
          <p className="ws-recents-label">Recents</p>
          {recents.length > 0 && (
            <input
              className="ws-recents-search"
              type="search"
              value={recentSearch}
              onChange={(event) => setRecentSearch(event.target.value)}
              placeholder="Search recent guides"
              aria-label="Search recent study guides"
            />
          )}
          {recents.length === 0 ? (
            <p className="ws-recents-empty">{base ? 'Your recent study guides will appear here.' : 'Connect the backend API to load saved guides.'}</p>
          ) : visibleRecents.length === 0 ? (
            <p className="ws-recents-empty">No recent guides match that search.</p>
          ) : (
            <ul>
              {visibleRecents.map((note) => (
                <li key={note.slug}>
                  <button
                    type="button"
                    className={`ws-recent ${activeSlug === note.slug ? 'is-active' : ''}`}
                    disabled={loading}
                    onClick={() => openRecent(note)}
                  >
                    {note.title}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <nav className="ws-sidebar-resources" aria-label="Help and policies">
          <p className="ws-recents-label">Help &amp; policies</p>
          <a className="ws-resource-link" href={`${homeHref.replace(/\/$/, '')}/sign-in.html`}><WorkspaceIcon name="account" /> Sign in</a>
          <a className="ws-resource-link" href={documentationHref}><WorkspaceIcon name="document" /> Documentation</a>
          <a className="ws-resource-link" href={legalHref}><WorkspaceIcon name="shield" /> Legal</a>
        </nav>

        <div className="ws-sidebar-foot">
          <span className="ws-avatar" aria-hidden="true">MJ</span>
          <span>Mwesigwa Jonathan</span>
        </div>
      </aside>

      <button type="button" className="ws-sidebar-backdrop" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />

      <div className="ws-main">
        <header className="ws-topbar">
          <button type="button" className="ws-hamburger" aria-label="Open navigation" aria-expanded={sidebarOpen} onClick={() => setSidebarOpen(true)}>☰</button>
          <span className="ws-topbar-title">{activeTitle || 'Study Assistant'}</span>
          <span className="ws-topbar-meta">{profile?.username ? `For ${profile.username}` : 'Academic tutor'}</span>
        </header>

        {tourOpen && profile && (
          <div className="ws-onboarding-backdrop">
            <section className="ws-onboarding-card" role="dialog" aria-modal="true" aria-labelledby="ws-onboarding-heading">
              <p className="ws-onboarding-step">YOUR STUDY HUB TOUR · 1 OF 2</p>
              <h2 id="ws-onboarding-heading">Welcome{profile.username ? `, ${profile.username.split(/\s+/)[0]}` : ''}.</h2>
              <p>Start here with AI Study. Ask a question or enter a topic for a clear, step-by-step explanation. Once you set your class and subjects in the Library, AI Study can tailor its examples and guidance to what you are learning.</p>
              <a className="ws-onboarding-next" href={`${libraryHref}?welcome=1`}>Next: personalise your Library <span aria-hidden="true">→</span></a>
              <button className="ws-onboarding-dismiss" type="button" onClick={() => setTourOpen(false)}>Explore AI Study first</button>
            </section>
          </div>
        )}

        <div className="ws-content">
          {loading && (
            <div className="ws-state ws-loading" role="status">
              <span className="ws-spinner" aria-hidden="true" />
              <p>Thinking through your question about “{activeTitle}”…</p>
            </div>
          )}

          {!loading && error && (
            <div className="ws-state ws-error" role="alert">
              <p>{error}</p>
              {draft.trim() && (
                <button type="button" className="ws-retry" onClick={() => void openNote(draft)}>
                  Try again
                </button>
              )}
            </div>
          )}

          {!loading && !error && notice && (
            <div className="ws-state ws-notice" role="status">
              <p>{notice}</p>
            </div>
          )}

          {!loading && !error && !notice && !hasNote && (
            <div className="ws-empty">
              <span className="ws-empty-mark" aria-hidden="true">✳</span>
              <p className="ws-empty-eyebrow">YOUR STUDY PARTNER</p>
              <h2>{profile?.username ? `Ready to learn, ${profile.username.split(/\s+/)[0]}?` : 'What would you like to understand?'}</h2>
              <p>
                {profile?.classLevel || profile?.subjects.length
                  ? `Study support for ${[profile.classLevel, profile.subjects.join(', ')].filter(Boolean).join(' · ')}. Ask a question or enter a topic.`
                  : 'Ask a question or enter a topic. Get a clear explanation, worked steps, and useful exam points.'}
              </p>
              {!base && (
                <p className="ws-api-warning" role="status">
                  The AI service is not connected. Set <code>PUBLIC_STUDY_HUB_API_URL</code> in the frontend environment to your backend URL.
                </p>
              )}
              <div className="ws-suggestions" aria-label="Try a suggested question">
                {suggestedQuestions.map((question) => (
                  <button
                    key={question}
                    type="button"
                    className="ws-suggestion"
                    disabled={loading}
                    onClick={() => void openNote(question)}
                  >
                    {question}<span aria-hidden="true">↗</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {hasNote && (
            <article className="ws-note">
              <div className="ws-note-heading">
                <div className="ws-note-heading-copy">
                  <p className="ws-note-kicker">STUDY GUIDE · AI REFERENCE</p>
                  <h1 className="ws-note-title">{activeTitle || 'AI tutor response'}</h1>
                </div>
                <button type="button" className="ws-copy-button" onClick={() => void copyResponse()}>
                  {copied ? 'Copied' : 'Copy answer'}
                </button>
              </div>
              {copyError && <p className="ws-copy-error" role="status">{copyError}</p>}
              {source === 'generated-unsaved' && (
                <p className="ws-save-note">This answer is available now, but is not saved to the shared library.</p>
              )}
              <div className="ws-prose">{renderMarkdown(markdown)}</div>
            </article>
          )}
        </div>

        <form className="ws-prompt" onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="text"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Ask a question or enter a study topic…"
            aria-label="Your study question or topic"
            autoComplete="off"
            maxLength={300}
            disabled={loading}
          />
          <span className="ws-prompt-model">Gemini · Study mode</span>
          <button type="submit" className="ws-prompt-send" aria-label="Send study question" disabled={loading || !draft.trim()}>
            {loading ? <span className="ws-send-spinner" aria-hidden="true" /> : <span aria-hidden="true">↑</span>}
          </button>
        </form>

        <p className="ws-disclaimer">AI can make mistakes. Check important answers against your class notes and teacher’s guidance.</p>
      </div>
    </div>
  );
}
