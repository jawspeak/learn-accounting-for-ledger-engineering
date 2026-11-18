import { useEffect, useState } from 'react';
import { sections } from '@content';
import { glossary } from '../../../content/glossary';
import { ALL_MARKERS_RE, findTerm } from '../glossary';
import { Markdown } from '../Markdown';
import { href } from '../router';

/** Sections whose teaching text (primer, callouts, lens) marks each term, in course order. */
function sectionsUsing(): Map<string, { id: string; label: string; short: string }[]> {
  const out = new Map<string, { id: string; label: string; short: string }[]>();
  for (const s of sections) {
    const text = [s.primer, ...(s.callouts ?? []).map((c) => c.body), s.lens ?? ''].join('\n');
    const seen = new Set<string>();
    for (const m of text.matchAll(ALL_MARKERS_RE)) {
      const t = findTerm(m[2] ?? m[1]!);
      if (!t || seen.has(t.id)) continue;
      seen.add(t.id);
      const label = s.id === 'review' ? s.title : `§${s.number} ${s.title}`;
      const short = s.id === 'review' ? 'Review' : `§${s.number}`;
      out.set(t.id, [...(out.get(t.id) ?? []), { id: s.id, label, short }]);
    }
  }
  return out;
}

const sorted = [...glossary].sort((a, b) => a.term.localeCompare(b.term));

/** All definitions A–Z (VISION: one place to look things up), filterable; `#/definitions/<id>` jumps to one. */
export function DefinitionsPage({ id }: { id?: string }) {
  const [q, setQ] = useState('');
  const used = sectionsUsing();
  const needle = q.trim().toLowerCase();
  const shown = needle
    ? sorted.filter(
        (t) =>
          t.term.toLowerCase().includes(needle) ||
          (t.aliases ?? []).some((a) => a.toLowerCase().includes(needle)) ||
          t.definition.toLowerCase().includes(needle),
      )
    : sorted;

  useEffect(() => {
    if (!id) return;
    const el = document.getElementById(`def-${id}`);
    el?.scrollIntoView({ block: 'start' });
    el?.classList.add('is-target');
    const t = setTimeout(() => el?.classList.remove('is-target'), 2400);
    return () => clearTimeout(t);
  }, [id]);

  // A letter heading above the first term of each letter (only when not filtering).
  const startsLetter = shown.map(
    (t, i) =>
      !needle && (i === 0 || shown[i - 1]!.term[0]!.toUpperCase() !== t.term[0]!.toUpperCase()),
  );
  return (
    <article className="defs">
      <h1>Definitions</h1>
      <p className="note" style={{ maxWidth: '44rem' }}>
        Every term the course defines. In the lessons, a{' '}
        <span className="gloss-sample">dotted term</span> opens its definition when you tap or click
        it.
      </p>
      <label className="defs-filter">
        <span className="sr-only">Filter definitions</span>
        <input
          type="search"
          placeholder="Filter, e.g. “retained” or “contra”…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </label>
      <p className="note" role="status">
        {shown.length === sorted.length
          ? `${sorted.length} terms`
          : `${shown.length} of ${sorted.length} terms`}
      </p>
      <dl className="defs-list">
        {shown.map((t, i) => {
          const first = t.term[0]!.toUpperCase();
          const head = startsLetter[i];
          const where = used.get(t.id) ?? [];
          return (
            <div key={t.id} className="defs-item" id={`def-${t.id}`}>
              {head && (
                <p className="defs-letter" aria-hidden="true">
                  {first}
                </p>
              )}
              <dt>
                <a className="defs-term" href={href.definitions(t.id)}>
                  {t.term}
                </a>
                {t.aliases && t.aliases.length > 0 && (
                  <span className="defs-aka">
                    {' '}
                    also:{' '}
                    {t.aliases
                      .filter((a) => a.length > 3 || a === a.toUpperCase())
                      .slice(0, 3)
                      .join(', ')}
                  </span>
                )}
              </dt>
              <dd>
                <Markdown text={t.definition} />
                {where.length > 0 && (
                  <p className="defs-where">
                    Introduced in <a href={href.section(where[0]!.id)}>{where[0]!.label}</a>
                    {where.length > 1 && (
                      <>
                        {' · also '}
                        {where.slice(1, 4).map((w, i) => (
                          <span key={w.id}>
                            {i > 0 && ', '}
                            <a href={href.section(w.id)} title={w.label}>
                              {w.short}
                            </a>
                          </span>
                        ))}
                        {where.length > 4 && ` +${where.length - 4} more`}
                      </>
                    )}
                  </p>
                )}
              </dd>
            </div>
          );
        })}
      </dl>
      {shown.length === 0 && <p>No matching definitions.</p>}
    </article>
  );
}
