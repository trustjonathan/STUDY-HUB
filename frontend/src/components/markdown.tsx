import type { ReactNode } from 'react';

// Minimal, safe Markdown -> React renderer (headings, bullets, bold, code).
// No raw HTML injection, so generated content cannot run scripts.

const mathSymbols: Record<string, string> = {
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', theta: 'θ',
  lambda: 'λ', mu: 'μ', pi: 'π', rho: 'ρ', sigma: 'σ', phi: 'φ', omega: 'ω',
  Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Pi: 'Π', Sigma: 'Σ', Phi: 'Φ', Omega: 'Ω',
  cdot: '·', times: '×', div: '÷', pm: '±', approx: '≈', neq: '≠', leq: '≤', geq: '≥',
  infty: '∞', to: '→', rightarrow: '→', leftarrow: '←', leftrightarrow: '↔',
  partial: '∂', nabla: '∇', degree: '°',
};

function readGroup(source: string, start: number): { content: string; end: number } {
  if (source[start] !== '{') return { content: source[start] || '', end: Math.min(start + 1, source.length) };
  let depth = 1;
  let cursor = start + 1;
  while (cursor < source.length && depth > 0) {
    if (source[cursor] === '\\') {
      cursor += 2;
      continue;
    }
    if (source[cursor] === '{') depth += 1;
    if (source[cursor] === '}') depth -= 1;
    cursor += 1;
  }
  return { content: source.slice(start + 1, cursor - 1), end: cursor };
}

function renderMath(tex: string, keyPrefix: string): ReactNode[] {
  let key = 0;
  const renderSequence = (source: string): ReactNode[] => {
    const nodes: ReactNode[] = [];
    let cursor = 0;

    const parseAtom = (): ReactNode => {
      const character = source[cursor];
      if (character === '{') {
        const group = readGroup(source, cursor);
        cursor = group.end;
        return <span key={`${keyPrefix}-g${key++}`}>{renderSequence(group.content)}</span>;
      }
      if (character === '\\') {
        cursor += 1;
        const commandStart = cursor;
        while (/[A-Za-z]/.test(source[cursor] || '')) cursor += 1;
        const command = source.slice(commandStart, cursor) || source[cursor++];

        if (command === 'frac' || command === 'dfrac' || command === 'tfrac') {
          while (source[cursor] === ' ') cursor += 1;
          const numerator = readGroup(source, cursor);
          cursor = numerator.end;
          const denominator = readGroup(source, cursor);
          cursor = denominator.end;
          return (
            <span className="ws-math-fraction" key={`${keyPrefix}-f${key++}`} role="math">
              <span>{renderSequence(numerator.content)}</span>
              <span>{renderSequence(denominator.content)}</span>
            </span>
          );
        }

        if (command === 'sqrt') {
          const radicand = readGroup(source, cursor);
          cursor = radicand.end;
          return <span className="ws-math-root" key={`${keyPrefix}-r${key++}`}><span aria-hidden="true">√</span><span>{renderSequence(radicand.content)}</span></span>;
        }

        if (command === 'text' || command === 'mathrm' || command === 'mathbf' || command === 'operatorname') {
          const group = readGroup(source, cursor);
          cursor = group.end;
          const className = command === 'mathbf' ? 'ws-math-bold' : command === 'text' || command === 'operatorname' ? 'ws-math-text' : 'ws-math-roman';
          return <span className={className} key={`${keyPrefix}-t${key++}`}>{renderSequence(group.content)}</span>;
        }

        if (command === 'xrightarrow' || command === 'xleftarrow') {
          let below = '';
          let above = '';
          if (source[cursor] === '[') {
            const close = source.indexOf(']', cursor + 1);
            if (close !== -1) {
              below = source.slice(cursor + 1, close);
              cursor = close + 1;
            }
          }
          if (source[cursor] === '{') {
            const group = readGroup(source, cursor);
            above = group.content;
            cursor = group.end;
          }
          return (
            <span className="ws-math-arrow" key={`${keyPrefix}-a${key++}`}>
              {above && <span>{renderSequence(above)}</span>}
              <span aria-label={command === 'xrightarrow' ? 'right arrow' : 'left arrow'}>{command === 'xrightarrow' ? '⟶' : '⟵'}</span>
              {below && <span>{renderSequence(below)}</span>}
            </span>
          );
        }

        if (command === 'left' || command === 'right' || command === 'displaystyle' || command === 'limits') {
          while (source[cursor] === ' ') cursor += 1;
          if (command === 'left' || command === 'right') return parseAtom();
          return null;
        }
        if (command === ',' || command === ';' || command === ':' || command === '!') {
          return command === '!' ? null : ' ';
        }
        if (command === 'quad' || command === 'qquad' || command === 'enspace') return ' ';
        if (command === ' ' || command === '\\') return ' ';
        if (command === '{' || command === '}' || command === '%' || command === '_' || command === '#') return command;
        return mathSymbols[command] || command;
      }

      cursor += 1;
      return character;
    };

    while (cursor < source.length) {
      if (/\s/.test(source[cursor])) {
        cursor += 1;
        nodes.push(' ');
        continue;
      }
      if (source[cursor] === '}' || source[cursor] === ']') {
        cursor += 1;
        continue;
      }
      if (source[cursor] === '^' || source[cursor] === '_') {
        const isSuperscript = source[cursor++] === '^';
        const group = source[cursor] === '{' ? readGroup(source, cursor) : null;
        const content = group ? group.content : source[cursor] || '';
        cursor = group ? group.end : Math.min(cursor + 1, source.length);
        nodes.push(isSuperscript
          ? <sup key={`${keyPrefix}-s${key++}`}>{renderSequence(content)}</sup>
          : <sub key={`${keyPrefix}-b${key++}`}>{renderSequence(content)}</sub>);
        continue;
      }

      const atom = parseAtom();
      let superscript: string | null = null;
      let subscript: string | null = null;
      while (source[cursor] === '^' || source[cursor] === '_') {
        const isSuperscript = source[cursor++] === '^';
        const group = source[cursor] === '{' ? readGroup(source, cursor) : null;
        const value = group ? group.content : source[cursor] || '';
        cursor = group ? group.end : Math.min(cursor + 1, source.length);
        if (isSuperscript) superscript = value;
        else subscript = value;
      }
      if (superscript !== null || subscript !== null) {
        nodes.push(
          <span className="ws-math-script" key={`${keyPrefix}-script${key++}`}>
            {atom}
            {superscript !== null && <sup>{renderSequence(superscript)}</sup>}
            {subscript !== null && <sub>{renderSequence(subscript)}</sub>}
          </span>
        );
      } else {
        nodes.push(atom);
      }
    }
    return nodes;
  };

  return renderSequence(tex);
}

