import type { ReactNode } from 'react';

// Minimal, safe Markdown -> React renderer (headings, bullets, bold, code).
// No raw HTML injection, so generated content cannot run scripts.

export function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*|__)(.+?)\1|`([^`]+)`/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let n = 0;
  while ((match = pattern.exec(text))) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    if (match[3] !== undefined) {
      nodes.push(<code key={`${keyPrefix}-c${n}`}>{match[3]}</code>);
    } else if (match[2] !== undefined) {
      nodes.push(<strong key={`${keyPrefix}-b${n}`}>{match[2]}</strong>);
    }
    lastIndex = pattern.lastIndex;
    n += 1;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

export function renderMarkdown(markdown: string): ReactNode[] {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let bullets: string[] = [];
  let numbered: string[] = [];
  let key = 0;

  const flushBullets = () => {
    if (!bullets.length) return;
    blocks.push(
      <ul key={`ul-${key++}`}>
        {bullets.map((item, i) => (
          <li key={i}>{renderInline(item, `li-${key}-${i}`)}</li>
        ))}
      </ul>
    );
    bullets = [];
  };

  const flushNumbered = () => {
    if (!numbered.length) return;
    blocks.push(
      <ol key={`ol-${key++}`}>
        {numbered.map((item, i) => (
          <li key={i}>{renderInline(item, `ol-${key}-${i}`)}</li>
        ))}
      </ol>
    );
    numbered = [];
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const trimmed = line.trim();
    if (!trimmed) {
      flushBullets();
      flushNumbered();
      continue;
    }
    const heading = trimmed.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      flushBullets();
      flushNumbered();
      const level = heading[1].length;
      const content = renderInline(heading[2], `h-${key}`);
      if (level <= 2) blocks.push(<h2 key={`h-${key++}`}>{content}</h2>);
      else blocks.push(<h3 key={`h-${key++}`}>{content}</h3>);
      continue;
    }
    const bullet = trimmed.match(/^[-*+]\s+(.*)$/);
    if (bullet) {
      flushNumbered();
      bullets.push(bullet[1]);
      continue;
    }
    const orderedItem = trimmed.match(/^\d+[.)]\s+(.*)$/);
    if (orderedItem) {
      flushBullets();
      numbered.push(orderedItem[1]);
      continue;
    }
    flushBullets();
    flushNumbered();
    blocks.push(<p key={`p-${key++}`}>{renderInline(trimmed, `p-${key}`)}</p>);
  }
  flushBullets();
  flushNumbered();
  return blocks;
}
