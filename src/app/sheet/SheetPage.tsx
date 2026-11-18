import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import type { SandboxEntity, SandboxState } from '@contracts';
import { engine } from '@engine';
import { href, parseHash, replaceHash } from '../router';
import { EXAMPLES } from '../sandbox/examples';
import { emptyState, newEntity, typeResolver, URL_WARN_LENGTH } from '../sandbox/model';
import { SheetGrid } from './SheetGrid';
import { sortCanonical } from './model';
import { formatDollars } from '../../components/builder/model';
import './sheet.css';

const URL_DEBOUNCE_MS = 300;

interface Board {
  state: SandboxState;
  /** Bumped whenever a whole board is loaded (link, example, clear). */
  epoch: number;
  invalidLink: boolean;
}

function load(data: string | undefined, epoch: number): Board {
  if (!data) return { state: emptyState(), epoch, invalidLink: false };
  const state = engine.decodeSandbox(data);
  return state
    ? { state, epoch, invalidLink: false }
    : { state: emptyState(), epoch, invalidLink: true };
}

const clampEntity = (i: number, s: SandboxState) => Math.max(0, Math.min(i, s.entities.length - 1));

/**
 * Spreadsheet view of a sandbox board (#/sheet): one entity's books as a wide grid — events down the left,
 * one T (Dr | Cr) per account across, account attributes and balances in the header. Same URL state as the
 * Sandbox, so a link opens in either view. Desktop-first.
 */
