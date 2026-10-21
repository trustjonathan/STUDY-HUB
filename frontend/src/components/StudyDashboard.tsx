import { useEffect, useRef, useState } from 'react';
import { clearAuthSession, readAuthSession, updateAuthSessionUser } from '../utils/authSession';
import StudyWorkspace from './StudyWorkspace';
import LibraryWorkspace from './LibraryWorkspace';
import LearningPreferencesForm, { type LearningPreferences } from './LearningPreferencesForm';
import OnboardingTour from './OnboardingTour';
import StudyPlanWorkspace from './StudyPlanWorkspace';
import { tourSteps } from '../config/tourSteps';

interface Props {
  baseHref: string;
  libraryHref: string;
  signInHref: string;
  initialView?: 'home' | 'tutor';
}

interface StudyUser {
  username?: string;
  email?: string;
  learnerType?: 'student' | 'non-student' | null;
  educationLevel?: 'university' | 'secondary' | 'primary' | 'nursery' | null;
  universityCourse?: string | null;
  universityYear?: number | null;
  secondaryTrack?: 'O-Level' | 'A-Level' | null;
  classLevel?: string | null;
  subjects?: string[];
  onboardingComplete?: boolean;
}

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

function tourStorageKey(email: string): string {
  return `has_completed_studyhub_tour:${email.trim().toLowerCase()}`;
}

