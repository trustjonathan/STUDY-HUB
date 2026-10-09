import { useEffect, useRef, useState } from 'react';
import { getAnonymousSupabase } from '../lib/anonymousSupabase';

interface Suggestion {
  id: string;
  content: string;
  created_at: string;
}

interface Props {
  supabaseUrl: string;
  supabaseAnonKey: string;
}

const SUGGESTION_LIMIT = 1000;

export default function SuggestionBoard({ supabaseUrl, supabaseAnonKey }: Props) {
  const supabase = supabaseUrl && supabaseAnonKey
    ? getAnonymousSupabase(supabaseUrl, supabaseAnonKey)
    : null;
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine);
  const [notice, setNotice] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const suggestionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateOnline = () => setOnline(navigator.onLine);
    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);
    return () => {
      window.removeEventListener('online', updateOnline);
      window.removeEventListener('offline', updateOnline);
    };
  }, []);

  useEffect(() => {
    if (!supabase || !online) {
      setLoading(false);
      return;
    }

    setLoading(true);
    let active = true;
    let latestRequest = 0;
    const loadSuggestions = async () => {
      const request = ++latestRequest;
      const { data, error } = await supabase
        .from('study_hub_suggestions')
        .select('id, content, created_at')
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(100);

      if (!active || request !== latestRequest) return;
      setLoading(false);
      if (error) {
        setErrorMessage('Suggestions could not be loaded. Please try again.');
        return;
      }
      setErrorMessage('');
      setSuggestions((data ?? []) as Suggestion[]);
    };

    const channel = supabase
      .channel('study-hub-suggestions')
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'study_hub_suggestions'
      }, () => {
        void loadSuggestions();
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') void loadSuggestions();
      });

    void loadSuggestions();
    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [online, supabase]);

  useEffect(() => {
    if (suggestionsRef.current) suggestionsRef.current.scrollTop = 0;
  }, [suggestions]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const content = draft.trim();
    if (!supabase || !content || sending || !online) return;

    setSending(true);
    setNotice('');
    setErrorMessage('');
    try {
      const { error } = await supabase.from('study_hub_suggestions').insert({ content });
      if (error) throw error;
      setDraft('');
      setNotice('Thank you. Your suggestion is submitted anonymously and will appear after review.');
    } catch {
      setErrorMessage('Your suggestion was not submitted. Please check your connection and try again.');
    } finally {
      setSending(false);
    }
  };

  if (!supabase) {
    return <p className="suggestion-config-error" role="alert">The suggestion board is not configured yet.</p>;
  }

  return (
    <section className="suggestion-board" aria-label="Anonymous Study Hub suggestions">
      <div className="suggestion-board-main">
        <div className="suggestion-feed-heading">
          <div>
            <span className="suggestion-kicker">COMMUNITY IDEAS</span>
            <h2>Suggestions from learners</h2>
          </div>
          <span className="suggestion-feed-status">
            <span aria-hidden="true" /> {online ? errorMessage ? 'Board unavailable' : 'Live board' : 'Offline'}
          </span>
        </div>
        {!online && <p className="suggestion-alert" role="status">Reconnect to view or submit suggestions.</p>}
        {errorMessage && <p className="suggestion-alert" role="alert">{errorMessage}</p>}
        <div className="suggestion-feed" ref={suggestionsRef} aria-live="polite">
          {loading ? (
            <p className="suggestion-empty" role="status">Loading approved suggestions…</p>
          ) : suggestions.length === 0 && errorMessage ? null : suggestions.length === 0 ? (
            <p className="suggestion-empty">No approved suggestions yet. Share the first one.</p>
          ) : suggestions.map((suggestion) => (
            <article className="suggestion-entry" key={suggestion.id}>
              <p>{suggestion.content}</p>
              <time dateTime={suggestion.created_at}>
                {new Date(suggestion.created_at).toLocaleDateString(undefined, {
                  day: 'numeric', month: 'short', year: 'numeric'
                })}
              </time>
            </article>
          ))}
        </div>
      </div>

      <aside className="suggestion-compose-panel" aria-labelledby="suggestion-compose-title">
        <span className="suggestion-kicker">NO ACCOUNT REQUIRED</span>
        <h2 id="suggestion-compose-title">Leave a suggestion</h2>
        <p className="suggestion-privacy-note">
          No name or email is requested. Suggestions are reviewed before they become public. Avoid including personal details.
        </p>
        <form className="suggestion-form" onSubmit={handleSubmit}>
          <label className="visually-hidden" htmlFor="suggestion-content">Your suggestion</label>
          <textarea
            id="suggestion-content"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            maxLength={SUGGESTION_LIMIT}
            rows={5}
            placeholder="What would make Study Hub more useful?"
            disabled={!online || sending}
            required
          />
          <div className="suggestion-form-footer">
            <span>{draft.length}/{SUGGESTION_LIMIT}</span>
            <button className="suggestion-submit" type="submit" disabled={!online || sending || !draft.trim()}>
              {sending ? 'Submitting…' : 'Submit anonymously'}
            </button>
          </div>
        </form>
        {notice && <p className="suggestion-success" role="status">{notice}</p>}
      </aside>
    </section>
  );
}