export function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*|__)(.+?)\1|`([^`]+)`|\$\$([\s\S]+?)\$\$|\$([^$\n]+)\$/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let n = 0;
  while ((match = pattern.exec(text))) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    if (match[3] !== undefined) {
      nodes.push(<code key={`${keyPrefix}-c${n}`}>{match[3]}</code>);
    } else if (match[2] !== undefined) {
      nodes.push(<strong key={`${keyPrefix}-b${n}`}>{match[2]}</strong>);
    } else if (match[4] !== undefined || match[5] !== undefined) {
      nodes.push(<span className="ws-math" key={`${keyPrefix}-m${n}`}>{renderMath(match[4] ?? match[5], `${keyPrefix}-m${n}`)}</span>);
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

  const isTableRow = (line: string) => line.includes('|') && /^\|?[\s|:-]+\|?$/.test(line.trim()) === false;
  const tableCells = (line: string) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim());
  const isTableDivider = (line: string) => /^\|?[\s:|-]+\|?$/.test(line.trim()) && line.includes('-');

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const raw = lines[lineIndex];
    const line = raw.trimEnd();
    const trimmed = line.trim();
    if (!trimmed) {
      flushBullets();
      flushNumbered();
      continue;
    }
    if (trimmed.startsWith('$$') && trimmed.endsWith('$$') && trimmed.length > 4) {
      flushBullets();
      flushNumbered();
      const equation = trimmed.slice(2, -2).trim();
      blocks.push(
        <div className="ws-equation" key={`equation-${key++}`}>
          {renderMath(equation, `equation-${key}`)}
        </div>
      );
      continue;
    }
    if (/^(---+|___+|\*\*\*+)$/.test(trimmed)) {
      flushBullets();
      flushNumbered();
      blocks.push(<hr key={`hr-${key++}`} />);
      continue;
    }
    const nextLine = lines[lineIndex + 1]?.trim() || '';
    if (isTableRow(trimmed) && isTableDivider(nextLine)) {
      flushBullets();
      flushNumbered();
      const headers = tableCells(trimmed);
      const rows: string[][] = [];
      lineIndex += 2;
      while (lineIndex < lines.length && isTableRow(lines[lineIndex].trim()) && !isTableDivider(lines[lineIndex].trim())) {
        rows.push(tableCells(lines[lineIndex]));
        lineIndex += 1;
      }
      lineIndex -= 1;
      blocks.push(
        <div className="ws-table-wrap" key={`table-${key++}`} role="region" aria-label="Study guide table" tabIndex={0}>
          <table>
            <thead><tr>{headers.map((cell, index) => <th scope="col" key={index}>{renderInline(cell, `th-${key}-${index}`)}</th>)}</tr></thead>
            <tbody>{rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {headers.map((_, columnIndex) => (
                  <td key={columnIndex}>{renderInline(row[columnIndex] || '', `td-${key}-${rowIndex}-${columnIndex}`)}</td>
                ))}
              </tr>
            ))}</tbody>
          </table>
        </div>
      );
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
