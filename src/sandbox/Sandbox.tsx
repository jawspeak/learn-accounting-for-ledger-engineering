import { useId, useRef, useState, type ReactNode } from 'react';
import { schemas, type EntityBooks, type SandboxState } from '@contracts';
import { ChartOfAccounts } from './ChartOfAccounts';
import { ColumnOrderToggle } from './ColumnOrderToggle';
import { SheetGrid } from './grid/SheetGrid';
import { JournalEditor } from './JournalEditor';
import { LedgerView } from './LedgerView';
import {
  addEntityTo,
  addScenarioTo,
  allBooks,
  booksOf,
  duplicateEntityIn,
  duplicateScenarioIn,
  emptyState,
  isManualOrder,
  moveScenario,
  persistable,
  removeEntityFrom,
  removeScenarioFrom,
  setManualOrder,
  slugify,
  summarize,
  updateScenario,
  usageByScenario,
  withBooks,
} from './model';
import { SandboxLink, SandboxNavProvider, type SandboxNav, type SandboxView } from './nav';
import { AccountsEditor, AccountUsage, EntitySummaryLine, OpeningEditor } from './EntityPanels';
import { SafeMarkdown } from './safeMarkdown';
import { ViewSwitch } from './ViewSwitch';
import './sandbox.css';
import './grid/sheet.css';

/** A ready-made set of entities and scenarios ("Example scenarios"). Loading one replaces everything. */
export interface SandboxExample {
  id: string;
  label: string;
  build(): SandboxState;
}

export interface SandboxProps extends SandboxNav {
  /** Everything — controlled: every edit comes back through `onChange`. */
  state: SandboxState;
  onChange(next: SandboxState): void;
  view: SandboxView;
  /** Which scenario is shown (index into `state.scenarios`). */
  scenario: number;
  onScenarioSelect(scenario: number): void;
  /** Which entity the Journal and Grid show (index into `state.entities`). */
  entity: number;
  onEntitySelect(entity: number): void;
  /** An element to scroll to on arrival, e.g. "entry-3". */
  at?: string;
  /** Offered by "Example scenarios" (none: the menu is hidden). */
  examples?: SandboxExample[];
  /** Extra toolbar content from the host, e.g. a "Copy link" button. */
  toolbar?: ReactNode;
  /** A notice from the host above the books, e.g. "that link couldn't be read". */
  notice?: ReactNode;
}

const clamp = (i: number, n: number) => Math.max(0, Math.min(i, n - 1));

/** Something about to replace everything, waiting for "Yes". */
interface Pending {
  question: string;
  build(): SandboxState;
  done: string;
}

/**
 * The Sandbox: entities (each with its own chart of accounts, shared by every scenario) and scenarios (each with
 * its own story, entries and opening balances), in three views of the current scenario's books:
 *  - Journal: enter and read entries — one per business event, debits then credits.
 *  - T-accounts: every entity's ledger as real T's, with balance sheets (read-only).
 *  - Grid: one entity as a wide spreadsheet — rows = entries, columns = accounts.
 * The chart of accounts across all scenarios is one toggle away: the point is to find the accounts that model
 * every scenario. A controlled component: the host owns the state and where it's saved (a URL, storage, a
 * backend) and how in-Sandbox links resolve (`linkTo` / `onNavigate`). Course-free: examples are a prop.
 */
