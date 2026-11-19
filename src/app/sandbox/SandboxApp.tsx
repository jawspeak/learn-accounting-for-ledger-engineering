import { useEffect, useId, useRef, useState } from 'react';
import type { SandboxEntity, SandboxState } from '@contracts';
import { entities as contentEntities } from '@content';
import { engine } from '@engine';
import { href, parseHash, replaceHash, type SandboxView } from '../router';
import { SheetGrid } from '../sheet/SheetGrid';
import { ColumnOrderToggle } from './ColumnOrderToggle';
import { EXAMPLES } from './examples';
import { JournalEditor } from './JournalEditor';
import { LedgerView } from './LedgerView';
import {
  applyAccounts,
  applyTemplate,
  duplicateEntity,
  emptyState,
  isManualOrder,
  newEntity,
  persistable,
  setManualOrder,
  summarize,
  URL_WARN_LENGTH,
} from './model';
import { AccountsEditor, EntitySummaryLine, OpeningEditor, TemplatePicker } from './PartyPanels';
import { SafeMarkdown } from './safeMarkdown';
import { ViewSwitch } from './ViewSwitch';
import './sandbox.css';
import '../sheet/sheet.css';

/** Debounce for writing state into the URL. */
export const URL_DEBOUNCE_MS = 300;