export function SheetPage({ data, entity }: { data?: string; entity: number }) {
  const uid = useId();
  const [board, setBoard] = useState<Board>(() => load(data, 0));
  const { state, epoch } = board;
  const [ei, setEi] = useState(() => clampEntity(entity, board.state));
  const written = useRef<string | undefined>(data);
  const loaded = useRef<SandboxState>(board.state);
  const [urlLength, setUrlLength] = useState(0);
  const [status, setStatus] = useState('');
  const [newBooks, setNewBooks] = useState(false);

  const current = state.entities[clampEntity(ei, state)];

  // Another sheet link (back/forward, pasted) reloads the board.
  useEffect(() => {
    const onHash = () => {
      const r = parseHash(window.location.hash);
      if (r.name !== 'sheet' || r.data === written.current) return;
      written.current = r.data;
      setBoard((b) => {
        const next = load(r.data, b.epoch + 1);
        loaded.current = next.state;
        setEi(clampEntity(r.entity, next.state));
        return next;
      });
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const writeUrl = (s: SandboxState, entityIdx: number): string => {
    const enc = engine.encodeState(s);
    written.current = enc;
    const h = href.sheet(enc, entityIdx);
    replaceHash(h);
    setUrlLength(h.length);
    return h;
  };

  // Debounced write of the state into the URL (skipped until something changes).
  useEffect(() => {
    if (state === loaded.current) return;
    const t = window.setTimeout(() => writeUrl(state, ei), URL_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [state, ei]);

  const update = (fn: (s: SandboxState) => SandboxState) =>
    setBoard((b) => ({ ...b, state: fn(b.state) }));
  const setEntity = (e: SandboxEntity) =>
    update((s) => ({
      ...s,
      entities: s.entities.map((x, j) => (j === clampEntity(ei, s) ? e : x)),
    }));

  const replaceBoard = (s: SandboxState, msg: string) => {
    loaded.current = s;
    setBoard((b) => ({ state: s, epoch: b.epoch + 1, invalidLink: false }));
    setEi(0);
    writeUrl(s, 0);
    setStatus(msg);
  };

  const copyLink = async () => {
    const h = writeUrl(state, ei);
    try {
      await navigator.clipboard.writeText(`${window.location.href.split('#')[0]}${h}`);
      setStatus('Link copied — it opens in the sandbox too.');
    } catch {
      setStatus('Couldn’t access the clipboard — copy the address bar instead.');
    }
  };

  if (!current) return null;

  const typeOf = typeResolver(current);
  const posted = engine.computeBalances(
    current.rows.filter((r) => !r.pending),
    typeOf,
    current.opening,
  );
  const eq = engine.checkEquation(posted, typeOf);
  const unbalanced = current.rows.flatMap((r, i) =>
    r.postings.length && !engine.rowTotals(r).balanced ? [i + 1] : [],
  );

  return (
    <article className="sh">
      <div className="sh-top">
        <label htmlFor={`${uid}-title`} className="sr-only">
          Scenario title
        </label>
        <input
          id={`${uid}-title`}
          className="sh-title"
          size={Math.min(60, Math.max(14, (state.title ?? '').length + 1))}
          value={state.title ?? ''}
          placeholder="Untitled scenario"
          onChange={(e) => update((s) => ({ ...s, title: e.target.value }))}
        />
        <div className="sh-books" role="group" aria-label="Whose books">
          <label>
            Books of{' '}
            <select
              value={clampEntity(ei, state)}
              onChange={(e) => {
                const i = Number(e.target.value);
                setEi(i);
                writeUrl(state, i);
              }}
            >
              {state.entities.map((x, i) => (
                <option key={x.id} value={i}>
                  {x.name || `Entity ${i + 1}`}
                </option>
              ))}
            </select>
          </label>
          <input
            className="sh-entity-name"
            aria-label="Rename these books"
            value={current.name}
            onChange={(e) => setEntity({ ...current, name: e.target.value })}
          />
          {newBooks ? (
            <span className="sh-confirm">
              Add another set of books (the other party)?
              <button
                type="button"
                className="btn"
                onClick={() => {
                  const next = newEntity(state.entities, 'Other party');
                  update((s) => ({ ...s, entities: [...s.entities, next] }));
                  setEi(state.entities.length);
                  setNewBooks(false);
                }}
              >
                Add
              </button>
              <button type="button" className="btn" onClick={() => setNewBooks(false)}>
                Cancel
              </button>
            </span>
          ) : (
            <button type="button" className="btn" onClick={() => setNewBooks(true)}>
              + Books
            </button>
          )}
        </div>
      </div>

      {board.invalidLink && (
        <p className="sh-notice sh-warn" role="alert">
          That link couldn’t be read (it may be truncated). Starting with an empty sheet instead.
        </p>
      )}
      <p className="sh-notice sh-narrow-note">
        The spreadsheet view is built for a wide desktop screen. On a small screen, the{' '}
        <a href={href.sandbox(engine.encodeState(state))}>sandbox</a> is easier to use.
      </p>

      <div className="sh-toolbar">
        <button type="button" className="btn primary" onClick={copyLink}>
          Copy link
        </button>
        <a className="btn" href={href.sandbox(engine.encodeState(state))}>
          Open in Sandbox
        </a>
        <label className="sh-inline">
          <span className="sr-only">Load an example</span>
          <select
            value=""
            onChange={(e) => {
              const ex = EXAMPLES.find((x) => x.id === e.target.value);
              if (ex) replaceBoard(ex.build(), `Loaded example: ${ex.label}.`);
            }}
          >
            <option value="">Load an example…</option>
            {EXAMPLES.map((x) => (
              <option key={x.id} value={x.id}>
                {x.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="btn"
          title="Reorder the columns as Assets ‖ = ‖ Liabilities │ Equity"
          onClick={() => setEntity(sortCanonical(current))}
        >
          Sort A = L + E
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => replaceBoard(emptyState(), 'Started a new, empty sheet.')}
        >
          New sheet
        </button>
        <span className="sh-checks">
          <span className={unbalanced.length ? 'is-bad' : 'is-ok'}>
            <span aria-hidden="true">{unbalanced.length ? '✗' : '✓'}</span>{' '}
            {unbalanced.length ? `Unbalanced: row ${unbalanced.join(', ')}` : 'Every row balances'}
          </span>
          <span className={eq.balanced ? 'is-ok' : 'is-bad'}>
            <span aria-hidden="true">{eq.balanced ? '✓' : '✗'}</span> A {eq.balanced ? '=' : '≠'} L
            + E (posted): {formatDollars(eq.assets)} {eq.balanced ? '=' : '≠'}{' '}
            {formatDollars(eq.liabilities)} + {formatDollars(eq.equity)}
          </span>
        </span>
        <span className="note" role="status" aria-live="polite">
          {status}
        </span>
      </div>
      {urlLength > URL_WARN_LENGTH && (
        <p className="sh-notice sh-warn">
          This link is getting long ({urlLength.toLocaleString('en-US')} characters); some chat
          tools truncate long URLs.
        </p>
      )}

      <details className="sh-scenario">
        <summary>Scenario notes</summary>
        <textarea
          aria-label="Scenario notes (markdown)"
          rows={4}
          value={state.scenario}
          placeholder="What happens, in words. E.g. “Employer Foo runs $2,000 of payroll; we charge a $20 fee.”"
          onChange={(e) => update((s) => ({ ...s, scenario: e.target.value }))}
          onKeyDown={(e: KeyboardEvent) => e.stopPropagation()}
        />
      </details>

      <SheetGrid key={`${epoch}:${current.id}`} entity={current} onChange={setEntity} />
    </article>
  );
}
