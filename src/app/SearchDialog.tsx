import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { KIND_LABEL, siteSearch, words, type SearchEntry } from '../search';
import { statusOf, useProgress } from './progress';
import '../styles/search.css';

const SUGGESTIONS = ['debit', 'loan', 'FBO', 'accrual', 'trial balance', '6.3'];

/** Bold the start of each title word that a query word matches. */
function highlight(title: string, query: string): ReactNode {
  const toks = words(query).filter((t) => t !== '§');
  if (toks.length === 0) return title;
  const esc = toks
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .sort((a, b) => b.length - a.length);
  const re = new RegExp(`(^|[^\\p{L}\\p{N}])(${esc.join('|')})`, 'giu');
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of title.matchAll(re)) {
    const start = m.index + m[1]!.length;
    out.push(title.slice(last, start), <mark key={start}>{m[2]}</mark>);
    last = start + m[2]!.length;
  }
  out.push(title.slice(last));
  return out;
}

/**
 * ⌘K / Ctrl-K (or "/") search over titles: problems, sections, "Watch it" animations, callouts, definitions and
 * pages. A combobox: type, ↑/↓ to choose, Enter to go, Esc to close. Focus returns to where it was.
 */
export function SearchDialog({ onClose }: { onClose(): void }) {
  const uid = useId();
  const listId = `${uid}-list`;
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const progress = useProgress();
  const results = useMemo(() => siteSearch().search(q, 30), [q]);
  const cur = Math.min(active, Math.max(results.length - 1, 0));

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    inputRef.current?.focus();
    return () => opener?.focus?.();
  }, []);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-i="${cur}"]`);
    if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'nearest' });
  }, [cur]);

  const go = (e: SearchEntry | undefined) => {
    if (!e) return;
    onClose();
    window.location.assign(e.href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive(results.length ? (cur + 1) % results.length : 0);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(results.length ? (cur - 1 + results.length) % results.length : 0);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      go(results[cur]);
    } else if (e.key === 'Tab') {
      // Two controls (the box and Close): keep focus inside the dialog.
      e.preventDefault();
      const close = (e.currentTarget as HTMLElement).querySelector<HTMLElement>('.search-close');
      (document.activeElement === inputRef.current ? close : inputRef.current)?.focus();
    }
  };

  const optionId = (i: number) => `${uid}-opt-${i}`;
  const trimmed = q.trim();

  return (
    <>
      <div className="search-backdrop" onClick={onClose} />
      <div
        className="search-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        onKeyDown={onKeyDown}
      >
        <div className="search-head">
          <input
            ref={inputRef}
            className="search-input"
            type="search"
            role="combobox"
            aria-expanded={results.length > 0}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={results.length ? optionId(cur) : undefined}
            aria-label="Search problems, sections, definitions"
            placeholder="Search problems, sections, definitions…"
            autoComplete="off"
            spellCheck={false}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
            }}
          />
          <button
            type="button"
            className="search-close"
            onClick={onClose}
            aria-label="Close search (Esc)"
          >
            Esc
          </button>
        </div>

        {trimmed === '' ? (
          <div className="search-empty">
            <p className="note">
              Searches titles: problems, sections, “Watch it” animations, definitions and pages.
            </p>
            <p className="note">
              Try:{' '}
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="search-chip"
                  tabIndex={-1}
                  onClick={() => {
                    setQ(s);
                    inputRef.current?.focus();
                  }}
                >
                  {s}
                </button>
              ))}
            </p>
          </div>
        ) : results.length === 0 ? (
          <p className="search-empty note" role="status">
            Nothing is titled “{trimmed}”. Try a shorter word, or look in{' '}
            <a href="#/definitions">Definitions</a>.
          </p>
        ) : null}

        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label="Results"
          className="search-results"
        >
          {results.map((r, i) => {
            const st = r.problemId ? statusOf(progress, r.problemId) : undefined;
            return (
              <li
                key={r.id}
                id={optionId(i)}
                data-i={i}
                role="option"
                aria-selected={i === cur}
                className={`search-result${i === cur ? ' is-active' : ''}`}
                onMouseMove={() => i !== cur && setActive(i)}
                onClick={() => go(r)}
              >
                <span className={`search-kind is-${r.kind}`}>{KIND_LABEL[r.kind]}</span>
                <span className="search-text">
                  <span className="search-title">
                    {highlight(r.title, q)}
                    {st === 'solved' && (
                      <span className="search-done" title="Solved">
                        {' '}
                        ✓<span className="visually-hidden"> solved</span>
                      </span>
                    )}
                  </span>
                  {r.context && <span className="search-context">{r.context}</span>}
                </span>
              </li>
            );
          })}
        </ul>
        {results.length > 0 && (
          <p className="search-foot note" aria-hidden="true">
            ↑ ↓ to choose · Enter to open · Esc to close
          </p>
        )}
      </div>
    </>
  );
}
