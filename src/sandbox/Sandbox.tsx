import { useId, useState, type ReactNode } from 'react';
import type { Account, SandboxEntity, SandboxState } from '@contracts';
import { SheetGrid } from './grid/SheetGrid';
import { ColumnOrderToggle } from './ColumnOrderToggle';
import { JournalEditor } from './JournalEditor';
import { LedgerView } from './LedgerView';
import {
  applyTemplate,
  duplicateEntity,
  emptyState,
  isManualOrder,
  newEntity,
  setManualOrder,
  summarize,
} from './model';
import { SandboxLink, SandboxNavProvider, type SandboxNav, type SandboxView } from './nav';
import { AccountsEditor, EntitySummaryLine, OpeningEditor, TemplatePicker } from './PartyPanels';
import { SafeMarkdown } from './safeMarkdown';
import { ViewSwitch } from './ViewSwitch';
import './sandbox.css';
import './grid/sheet.css';

/** A starting chart of accounts ("Start from a template"). */
export interface SandboxTemplate {
  id: string;
  name: string;
  accounts: Account[];
}

/** A ready-made scenario ("Load an example…"). */
export interface SandboxExample {
  id: string;
  label: string;
  build(): SandboxState;
}

export interface SandboxProps extends SandboxNav {
  /** The books — controlled: every edit comes back through `onChange`. */
  state: SandboxState;
  onChange(next: SandboxState): void;
  view: SandboxView;
  /** Which party the Journal and Grid show (index into `state.entities`). */
  party: number;
  onPartyChange(party: number): void;
  /** An element to scroll to on arrival, e.g. "entry-3". */
  at?: string;
  /** Charts of accounts offered by "Start from a template" (none: the picker is hidden). */
  templates?: SandboxTemplate[];
  /** Scenarios offered by "Load an example…" (none: the menu is hidden). */
  examples?: SandboxExample[];
  /** Extra toolbar content from the host, e.g. a "Copy link" button. */
  toolbar?: ReactNode;
  /** A notice from the host above the books, e.g. "that link couldn't be read". */
  notice?: ReactNode;
}

const clampEntity = (i: number, s: SandboxState) => Math.max(0, Math.min(i, s.entities.length - 1));

/**
 * The Sandbox: one scenario, three views of the same books.
 *  - Journal: enter and read events — one entry per transaction, debits then credits.
 *  - T-accounts: every party's ledger as real T's, with balance sheets (read-only).
 *  - Grid: one party as a wide spreadsheet — rows = entries, columns = accounts.
 * A controlled component: the host owns the state and where it's saved (a URL, storage, a backend) and
 * how in-Sandbox links resolve (`linkTo` / `onNavigate`). Course-free: templates and examples are props.
 */
export function Sandbox({
  state,
  onChange,
  view,
  party,
  onPartyChange,
  at,
  templates,
  examples,
  toolbar,
  notice,
  linkTo,
  onNavigate,
}: SandboxProps) {
  const uid = useId();
  /** Bumped when a whole new board is loaded here (example, New), so the editors remount. */
  const [epoch, setEpoch] = useState(0);
  const [status, setStatus] = useState('');
  const [confirmNew, setConfirmNew] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [preview, setPreview] = useState(() => !!state.scenario);

  const sel = clampEntity(party, state);
  const current = state.entities[sel];

  const update = (fn: (s: SandboxState) => SandboxState) => onChange(fn(state));
  const setEntityAt = (i: number, e: SandboxEntity) =>
    update((s) => ({ ...s, entities: s.entities.map((x, j) => (j === i ? e : x)) }));
  const setEntity = (e: SandboxEntity) => setEntityAt(sel, e);

  const replaceBoard = (s: SandboxState, msg: string) => {
    onChange(s);
    onPartyChange(0);
    setEpoch((n) => n + 1);
    setPreview(!!s.scenario);
    setStatus(msg);
  };

  const selectParty = (i: number) => {
    onPartyChange(i);
    setConfirmRemove(false);
  };
  const addParty = () => {
    const next = newEntity(state.entities, state.entities.length ? 'Other party' : 'You');
    update((s) => ({ ...s, entities: [...s.entities, next] }));
    onPartyChange(state.entities.length);
    setStatus(`Added ${next.name}.`);
  };
  const duplicateParty = () => {
    if (!current) return;
    const copy = duplicateEntity(state.entities, current);
    update((s) => ({
      ...s,
      entities: [...s.entities.slice(0, sel + 1), copy, ...s.entities.slice(sel + 1)],
    }));
    onPartyChange(sel + 1);
    setStatus(`Duplicated ${current.name}.`);
  };
  const removeParty = () => {
    if (!current) return;
    const name = current.name;
    update((s) => {
      const rest = s.entities.filter((_, j) => j !== sel);
      return { ...s, entities: rest.length ? rest : [newEntity([], 'You')] };
    });
    onPartyChange(Math.max(0, sel - 1));
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
  const onePartyView = view !== 'taccounts';

  return (
    <SandboxNavProvider value={{ linkTo, onNavigate }}>
      <article className="sbx sh">
        <ViewSwitch current={view} party={sel} />
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

        {notice}

        <div className="toolbar sbx-toolbar">
          {toolbar}
          {examples && examples.length > 0 && (
            <label className="sbx-inline">
              Example scenarios:
              <select
                value=""
                onChange={(e) => {
                  const ex = examples.find((x) => x.id === e.target.value);
                  if (ex) replaceBoard(ex.build(), `Loaded example: ${ex.label}.`);
                }}
              >
                <option value="">Load an example…</option>
                {examples.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.label}
                  </option>
                ))}
              </select>
            </label>
          )}
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
            templates={templates}
            duplicateParty={duplicateParty}
            confirmRemove={confirmRemove}
            setConfirmRemove={setConfirmRemove}
            removeParty={removeParty}
            setStatus={setStatus}
          />
        )}

        {view === 'grid' && (
          <p className="sh-notice sh-narrow-note">
            The Grid is built for a wide desktop screen. On a small screen, the{' '}
            <SandboxLink to={{ view: 'journal', party: sel }}>Journal</SandboxLink> is easier to
            use.
          </p>
        )}

        {onePartyView ? (
          <div
            id={`${uid}-panel`}
            role="tabpanel"
            aria-labelledby={tabId(sel)}
            className="sh-panel"
          >
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
                  <AccountsEditor entity={current} onChange={setEntity} />
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
          <LedgerView state={state} onEntityChange={setEntityAt} at={at} />
        )}
      </article>
    </SandboxNavProvider>
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
  templates,
  duplicateParty,
  confirmRemove,
  setConfirmRemove,
  removeParty,
  setStatus,
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
  templates?: SandboxTemplate[];
  duplicateParty(): void;
  confirmRemove: boolean;
  setConfirmRemove(v: boolean): void;
  removeParty(): void;
  setStatus(msg: string): void;
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
        {templates && templates.length > 0 && (
          <TemplatePicker
            templates={templates}
            onPick={(t) => {
              const next = applyTemplate(current, t);
              const added = next.accounts.length - current.accounts.length;
              setEntity(next);
              // A template is a chart of accounts, not a scenario: say so, since the Journal and T-accounts
              // show nothing new until an entry uses the accounts.
              setStatus(
                added
                  ? `Added ${added} account${added > 1 ? 's' : ''} from ${t.name} — choose them on a journal line (no entries are added; “Load an example” has full scenarios).`
                  : `${current.name} already has every account in ${t.name}.`,
              );
            }}
          />
        )}
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