interface Board {
  state: SandboxState;
  /** Bumped whenever a whole board is loaded (link, example, clear) so editors remount. */
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
/** What goes in a link: the state without half-written journal lines. */
const encode = (s: SandboxState) => engine.encodeState(persistable(s));

/**
 * The Sandbox: one scenario, three views of the same books (and the same URL state):
 *  - Journal (#/sandbox): enter and read events — one entry per transaction, debits then credits.
 *  - T-accounts (#/taccounts): every party's ledger as real T's, with balance sheets (read-only).
 *  - Grid (#/sheet): one party as a wide spreadsheet — rows = entries, columns = accounts.
 * This shell owns the state, the link, the title / scenario and the party bar; each view renders the books.
 */
export function SandboxApp({
  view,
  data,
  entity,
  at,
}: {
  view: SandboxView;
  data?: string;
  entity: number;
  at?: string;
}) {
  const uid = useId();
  const [board, setBoard] = useState<Board>(() => load(data, 0));
  const { state, epoch } = board;
  const [ei, setEi] = useState(() => clampEntity(entity, board.state));
  /** The encoded state we last wrote to the URL (so our own writes aren't mistaken for navigation). */
  const written = useRef<string | undefined>(data);
  /** State as loaded — not written back until something changes. */
  const loaded = useRef<SandboxState>(board.state);
  const [urlLength, setUrlLength] = useState(0);
  const [status, setStatus] = useState('');
  const [confirmNew, setConfirmNew] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [preview, setPreview] = useState(() => !!board.state.scenario);

  const sel = clampEntity(ei, state);
  const current = state.entities[sel];

  // Another sandbox link (back/forward, pasted, or a view switch before our debounced write) reloads the board.
  useEffect(() => {
    const onHash = () => {
      const r = parseHash(window.location.hash);
      if (r.name !== 'sandbox') return;
      if (r.view !== 'taccounts') setEi((i) => (r.entity !== i ? r.entity : i));
      if (r.data === written.current) return;
      written.current = r.data;
      setBoard((b) => {
        const next = load(r.data, b.epoch + 1);
        loaded.current = next.state;
        setEi(clampEntity(r.entity, next.state));
        setPreview(!!next.state.scenario);
        return next;
      });
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const writeUrl = (s: SandboxState, entityIdx: number): string => {
    const enc = encode(s);
    written.current = enc;
    const h = href.sandboxView(view, enc, view === 'taccounts' ? 0 : entityIdx);
    replaceHash(h);
    setUrlLength(h.length);
    return h;
  };

  // Debounced write of the state into the URL (skipped until something changes).
  useEffect(() => {
    if (state === loaded.current) return;
    const t = window.setTimeout(() => writeUrl(state, sel), URL_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
    // writeUrl is recreated every render; re-running the debounce on each render would never let it fire.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, sel]);

  const update = (fn: (s: SandboxState) => SandboxState) =>
    setBoard((b) => ({ ...b, state: fn(b.state) }));
  const setEntityAt = (i: number, e: SandboxEntity) =>
    update((s) => ({ ...s, entities: s.entities.map((x, j) => (j === i ? e : x)) }));
  const setEntity = (e: SandboxEntity) => setEntityAt(sel, e);

  const replaceBoard = (s: SandboxState, msg: string) => {
    loaded.current = s;
    setBoard((b) => ({ state: s, epoch: b.epoch + 1, invalidLink: false }));
    setEi(0);
    setPreview(!!s.scenario);
    writeUrl(s, 0);
    setStatus(msg);
  };

  const copyLink = async () => {
    const h = writeUrl(state, sel);
    try {
      await navigator.clipboard.writeText(`${window.location.href.split('#')[0]}${h}`);
      setStatus('Link copied — it opens in any of the three views.');
    } catch {
      setStatus('Couldn’t access the clipboard — copy the address bar instead.');
    }
  };

  const selectParty = (i: number) => {
    setEi(i);
    setConfirmRemove(false);
    writeUrl(state, i);
  };
  const addParty = () => {
    const next = newEntity(state.entities, state.entities.length ? 'Other party' : 'You');
    update((s) => ({ ...s, entities: [...s.entities, next] }));
    setEi(state.entities.length);
    setStatus(`Added ${next.name}.`);
  };
  const duplicateParty = () => {
    if (!current) return;
    const copy = duplicateEntity(state.entities, current);
    update((s) => ({
      ...s,
      entities: [...s.entities.slice(0, sel + 1), copy, ...s.entities.slice(sel + 1)],
    }));
    setEi(sel + 1);
    setStatus(`Duplicated ${current.name}.`);
  };
  const removeParty = () => {
    if (!current) return;
    const name = current.name;
    update((s) => {
      const rest = s.entities.filter((_, j) => j !== sel);
      return { ...s, entities: rest.length ? rest : [newEntity([], 'You')] };
    });
    setEi(Math.max(0, sel - 1));
    setConfirmRemove(false);
    setStatus(`Removed ${name}.`);
  };

  const tabId = (i: number) => `${uid}-tab-${i}`;
  // Tabs: ←/→ (and Home/End) move between parties, like any tab list.
  const onTabKey = (ev: React.KeyboardEvent<HTMLButtonElement>) => {
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

  if (!current) return null;
  const data4links = encode(state);
  const onePartyView = view !== 'taccounts';

  return (
    <article className="sbx sh">
      <ViewSwitch current={view} data={data4links} entity={sel} />
      <label htmlFor={`${uid}-title`} className="sr-only">
        Board title
      </label>
      <input
        id={`${uid}-title`}
        className="sbx-title"
        value={state.title ?? ''}
        placeholder="Untitled scenario"
        onChange={(e) => update((s) => ({ ...s, title: e.target.value }))}
      />

      {board.invalidLink && (
        <p className="sbx-notice sbx-notice-warn" role="alert">
          That sandbox link couldn’t be read (it may be truncated or from a newer version). Starting
          with an empty board instead.
        </p>
      )}

      <div className="toolbar sbx-toolbar">
        <button type="button" className="btn primary" onClick={copyLink}>
          Copy link
        </button>
        <label className="sbx-inline">
          Example scenarios:
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
        {confirmNew ? (
          <span className="sbx-confirm" role="group" aria-label="Confirm new board">
            Start over with a blank board? (Copy its link first to keep it.)
            <button
              type="button"
              className="btn"
              onClick={() => {
                setConfirmNew(false);
                replaceBoard(emptyState(), 'Started a new, empty board.');
              }}
            >
              Yes, start over
            </button>
            <button type="button" className="btn" onClick={() => setConfirmNew(false)}>
              Cancel
            </button>
          </span>
        ) : (
          <button type="button" className="btn" onClick={() => setConfirmNew(true)}>
            New board
          </button>
        )}
        <span className="note" role="status" aria-live="polite">
          {status}
        </span>
      </div>
      {urlLength > URL_WARN_LENGTH && (
        <p className="sbx-notice sbx-notice-warn">
          This link is getting long ({urlLength.toLocaleString('en-US')} characters). Some chat
          tools truncate long URLs — consider trimming unused accounts or splitting the scenario.
        </p>
      )}

      <section className="sbx-scenario" aria-label="Scenario">
        <div className="sbx-scenario-head">
          <h2>Scenario</h2>
          <div role="group" aria-label="Scenario view">
            <button
              type="button"
              className="btn"
              aria-pressed={!preview}
              onClick={() => setPreview(false)}
            >
              Edit
            </button>
            <button
              type="button"
              className="btn"
              aria-pressed={preview}
              onClick={() => setPreview(true)}
            >
              Preview
            </button>
          </div>
        </div>
        {preview ? (
          state.scenario.trim() ? (
            <div className="sbx-scenario-preview">
              <SafeMarkdown text={state.scenario} />
            </div>
          ) : (
            <p className="note">No scenario text yet.</p>
          )
        ) : (
          <>
            <label htmlFor={`${uid}-scenario`} className="sr-only">
              Scenario (markdown)
            </label>
            <textarea
              id={`${uid}-scenario`}
              className="sbx-scenario-text"
              rows={4}
              value={state.scenario}
              placeholder="Describe what happens, in markdown. E.g. “You deposit **$100** cash into checking.”"
              onChange={(e) => update((s) => ({ ...s, scenario: e.target.value }))}
            />
          </>
        )}
      </section>

      {onePartyView && (
        <PartyBar
          uid={uid}
          state={state}
          sel={sel}
          tabId={tabId}
          onTabKey={onTabKey}
          selectParty={selectParty}
          addParty={addParty}
          current={current}
          setEntity={setEntity}
          duplicateParty={duplicateParty}
          confirmRemove={confirmRemove}
          setConfirmRemove={setConfirmRemove}
          removeParty={removeParty}
        />
      )}

      {view === 'grid' && (
        <p className="sh-notice sh-narrow-note">
          The Grid is built for a wide desktop screen. On a small screen, the{' '}
          <a href={href.sandbox(data4links, sel)}>Journal</a> is easier to use.
        </p>
      )}

      {onePartyView ? (
        <div id={`${uid}-panel`} role="tabpanel" aria-labelledby={tabId(sel)} className="sh-panel">
          {view === 'journal' ? (
            <>
              <JournalEditor
                key={`${epoch}:${current.id}`}
                entity={current}
                onChange={setEntity}
                at={at}
              />
              <details className="sbx-panel">
                <summary>Accounts ({current.accounts.length})</summary>
                <AccountsEditor
                  entity={current}
                  onAccounts={(accounts) => setEntity(applyAccounts(current, accounts))}
                  onChange={setEntity}
                />
              </details>
              <details className="sbx-panel">
                <summary>
                  Opening balances{current.opening ? ` (${current.opening.lines.length})` : ''}
                </summary>
                <OpeningEditor entity={current} onChange={setEntity} />
              </details>
            </>
          ) : (
            <SheetGrid key={`${epoch}:${current.id}`} entity={current} onChange={setEntity} />
          )}
        </div>
      ) : (
        <LedgerView state={state} data={data4links} onEntityChange={setEntityAt} at={at} />
      )}
    </article>
  );
}

/** Whose books: one tab per party, plus the party's own tools and checks (Journal and Grid views). */
function PartyBar({
  uid,
  state,
  sel,
  tabId,
  onTabKey,
  selectParty,
  addParty,
  current,
  setEntity,
  duplicateParty,
  confirmRemove,
  setConfirmRemove,
  removeParty,
}: {
  uid: string;
  state: SandboxState;
  sel: number;
  tabId(i: number): string;
  onTabKey(ev: React.KeyboardEvent<HTMLButtonElement>): void;
  selectParty(i: number): void;
  addParty(): void;
  current: SandboxEntity;
  setEntity(e: SandboxEntity): void;
  duplicateParty(): void;
  confirmRemove: boolean;
  setConfirmRemove(v: boolean): void;
  removeParty(): void;
}) {
  const summary = summarize(current);
  return (
    <div className="sbx-partybar">
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
      </div>
      <div className="sbx-party-tools">
        <label className="sh-rename">
          <span>Name</span>
          <input
            className="sh-entity-name"
            aria-label="Rename this party"
            value={current.name}
            onChange={(e) => setEntity({ ...current, name: e.target.value })}
          />
        </label>
        <TemplatePicker
          onPick={(id) =>
            contentEntities[id] && setEntity(applyTemplate(current, contentEntities[id]))
          }
        />
        <ColumnOrderToggle
          manual={isManualOrder(current)}
          disabled={current.accounts.length === 0}
          onChange={(m) => setEntity(setManualOrder(current, m))}
        />
        <button type="button" className="btn" onClick={duplicateParty}>
          Duplicate
        </button>
        {confirmRemove ? (
          <span className="sbx-confirm" role="group" aria-label="Confirm remove party">
            Remove {current.name || 'this party'}?
            <button type="button" className="btn" onClick={removeParty}>
              Yes, remove
            </button>
            <button type="button" className="btn" onClick={() => setConfirmRemove(false)}>
              Cancel
            </button>
          </span>
        ) : (
          <button type="button" className="btn" onClick={() => setConfirmRemove(true)}>
            Remove
          </button>
        )}
      </div>
      <EntitySummaryLine summary={summary} rows={current.rows.length} />
    </div>
  );
}
