import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import type { SandboxEntity, SandboxState } from '@contracts';
import { engine } from '@engine';
import { href, parseHash, replaceHash } from '../router';
import { EXAMPLES } from '../sandbox/examples';
import { emptyState, newEntity, typeResolver, URL_WARN_LENGTH } from '../sandbox/model';
import { SheetGrid } from './SheetGrid';
import { ViewSwitch } from '../sandbox/ViewSwitch';
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
 * The Sandbox's Spreadsheet view (#/sheet): one party's books at a time (tabs across the top) as a wide grid —
 * events down the left, one T (debit | credit) per account across, names, labels, types and balances in the
 * header. Same URL state as the T-accounts view, so a link opens in either. Desktop-first.
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
  const [confirmNew, setConfirmNew] = useState(false);

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
      setStatus('Link copied — it opens in either view.');
    } catch {
      setStatus('Couldn’t access the clipboard — copy the address bar instead.');
    }
  };

  if (!current) return null;

  const typeOf = typeResolver(current);
  const balance = engine.computeBalances(current.rows, typeOf, current.opening);
  const eq = engine.checkEquation(balance, typeOf);
  const sel = clampEntity(ei, state);
  const tabId = (i: number) => `${uid}-tab-${i}`;
  const selectParty = (i: number) => {
    setEi(i);
    writeUrl(state, i);
  };
  const addParty = () => {
    const next = newEntity(state.entities, 'Other party');
    const s2 = { ...state, entities: [...state.entities, next] };
    setBoard((b) => ({ ...b, state: s2 }));
    setEi(s2.entities.length - 1);
    setStatus(`Added ${next.name}.`);
  };
  // Tabs: ←/→ (and Home/End) move between parties, like any tab list.
  const onTabKey = (ev: KeyboardEvent<HTMLButtonElement>) => {
    const last = state.entities.length - 1;
    const to =
      ev.key === 'ArrowRight'
        ? sel === last
          ? 0
          : sel + 1
        : ev.key === 'ArrowLeft'
          ? sel === 0
            ? last
            : sel - 1
          : ev.key === 'Home'
            ? 0
            : ev.key === 'End'
              ? last
              : null;
    if (to === null) return;
    ev.preventDefault();
    selectParty(to);
    document.getElementById(tabId(to))?.focus();
  };
  const unbalanced = current.rows.flatMap((r, i) =>
    r.postings.length && !engine.rowTotals(r).balanced ? [i + 1] : [],
  );

  return (
    <article className="sh">
      <ViewSwitch current="sheet" data={engine.encodeState(state)} entity={sel} />
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

      {board.invalidLink && (
        <p className="sh-notice sh-warn" role="alert">
          That link couldn’t be read (it may be truncated). Starting with an empty sheet instead.
        </p>
      )}
      <p className="sh-notice sh-narrow-note">
        The Spreadsheet view is built for a wide desktop screen. On a small screen, the{' '}
        <a href={href.sandbox(engine.encodeState(state))}>T-accounts view</a> is easier to use.
      </p>

      <div className="sh-toolbar">
        <button type="button" className="btn primary" onClick={copyLink}>
          Copy link
        </button>
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
        {/* Starts a blank sheet in place of this one. Links already copied keep their own copy of the old
            sheet, but this tab's URL is replaced — so confirm first, like the sandbox's New / Clear. */}
        {confirmNew ? (
          <span className="sh-confirm" role="group" aria-label="Confirm new sheet">
            Start over with a blank sheet? This one is cleared (copy its link first to keep it).
            <button
              type="button"
              className="btn"
              onClick={() => {
                setConfirmNew(false);
                replaceBoard(emptyState(), 'Started a new, empty sheet.');
              }}
            >
              Yes, start over
            </button>
            <button type="button" className="btn" onClick={() => setConfirmNew(false)}>
              Cancel
            </button>
          </span>
        ) : (
          <button
            type="button"
            className="btn"
            onClick={() => setConfirmNew(true)}
            title="Clear everything and start a blank sheet"
          >
            New sheet
          </button>
        )}
        <span className="sh-checks">
          <span className={unbalanced.length ? 'is-bad' : 'is-ok'}>
            <span aria-hidden="true">{unbalanced.length ? '✗' : '✓'}</span>{' '}
            {unbalanced.length ? `Unbalanced: row ${unbalanced.join(', ')}` : 'Every row balances'}
          </span>
          <span className={eq.balanced ? 'is-ok' : 'is-bad'}>
            <span aria-hidden="true">{eq.balanced ? '✓' : '✗'}</span> A {eq.balanced ? '=' : '≠'} L
            + E: {formatDollars(eq.assets)} {eq.balanced ? '=' : '≠'}{' '}
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

      {/* One tab per party: whose books the grid shows. */}
      <div className="sh-tabbar">
        <div className="sh-tabs" role="tablist" aria-label="Whose books">
          {state.entities.map((x, i) => (
            <button
              key={x.id}
              id={tabId(i)}
              type="button"
              role="tab"
              className="sh-tab"
              aria-selected={i === sel}
              aria-controls={`${uid}-panel`}
              tabIndex={i === sel ? 0 : -1}
              onClick={() => selectParty(i)}
              onKeyDown={onTabKey}
            >
              {x.name || `Party ${i + 1}`}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="sh-tab-add"
          onClick={addParty}
          title="Add another party’s books"
        >
          + Add party
        </button>
        <label className="sh-rename">
          <span>Name</span>
          <input
            className="sh-entity-name"
            aria-label="Rename this party"
            value={current.name}
            onChange={(e) => setEntity({ ...current, name: e.target.value })}
          />
        </label>
      </div>
      <div id={`${uid}-panel`} role="tabpanel" aria-labelledby={tabId(sel)} className="sh-panel">
        <SheetGrid key={`${epoch}:${current.id}`} entity={current} onChange={setEntity} />
      </div>
    </article>
  );
}
