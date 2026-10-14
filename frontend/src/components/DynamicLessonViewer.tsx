import { useEffect, useRef, useState } from 'react';
import { renderMarkdown } from './markdown';

interface Props {
  topic: string;
}

// Reads the public backend origin from the Astro build-time env var.
// The Gemini key never reaches the browser — the island calls our Express
// backend, which holds the key server-side (same pattern as the study companion).
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

export default function DynamicLessonViewer({ topic }: Props) {
  const [markdown, setMarkdown] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const base = apiBase();
    if (!base) {
      setError('AI study guides are not connected yet. Configure the backend API URL to enable them.');
      setLoading(false);
      return;
    }

    let active = true;
    (async () => {
      try {
        const response = await fetch(`${base}/api/lesson-guide`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ topic })
        });
        const result = await response.json().catch(() => ({}));
        if (!active) return;
        if (result.refused) {
          setNotice(result.message || 'That topic is outside the academic subjects Study Hub can help with.');
          return;
        }
        if (!response.ok || typeof result.markdown !== 'string' || !result.markdown.trim()) {
          throw new Error(result.error || 'This study guide could not be generated. Please try again.');
        }
        setMarkdown(result.markdown);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'This study guide could not be generated.');
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => { active = false; };
  }, [topic]);

  if (loading) {
    return (
      <div className="lesson-state lesson-loading" role="status">
        <span className="lesson-spinner" aria-hidden="true" />
        <p>Generating your AI study guide for “{topic}”…</p>
      </div>
    );
  }

  if (notice) {
    return (
      <div className="lesson-state lesson-notice" role="status">
        <p>{notice}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="lesson-state lesson-error" role="alert">
        <p>{error}</p>
      </div>
    );
  }

  return (
    <article className="lesson-content">
      <span className="lesson-badge">AI Generated Resource</span>
      <div className="lesson-prose">{renderMarkdown(markdown)}</div>
    </article>
  );
}