function hasCompletedTour(email: string): boolean {
  const normalizedEmail = email.trim().toLowerCase();
  return localStorage.getItem(tourStorageKey(email)) === 'complete'
    || localStorage.getItem(`study-hub-ai-tour-complete:${normalizedEmail}`) === 'complete';
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

function Icon({ name }: { name: 'spark' | 'book' | 'target' | 'calendar' | 'arrow' | 'wifi' | 'download' | 'menu' }) {
  const paths = {
    spark: <><path d="m12 3 1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3Z" /><path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z" /></>,
    book: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5z" /><path d="M4 5.5v16M8 7h8M8 11h8" /></>,
    target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
    wifi: <><path d="M5 12.5a11 11 0 0 1 14 0M8.5 16a5.5 5.5 0 0 1 7 0M12 20h.01" /><path d="m3 3 18 18" /></>,
    download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m7 10 5 5 5-5M12 15V3" /></>,
    menu: <><path d="M4 6h16M4 12h16M4 18h16" /></>,
  };

  return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

export default function StudyDashboard({ baseHref, libraryHref, signInHref, initialView = 'home' }: Props) {
  const [user, setUser] = useState<StudyUser | null>(null);
  const [view, setView] = useState<'home' | 'tutor' | 'library' | 'plan' | 'preferences'>(initialView);
  const [online, setOnline] = useState(true);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [studyPlanPreparing, setStudyPlanPreparing] = useState(false);
  const [profileSyncing, setProfileSyncing] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [tourStep, setTourStep] = useState<number | null>(null);
  const [profileSetupRequired, setProfileSetupRequired] = useState(false);
  const planPreparationInFlight = useRef(false);

  function openView(next: 'home' | 'tutor' | 'library' | 'plan' | 'preferences') {
    setView(next);
    setMobileNavOpen(false);
    const url = new URL(window.location.href);
    if (next === 'home') url.searchParams.delete('view');
    else url.searchParams.set('view', next);
    window.history.replaceState({}, '', url);
  }

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('view');
    if (requested === 'tutor' || requested === 'library' || requested === 'plan' || requested === 'preferences') setView(requested);
  }, []);

  function openPreferences() {
    if (user) openView('preferences');
    else window.location.assign(`${signInHref}?return=${encodeURIComponent(`${baseHref}study.html?view=preferences`)}`);
  }

  async function prepareStudyPlan() {
    const session = readAuthSession<StudyUser>();
    const base = apiBase();
    if (!session?.token || !base || session.user.learnerType !== 'student') return;
    if (planPreparationInFlight.current) return;
    planPreparationInFlight.current = true;
    setStudyPlanPreparing(true);
    try {
      const response = await fetch(`${base}/api/study-plan`, {
        method: 'POST',
        signal: AbortSignal.timeout(120_000),
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
        body: JSON.stringify({}),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Your study plan could not be prepared.');
    } catch (planError) {
      setNotice(
        planError instanceof DOMException && planError.name === 'TimeoutError'
          ? 'Your study plan is taking longer than expected. Please open My study plan to try again.'
          : planError instanceof Error ? planError.message : 'Your study plan could not be prepared.',
      );
    } finally {
      planPreparationInFlight.current = false;
      setStudyPlanPreparing(false);
    }
  }

  function startTour() {
    setView('home');
    setTourStep(0);
    setMobileNavOpen(false);
    void prepareStudyPlan();
  }

  function advanceTour(direction: -1 | 1) {
    const nextStep = (tourStep ?? 0) + direction;
    if (nextStep < 0) return;
    if (nextStep >= tourSteps.length) {
      finishTour();
      return;
    }
    setTourStep(nextStep);
  }

  function finishTour() {
    try {
      const email = readAuthSession<StudyUser>()?.user.email || user?.email;
      if (email) localStorage.setItem(tourStorageKey(email), 'complete');
    } catch {
      setNotice('Your tour is complete, but this browser could not save tour progress.');
    }
    setTourStep(null);
    const url = new URL(window.location.href);
    url.searchParams.delete('welcome');
    url.searchParams.delete('tour');
    window.history.replaceState({}, '', url);
    openView('tutor');
  }

  async function savePreferences(preferences: LearningPreferences) {
    const session = readAuthSession<StudyUser>();
    if (!session?.token) throw new Error('Sign in again to update your learning profile.');
    const base = apiBase();
    if (!base) throw new Error('Profile settings are unavailable because the backend API is not configured.');
    const response = await fetch(`${base}/api/auth/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
      body: JSON.stringify({
        learnerType: preferences.learnerType,
        educationLevel: preferences.educationLevel,
        universityCourse: preferences.universityCourse || null,
        universityYear: preferences.universityYear,
        secondaryTrack: preferences.secondaryTrack,
        classLevel: preferences.classLevel,
        subjects: preferences.subjects,
        onboardingComplete: true,
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.user || typeof result.user.email !== 'string') {
      if (response.status === 401 || response.status === 403) {
        clearAuthSession();
        setUser(null);
      }
      throw new Error(result.message || result.error || 'Your learning profile could not be saved.');
    }
    updateAuthSessionUser(result.user);
    setUser(result.user);
    if (result.user.learnerType === 'student') void prepareStudyPlan();
    if (profileSetupRequired) {
      setProfileSetupRequired(false);
      setTourStep(0);
      setView('home');
      const url = new URL(window.location.href);
      url.searchParams.delete('welcome');
      url.searchParams.delete('view');
      window.history.replaceState({}, '', url);
    }
  }

  const viewTitle = view === 'home' ? 'AI Study' : view === 'tutor' ? 'AI Tutor' : view === 'library' ? 'Study Library' : view === 'plan' ? 'Study plan' : 'My preferences';

  useEffect(() => {
    const session = readAuthSession<StudyUser>();
    if (session) {
      setUser(session.user);
      const isProfileSetupRequired = session.user.learnerType !== 'student' && session.user.learnerType !== 'non-student';
      const params = new URLSearchParams(window.location.search);
      const forceTour = params.get('tour') === '1' || params.get('welcome') === '1';
      if (isProfileSetupRequired) {
        setProfileSetupRequired(true);
        setView('preferences');
      }
      try {
        const completedTour = hasCompletedTour(session.user.email || '');
        if (!isProfileSetupRequired && (forceTour || !completedTour)) {
          setView('home');
          setTourStep(0);
          if (session.user.learnerType === 'student') void prepareStudyPlan();
        }
      } catch {
        setNotice('Your guided tour is ready, but this browser may not remember when you finish it.');
        if (!isProfileSetupRequired) {
          setView('home');
          setTourStep(0);
          if (session.user.learnerType === 'student') void prepareStudyPlan();
        }
      }
    }

    function updateNetwork() {
      setOnline(navigator.onLine);
    }
    updateNetwork();
    function captureInstall(event: Event) {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    }
    function markInstalled() {
      setInstalled(true);
      setInstallPrompt(null);
    }
    function closeNavigation(event: KeyboardEvent) {
      if (event.key === 'Escape') setMobileNavOpen(false);
    }

    window.addEventListener('online', updateNetwork);
    window.addEventListener('offline', updateNetwork);
    window.addEventListener('beforeinstallprompt', captureInstall);
    window.addEventListener('appinstalled', markInstalled);
    window.addEventListener('keydown', closeNavigation);

    const base = apiBase();
    if (session && base && navigator.onLine) {
      setProfileSyncing(true);
      void fetch(`${base}/api/auth/profile`, {
        signal: AbortSignal.timeout(15_000),
        headers: { Authorization: `Bearer ${session.token}` },
      }).then(async (response) => {
        if (!response.ok) {
          setNotice(response.status === 401
            ? 'Your sign-in session may have expired. Sign in again to sync your learning profile.'
            : `Your learning profile could not be synchronized (HTTP ${response.status}).`);
          return;
        }
        const profile: unknown = await response.json();
        if (typeof profile === 'object' && profile !== null) {
          const safeProfile = profile as StudyUser;
          setUser((current) => ({ ...current, ...safeProfile }));
        }
      }).catch(() => {
        setNotice('Could not refresh your learning profile. Showing the preferences available in this session.');
      }).finally(() => setProfileSyncing(false));
    }

    if (window.matchMedia('(display-mode: standalone)').matches) setInstalled(true);
    return () => {
      window.removeEventListener('online', updateNetwork);
      window.removeEventListener('offline', updateNetwork);
      window.removeEventListener('beforeinstallprompt', captureInstall);
      window.removeEventListener('appinstalled', markInstalled);
      window.removeEventListener('keydown', closeNavigation);
    };
  }, []);

  const subjects = Array.isArray(user?.subjects) ? user.subjects : [];
  const firstName = user?.username?.trim().split(/\s+/)[0] || 'learner';
  const personalized = Boolean(user && (user.learnerType || user.classLevel || subjects.length));

  async function installApp() {
    if (!installPrompt) {
      setNotice(/iPhone|iPad|iPod/.test(navigator.userAgent)
        ? 'To install on iPhone or iPad, use Share, then choose “Add to Home Screen”.'
        : 'Use your browser menu and choose “Install Study Hub” or “Add to Home Screen”.');
      return;
    }
    setInstalling(true);
    try {
      await installPrompt.prompt();
      setNotice('Choose whether to install Study Hub in the browser prompt…');
      const choice = await installPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setInstallPrompt(null);
        setNotice('Study Hub is being installed.');
      } else {
        setNotice('Installation was canceled.');
      }
    } catch {
      setNotice('The install prompt could not open. Use your browser menu to install Study Hub.');
    } finally {
      setInstalling(false);
    }
  }

  const nav = [
    { label: 'Study home', key: 'home' as const, icon: 'spark' as const },
    { label: 'AI tutor', key: 'tutor' as const, icon: 'target' as const },
    { label: 'Study library', key: 'library' as const, icon: 'book' as const },
    { label: 'My study plan', key: 'plan' as const, icon: 'calendar' as const },
    { label: 'My preferences', key: 'preferences' as const, icon: 'calendar' as const },
  ];

  return (
    <div className="study-app">
      {mobileNavOpen && <button className="study-mobile-backdrop" aria-label="Close menu" onClick={() => setMobileNavOpen(false)} />}
      <aside className={`study-sidebar${mobileNavOpen ? ' is-open' : ''}`}>
        <button className="study-brand" type="button" onClick={() => openView('home')}>
          <img src={`${baseHref}favicon.svg`} alt="" />
          <span><strong>Study Hub</strong><small>AI Study</small></span>
        </button>
        <button className="study-mobile-close" type="button" aria-label="Close study navigation" onClick={() => setMobileNavOpen(false)}>×</button>
        <p className="study-nav-label">WORKSPACE</p>
        <nav className="study-nav" aria-label="AI Study navigation">
          {nav.map((item) => (
            <button key={item.label} id={item.key === 'tutor' ? 'ai-tutor-btn' : item.key === 'library' ? 'study-library-nav' : item.key === 'plan' ? 'study-plan-nav' : undefined} type="button" aria-current={view === item.key ? 'page' : undefined} onClick={() => openView(item.key)}>
              <Icon name={item.icon} /><span>{item.label}</span>
              {view === item.key && <span className="study-nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="study-sidebar-spacer" />
        <div className={`study-connectivity ${online ? 'is-online' : 'is-offline'}`} role="status">
          <span className="study-connectivity-dot" />
          <span>{online ? 'Connection available' : 'Offline mode'}</span>
        </div>
        <button className="study-install-button" type="button" onClick={() => void installApp()} disabled={installed || installing}>
          {installing ? <span className="study-progress-spinner" aria-hidden="true" /> : <Icon name="download" />}
          <span>{installed ? 'App installed' : installing ? 'Opening install prompt…' : 'Install Study Hub'}</span>
        </button>
        <button id="user-profile" className="study-account-link" type="button" onClick={user ? () => openView('preferences') : () => window.location.assign(`${signInHref}?return=${encodeURIComponent(`${baseHref}study.html`)}`)}>
          <span className="study-user-avatar">{user?.username?.charAt(0).toUpperCase() || 'S'}</span>
          <span><strong>{user?.username || 'Your account'}</strong><small>{user?.email || (user ? 'Profile settings' : 'Sign in to sync')}</small></span>
          <span className="study-account-arrow">→</span>
        </button>
      </aside>

      <main className="study-main">
        <header className="study-topbar">
          <button className="study-menu-button" type="button" aria-label="Open navigation" aria-expanded={mobileNavOpen} onClick={() => setMobileNavOpen(true)}>
            <Icon name="menu" />
          </button>
          <div className="study-breadcrumb"><span>Study Hub</span><b>/</b><strong>{viewTitle}</strong></div>
          <div className="study-topbar-right">
            {(studyPlanPreparing || profileSyncing) && (
              <span className="study-async-status" role="status" aria-live="polite">
                <span className="study-progress-spinner" aria-hidden="true" />
                {studyPlanPreparing ? 'Preparing your study plan…' : 'Syncing your profile…'}
              </span>
            )}
            {user && <button className="study-tour-button" type="button" onClick={startTour}>Take the tour</button>}
            <span className={`study-status-chip ${online ? 'is-online' : 'is-offline'}`}>
              <i />{online ? 'Connected' : 'Offline'}
            </span>
            {!installed && <button className="study-top-install" type="button" onClick={() => void installApp()} disabled={installing}>{installing ? 'Opening install prompt…' : 'Install app'}</button>}
          </div>
        </header>

        {!online && <div className="study-offline-banner" role="status"><Icon name="wifi" /><span>You’re offline. Your dashboard is available; AI responses need an internet connection.</span></div>}
        {notice && <div className="study-notice" role="status"><span>{notice}</span><button type="button" onClick={() => setNotice('')} aria-label="Dismiss notice">×</button></div>}

        {view === 'home' && <div className="study-content">
          <section className="study-welcome">
            <div className="study-welcome-copy">
              <p className="study-eyebrow"><span /> YOUR PERSONAL STUDY SPACE</p>
              <h1>Good to see you, {firstName}<span>.</span></h1>
              <p className="study-welcome-subtitle">
                {personalized
                  ? `A focused space for ${user?.classLevel || 'your studies'}${subjects.length ? ` · ${subjects.slice(0, 3).join(', ')}${subjects.length > 3 ? ` +${subjects.length - 3}` : ''}` : ''}.`
                  : 'Your learning, resources, and study tools — together in one place.'}
              </p>
              <button className="study-primary-action" type="button" onClick={() => openView('tutor')}>
                <Icon name="spark" /> Open AI tutor <Icon name="arrow" />
              </button>
              {!user && <p className="study-welcome-helper">Sign in to personalize your study space and sync your progress.</p>}
            </div>
            <div className="study-welcome-art" aria-hidden="true">
              <div className="study-art-orbit study-art-orbit-one" />
              <div className="study-art-orbit study-art-orbit-two" />
              <div className="study-art-book"><Icon name="book" /></div>
              <span className="study-art-star study-art-star-one">✦</span>
              <span className="study-art-star study-art-star-two">✧</span>
              <span className="study-art-tag">LEARN WITH CLARITY</span>
            </div>
          </section>

          <section className="study-section">
            <div className="study-section-heading">
              <div><p className="study-section-kicker">YOUR TOOLKIT</p><h2>Pick up where you want to grow</h2></div>
              <button type="button" onClick={() => openView('library')} className="study-text-link">Explore library <Icon name="arrow" /></button>
            </div>
            <div className="study-tools-grid">
              <button type="button" className="study-tool-card study-tool-ai" onClick={() => openView('tutor')}>
                <span className="study-tool-icon"><Icon name="spark" /></span>
                <span className="study-tool-copy"><strong>Ask your AI tutor</strong><small>Explore a topic and get a clear, step-by-step study guide.</small></span>
                <span className="study-tool-arrow"><Icon name="arrow" /></span>
              </button>
              <button type="button" className="study-tool-card study-tool-library" onClick={() => openView('library')}>
                <span className="study-tool-icon"><Icon name="book" /></span>
                <span className="study-tool-copy"><strong>Find a resource</strong><small>Browse notes, past papers, and learning materials.</small></span>
                <span className="study-tool-arrow"><Icon name="arrow" /></span>
              </button>
              <button type="button" className="study-tool-card study-tool-profile" onClick={openPreferences}>
                <span className="study-tool-icon"><Icon name="target" /></span>
                <span className="study-tool-copy"><strong>{personalized ? 'Your study profile' : 'Personalize your learning'}</strong><small>{personalized ? 'Review the class and subjects used to tailor your guidance.' : 'Choose your class and subjects to make guidance more relevant.'}</small></span>
                <span className="study-tool-arrow"><Icon name="arrow" /></span>
              </button>
            </div>
          </section>

          <section className="study-lower-grid">
            <div id="study-progress-panel" className="study-panel study-progress-panel">
              <div className="study-panel-heading"><div><p className="study-section-kicker">YOUR PROGRESS</p><h2>Build your study rhythm</h2></div><span className="study-panel-symbol"><Icon name="target" /></span></div>
              {personalized ? (
                <div className="study-subject-list">
                  <p>Your personal study plan tracks topics, study streaks, progress, and recommendations.</p>
                  <div className="study-profile-tags">
                    {user?.classLevel && <span>{user.classLevel}</span>}
                    {subjects.slice(0, 4).map((subject) => <span key={subject}>{subject}</span>)}
                  </div>
                  <button type="button" onClick={() => openView('plan')} className="study-inline-link">Open your study plan <Icon name="arrow" /></button>
                </div>
              ) : (
                <div className="study-empty-progress">
                  <span className="study-empty-mark"><Icon name="calendar" /></span>
                  <p>Your study progress will take shape here.</p>
                  <button type="button" onClick={openPreferences}>Set up your learning profile <Icon name="arrow" /></button>
                </div>
              )}
            </div>
            <div className="study-panel study-offline-panel">
              <span className="study-offline-icon"><Icon name="download" /></span>
              <p className="study-section-kicker">READY WHEN YOU ARE</p>
              <h2>Study Hub, on your device</h2>
              <p>Install this workspace for a focused app-like experience. The dashboard shell stays available offline after your first visit.</p>
              <button type="button" onClick={() => void installApp()} disabled={installed}>
                {installed ? 'Installed on this device' : 'Install the app'} <Icon name="arrow" />
              </button>
              <small>AI tutor responses and live library updates need internet.</small>
            </div>
          </section>

          <footer className="study-footer">
            <span>Study Hub AI Study</span><span>Made for focused learning · Uganda</span>
            <a href={`${baseHref}privacy.html`}>Privacy</a>
          </footer>
        </div>}

        {view === 'tutor' && (
          <section className="study-embedded-view" aria-label="AI Tutor">
            {user?.learnerType === 'student' && (
              <StudyPlanWorkspace
                compact
                apiBase={apiBase()}
                resourceCatalogUrl={`${baseHref}study-hub-resources-1-catalog.json`}
                freshTeacherCatalogUrl={`${baseHref}fresh-teacher-catalog.json`}
                readerBase={`${baseHref}full_page_flipbook_viewer/index.html`}
                classLevel={user.classLevel || ''}
                subjects={subjects}
                supabaseUrl={import.meta.env.PUBLIC_SUPABASE_URL || ''}
                anonKey={import.meta.env.PUBLIC_SUPABASE_ANON_KEY || ''}
              />
            )}
            <StudyWorkspace
              homeHref={baseHref}
              libraryHref={libraryHref}
              documentationHref={`${baseHref}documentation.html`}
              legalHref={`${baseHref}legal.html`}
              embedded
              onOpenLibrary={() => openView('library')}
            />
          </section>
        )}

        {view === 'plan' && (
          <section className="study-content study-plan-view">
            {user?.learnerType === 'student' ? (
              <StudyPlanWorkspace
                apiBase={apiBase()}
                resourceCatalogUrl={`${baseHref}study-hub-resources-1-catalog.json`}
                freshTeacherCatalogUrl={`${baseHref}fresh-teacher-catalog.json`}
                readerBase={`${baseHref}full_page_flipbook_viewer/index.html`}
                classLevel={user.classLevel || ''}
                subjects={subjects}
                supabaseUrl={import.meta.env.PUBLIC_SUPABASE_URL || ''}
                anonKey={import.meta.env.PUBLIC_SUPABASE_ANON_KEY || ''}
              />
            ) : (
              <div className="study-panel study-preferences-panel">
                <h1>Your study plan needs a learner profile.</h1>
                <p>Choose your class, course, and subjects to create a plan tailored to what you are studying.</p>
                <button type="button" className="study-primary-action" onClick={openPreferences}>Set up learning profile <Icon name="arrow" /></button>
              </div>
            )}
          </section>
        )}

        {view === 'library' && (
          <section className="study-embedded-view" aria-label="Study Library">
            <LibraryWorkspace
              homeHref={baseHref}
              supabaseUrl={import.meta.env.PUBLIC_SUPABASE_URL || ''}
              anonKey={import.meta.env.PUBLIC_SUPABASE_ANON_KEY || ''}
              apiUrl={apiBase()}
              embedded
            />
          </section>
        )}

        {view === 'preferences' && (
          <section className="study-content study-preferences-view">
            <div className="study-panel study-preferences-panel">
              <p className="study-section-kicker">YOUR LEARNING PROFILE</p>
              <h1>Make AI Study yours.</h1>
              <p>Choose your class and subjects to tailor the Library and AI tutor to your learning.</p>
              {user ? (
                <>
                  <LearningPreferencesForm
                    key={`${user.learnerType || ''}-${user.educationLevel || ''}-${user.universityCourse || ''}-${user.universityYear || ''}-${user.secondaryTrack || ''}-${user.classLevel || ''}-${(user.subjects || []).join(',')}`}
                    initialLearnerType={user.learnerType}
                    initialEducationLevel={user.educationLevel}
                    initialUniversityCourse={user.universityCourse}
                    initialUniversityYear={user.universityYear}
                    initialSecondaryTrack={user.secondaryTrack}
                    initialClassLevel={user.classLevel || ''}
                    initialSubjects={user.subjects || []}
                    submitLabel={profileSetupRequired ? 'Save profile and continue' : 'Save preferences'}
                    onSave={savePreferences}
                  />
                  {!profileSetupRequired && <button className="study-tour-button" type="button" onClick={startTour}>Restart product tour</button>}
                </>
              ) : (
                <button type="button" className="study-primary-action" onClick={openPreferences}>
                  Sign in to personalize your study space <Icon name="arrow" />
                </button>
              )}
            </div>
          </section>
        )}

        {user && (
          <OnboardingTour
            open={tourStep !== null}
            stepIndex={tourStep ?? 0}
            steps={tourSteps}
            onNext={() => advanceTour(1)}
            onBack={() => advanceTour(-1)}
            onSkip={finishTour}
          />
        )}
      </main>
    </div>
  );
}