export function Sandbox({
  state,
  onChange,
  view,
  scenario,
  onScenarioSelect,
  entity,
  onEntitySelect,
  at,
  examples,
  toolbar,
  notice,
  linkTo,
  onNavigate,
}: SandboxProps) {
  const uid = useId();
  /** Bumped when everything is replaced here (example, import, New), so the editors remount. */
  const [epoch, setEpoch] = useState(0);
  const [status, setStatus] = useState('');
  const [pending, setPending] = useState<Pending | null>(null);
  const [confirmRemoveEntity, setConfirmRemoveEntity] = useState(false);
  const [confirmRemoveScenario, setConfirmRemoveScenario] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const si = clamp(scenario, state.scenarios.length);
  const ei = clamp(entity, state.entities.length);
  const sc = state.scenarios[si];
  const current = state.entities[ei];
  if (!sc || !current) return null;
  const books = booksOf(state, si, ei);

  const update = (fn: (s: SandboxState) => SandboxState) => onChange(fn(state));
  const setBooksAt = (i: number, b: EntityBooks) => onChange(withBooks(state, si, i, b));
  const setBooks = (b: EntityBooks) => setBooksAt(ei, b);

  const replaceAll = (s: SandboxState, msg: string) => {
    onChange(s);
    onScenarioSelect(0);
    onEntitySelect(0);
    setEpoch((n) => n + 1);
    setStatus(msg);
    setPending(null);
  };

  // ---- entities ----
  const selectEntity = (i: number) => {
    onEntitySelect(i);
    setConfirmRemoveEntity(false);
  };
  const addEntity = () => {
    const { state: next, index } = addEntityTo(state, 'New entity');
    onChange(next);
    onEntitySelect(index);
    setStatus('Added an entity — name it.');
  };
  const duplicateEntity = () => {
    onChange(duplicateEntityIn(state, ei));
    onEntitySelect(ei + 1);
    setStatus(`Duplicated ${current.name}, with its books in every scenario.`);
  };
  const removeEntity = () => {
    onChange(removeEntityFrom(state, ei));
    onEntitySelect(Math.max(0, ei - 1));
    setConfirmRemoveEntity(false);
    setStatus(`Removed ${current.name}.`);
  };

  // ---- scenarios ----
  const selectScenario = (i: number) => {
    onScenarioSelect(i);
    setConfirmRemoveScenario(false);
  };
  const addScenario = () => {
    const { state: next, index } = addScenarioTo(state);
    onChange(next);
    onScenarioSelect(index);
    setStatus(
      'Added a scenario — the entities and their accounts carry over; the books start empty.',
    );
  };
  const duplicateScenario = () => {
    onChange(duplicateScenarioIn(state, si));
    onScenarioSelect(si + 1);
    setStatus(`Duplicated ${sc.title || 'the scenario'}.`);
  };
  const removeScenario = () => {
    onChange(removeScenarioFrom(state, si));
    onScenarioSelect(Math.max(0, si - 1));
    setConfirmRemoveScenario(false);
    setStatus(`Removed ${sc.title || 'the scenario'}.`);
  };

  // ---- files ----
  const exportFile = () => {
    const json = JSON.stringify(persistable(state), null, 2);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    a.download = `${slugify(state.title || 'sandbox', 'sandbox')}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setStatus(`Exported ${a.download}.`);
  };
  const importFile = async (file: File) => {
    try {
      const parsed = schemas.sandboxStateSchema.safeParse(JSON.parse(await file.text()));
      if (!parsed.success) throw new Error('not a sandbox file');
      const s = parsed.data as SandboxState;
      setPending({
        question: `Replace everything in the Sandbox with ${file.name} (${s.scenarios.length} scenario${s.scenarios.length > 1 ? 's' : ''})?`,
        build: () => s,
        done: `Imported ${file.name}.`,
      });
    } catch {
      setStatus(`Couldn’t read ${file.name} — it isn’t a Sandbox export.`);
    }
  };

  const oneEntityView = view !== 'taccounts';
  const usage: AccountUsage = (accountId) => usageByScenario(state, current.id, accountId);

  return (
    <SandboxNavProvider value={{ linkTo, onNavigate }}>
      <article className="sbx sh">
        <ViewSwitch current={view} entity={ei} />
        <label htmlFor={`${uid}-title`} className="sr-only">
          Sandbox title
        </label>
        <input
          id={`${uid}-title`}
          className="sbx-title"
          value={state.title ?? ''}
          placeholder="Untitled sandbox"
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
                  if (ex)
                    setPending({
                      question: `Replace everything in the Sandbox with the “${ex.label}” example? (Copy the link or export first to keep your work.)`,
                      build: ex.build,
                      done: `Loaded example: ${ex.label}.`,
                    });
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
          <button
            type="button"
            className="btn"
            onClick={() =>
              setPending({
                question:
                  'Start over with an empty Sandbox? (Copy the link or export first to keep your work.)',
                build: emptyState,
                done: 'Started a new, empty Sandbox.',
              })
            }
          >
            New
          </button>
          <button type="button" className="btn" onClick={exportFile} title="Download a .json file">
            Export
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => fileRef.current?.click()}
            title="Open a .json file exported from the Sandbox"
          >
            Import
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            tabIndex={-1}
            aria-label="Import a Sandbox file"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importFile(f);
              e.target.value = '';
            }}
          />
          <span className="note" role="status" aria-live="polite">
            {status}
          </span>
        </div>
        {pending && (
          <p className="sbx-confirm sbx-pending" role="group" aria-label="Confirm replace">
            {pending.question}
            <button
              type="button"
              className="btn"
              onClick={() => replaceAll(pending.build(), pending.done)}
            >
              Yes, replace
            </button>
            <button type="button" className="btn" onClick={() => setPending(null)}>
              Cancel
            </button>
          </p>
        )}

        {/* ---- Scenarios ---- */}
        <section className="sbx-scenarios" aria-label="Scenarios">
          <Tabs
            label="Scenarios"
            heading="Scenarios"
            names={state.scenarios.map((x, i) => x.title || `Scenario ${i + 1}`)}
            sel={si}
            onSelect={selectScenario}
            idOf={(i) => `${uid}-sc-${i}`}
            panelId={`${uid}-sc-panel`}
            addLabel="+ Add scenario"
            addTitle="A new scenario: the same entities and accounts, empty books"
            onAdd={addScenario}
          />
          <div
            id={`${uid}-sc-panel`}
            role="tabpanel"
            aria-labelledby={`${uid}-sc-${si}`}
            className="sbx-scenario"
          >
            <div className="sbx-scenario-head">
              <label className="sh-rename">
                <span>Scenario</span>
                <input
                  aria-label="Scenario title"
                  value={sc.title}
                  placeholder={`Scenario ${si + 1}`}
                  onChange={(e) => onChange(updateScenario(state, si, { title: e.target.value }))}
                />
              </label>
              <span className="sbx-tools">
                <button
                  type="button"
                  className="btn"
                  aria-label="Move scenario left"
                  title="Earlier"
                  disabled={si === 0}
                  onClick={() => {
                    onChange(moveScenario(state, si, -1));
                    onScenarioSelect(si - 1);
                  }}
                >
                  <span aria-hidden="true">←</span>
                </button>
                <button
                  type="button"
                  className="btn"
                  aria-label="Move scenario right"
                  title="Later"
                  disabled={si === state.scenarios.length - 1}
                  onClick={() => {
                    onChange(moveScenario(state, si, 1));
                    onScenarioSelect(si + 1);
                  }}
                >
                  <span aria-hidden="true">→</span>
                </button>
                <button
                  type="button"
                  className="btn"
                  aria-label="Duplicate scenario"
                  onClick={duplicateScenario}
                >
                  Duplicate
                </button>
                {confirmRemoveScenario ? (
                  <span className="sbx-confirm" role="group" aria-label="Confirm remove scenario">
                    Remove {sc.title || 'this scenario'} and its entries?
                    <button type="button" className="btn" onClick={removeScenario}>
                      Yes, remove
                    </button>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => setConfirmRemoveScenario(false)}
                    >
                      Cancel
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    className="btn"
                    aria-label="Remove scenario"
                    onClick={() => setConfirmRemoveScenario(true)}
                  >
                    Remove
                  </button>
                )}
              </span>
            </div>
            <ScenarioText
              key={`${epoch}:${sc.id}`}
              uid={uid}
              text={sc.text}
              onText={(text) => onChange(updateScenario(state, si, { text }))}
            />
          </div>
        </section>

        <details className="sbx-panel sbx-coa">
          <summary>
            Chart of accounts ({state.entities.reduce((n, e) => n + e.accounts.length, 0)} accounts,{' '}
            {state.entities.length} entit{state.entities.length > 1 ? 'ies' : 'y'})
          </summary>
          <ChartOfAccounts state={state} scenario={si} />
        </details>

        {/* ---- Entities and the views ---- */}
        {oneEntityView && (
          <EntityBar
            uid={uid}
            state={state}
            sel={ei}
            selectEntity={selectEntity}
            addEntity={addEntity}
            books={books}
            setBooks={setBooks}
            duplicateEntity={duplicateEntity}
            confirmRemove={confirmRemoveEntity}
            setConfirmRemove={setConfirmRemoveEntity}
            removeEntity={removeEntity}
            scenarioCount={state.scenarios.length}
          />
        )}

        {view === 'grid' && (
          <p className="sh-notice sh-narrow-note">
            The Grid is built for a wide desktop screen. On a small screen, the{' '}
            <SandboxLink to={{ view: 'journal', entity: ei }}>Journal</SandboxLink> is easier to
            use.
          </p>
        )}

        <AccountUsage.Provider value={usage}>
          {oneEntityView ? (
            <div
              id={`${uid}-panel`}
              role="tabpanel"
              aria-labelledby={`${uid}-tab-${ei}`}
              className="sh-panel"
            >
              {view === 'journal' ? (
                <>
                  <JournalEditor
                    key={`${epoch}:${sc.id}:${current.id}`}
                    entity={books}
                    onChange={setBooks}
                    at={at}
                  />
                  <details className="sbx-panel">
                    <summary>Accounts ({current.accounts.length})</summary>
                    <AccountsEditor entity={books} onChange={setBooks} />
                  </details>
                  <details className="sbx-panel">
                    <summary>
                      Opening balances in this scenario
                      {books.opening ? ` (${books.opening.lines.length})` : ''}
                    </summary>
                    <OpeningEditor entity={books} onChange={setBooks} />
                  </details>
                </>
              ) : (
                <SheetGrid
                  key={`${epoch}:${sc.id}:${current.id}`}
                  entity={books}
                  onChange={setBooks}
                />
              )}
            </div>
          ) : (
            <LedgerView books={allBooks(state, si)} onBooksChange={setBooksAt} at={at} />
          )}
        </AccountUsage.Provider>
      </article>
    </SandboxNavProvider>
  );
}

/** The scenario's story, in markdown: edit, or read it rendered. */
function ScenarioText({
  uid,
  text,
  onText,
}: {
  uid: string;
  text: string;
  onText(t: string): void;
}) {
  const [preview, setPreview] = useState(() => !!text.trim());
  return (
    <div className="sbx-scenario-body">
      <div role="group" aria-label="Scenario text view" className="sbx-scenario-modes">
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
      {preview ? (
        text.trim() ? (
          <div className="sbx-scenario-preview">
            <SafeMarkdown text={text} />
          </div>
        ) : (
          <p className="note">No scenario text yet.</p>
        )
      ) : (
        <>
          <label htmlFor={`${uid}-scenario`} className="sr-only">
            Scenario text (markdown)
          </label>
          <textarea
            id={`${uid}-scenario`}
            className="sbx-scenario-text"
            rows={4}
            value={text}
            placeholder="Describe what happens, in markdown. E.g. “You deposit **$100** cash into checking.”"
            onChange={(e) => onText(e.target.value)}
          />
        </>
      )}
    </div>
  );
}

/** A tab list (scenarios, entities): click, or ←/→ and Home/End, like any tab list; plus an "add" button. */
function Tabs({
  label,
  heading,
  names,
  sel,
  onSelect,
  idOf,
  panelId,
  addLabel,
  addTitle,
  onAdd,
}: {
  label: string;
  heading?: string;
  names: string[];
  sel: number;
  onSelect(i: number): void;
  idOf(i: number): string;
  panelId: string;
  addLabel: string;
  addTitle: string;
  onAdd(): void;
}) {
  const onKey = (ev: React.KeyboardEvent<HTMLButtonElement>) => {
    const last = names.length - 1;
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
    onSelect(to);
    document.getElementById(idOf(to))?.focus();
  };
  return (
    <div className="sh-tabbar">
      {heading && <h2 className="sbx-tabs-heading">{heading}</h2>}
      <div className="sh-tabs" role="tablist" aria-label={label}>
        {names.map((name, i) => (
          <button
            key={i}
            id={idOf(i)}
            type="button"
            role="tab"
            className="sh-tab"
            aria-selected={i === sel}
            aria-controls={panelId}
            tabIndex={i === sel ? 0 : -1}
            onClick={() => onSelect(i)}
            onKeyDown={onKey}
          >
            {name}
          </button>
        ))}
      </div>
      <button type="button" className="sh-tab-add" onClick={onAdd} title={addTitle}>
        {addLabel}
      </button>
    </div>
  );
}

/** Whose books: one tab per entity, plus the entity's own tools and checks (Journal and Grid views). */
function EntityBar({
  uid,
  state,
  sel,
  selectEntity,
  addEntity,
  books,
  setBooks,
  duplicateEntity,
  confirmRemove,
  setConfirmRemove,
  removeEntity,
  scenarioCount,
}: {
  uid: string;
  state: SandboxState;
  sel: number;
  selectEntity(i: number): void;
  addEntity(): void;
  books: EntityBooks;
  setBooks(b: EntityBooks): void;
  duplicateEntity(): void;
  confirmRemove: boolean;
  setConfirmRemove(v: boolean): void;
  removeEntity(): void;
  scenarioCount: number;
}) {
  const summary = summarize(books);
  return (
    <div className="sbx-partybar">
      <Tabs
        label="Entities"
        heading="Entities"
        names={state.entities.map((x, i) => x.name || `Entity ${i + 1}`)}
        sel={sel}
        onSelect={selectEntity}
        idOf={(i) => `${uid}-tab-${i}`}
        panelId={`${uid}-panel`}
        addLabel="+ Add entity"
        addTitle="Another entity, with its own chart of accounts"
        onAdd={addEntity}
      />
      <div className="sbx-party-tools">
        <label className="sh-rename">
          <span>Name</span>
          <input
            className="sh-entity-name"
            aria-label="Entity name"
            value={books.name}
            onChange={(e) => setBooks({ ...books, name: e.target.value })}
          />
        </label>
        <ColumnOrderToggle
          manual={isManualOrder(books)}
          disabled={books.accounts.length === 0}
          onChange={(m) => setBooks(setManualOrder(books, m))}
        />
        <button
          type="button"
          className="btn"
          aria-label="Duplicate entity"
          onClick={duplicateEntity}
        >
          Duplicate
        </button>
        {confirmRemove ? (
          <span className="sbx-confirm" role="group" aria-label="Confirm remove entity">
            Remove {books.name || 'this entity'}
            {scenarioCount > 1 ? ` and its books in all ${scenarioCount} scenarios` : ''}?
            <button type="button" className="btn" onClick={removeEntity}>
              Yes, remove
            </button>
            <button type="button" className="btn" onClick={() => setConfirmRemove(false)}>
              Cancel
            </button>
          </span>
        ) : (
          <button
            type="button"
            className="btn"
            aria-label="Remove entity"
            onClick={() => setConfirmRemove(true)}
          >
            Remove
          </button>
        )}
      </div>
      <EntitySummaryLine summary={summary} rows={books.rows.length} />
    </div>
  );
}
