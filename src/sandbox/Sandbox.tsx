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
  eventParts,
  moveScenario,
  orderMode,
  persistable,
  removeEntityFrom,
  removeScenarioFrom,
  scenarioNumber,
  scenarioStatus,
  setOrderMode,
  slugify,
  storyLine,
  summarize,
  updateScenario,
  usageByScenario,
  withBooks,
} from './model';
import { entityLabel, ShowCodes } from './codes';
import { Menu } from './Menu';
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
  /** Journal: this scenario only, or every scenario one after another (for the selected entity). */
  const [allScenarios, setAllScenarios] = useState(false);
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
  const showCodes = !!state.showCodes;
  /** Each event's parts in scenario `i`, with the entities named as shown ("1000 Zap" when codes are on). */
  const partsFor = (i: number) =>
    eventParts(state, i).map((ps) =>
      ps.map((p) => ({ ...p, entity: entityLabel(state.entities[p.index]!, showCodes) })),
    );

  return (
    <SandboxNavProvider value={{ linkTo, onNavigate }}>
      <ShowCodes.Provider value={showCodes}>
        <article className="sbx sh">
          <div className="sbx-viewbar">
            <ViewSwitch current={view} entity={ei} />
            {/* One switch for every view: entity codes and GL account numbers (optional, for organising). */}
            <label
              className="sbx-check sbx-codes-toggle"
              title="Show entity codes and GL account numbers in every view"
            >
              <input
                type="checkbox"
                checked={showCodes}
                onChange={(e) =>
                  update((s) => {
                    const next: SandboxState = { ...s, showCodes: e.target.checked };
                    if (!e.target.checked) delete next.showCodes;
                    return next;
                  })
                }
              />
              Codes &amp; GL numbers
            </label>
          </div>
          {/* One line: the title, the host's tools (Copy link), and a menu for the occasional actions. */}
          <div className="sbx-head">
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
            {toolbar}
            <Menu label="Sandbox menu" align="end">
              {(close) => (
                <>
                  {examples && examples.length > 0 && (
                    <label className="sbx-menu-field">
                      Example scenarios:
                      <select
                        value=""
                        onChange={(e) => {
                          const ex = examples.find((x) => x.id === e.target.value);
                          if (!ex) return;
                          close();
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
                    onClick={() => {
                      close();
                      setPending({
                        question:
                          'Start over with an empty Sandbox? (Copy the link or export first to keep your work.)',
                        build: emptyState,
                        done: 'Started a new, empty Sandbox.',
                      });
                    }}
                  >
                    New
                  </button>
                  <button
                    type="button"
                    title="Download a .json file"
                    onClick={() => {
                      close();
                      exportFile();
                    }}
                  >
                    Export
                  </button>
                  <button
                    type="button"
                    title="Open a .json file exported from the Sandbox"
                    onClick={() => {
                      close();
                      fileRef.current?.click();
                    }}
                  >
                    Import
                  </button>
                </>
              )}
            </Menu>
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
          </div>
          <p className="note sbx-status" role="status" aria-live="polite">
            {status}
          </p>

          {notice}
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
              // "S1 ✓ Alice tops up $50": a number to refer to, and the check, like a test run.
              names={state.scenarios.map((x, i) => {
                const st = scenarioStatus(state, i);
                return (
                  <>
                    <span className="sbx-sc-num">{scenarioNumber(i)}</span>
                    {st !== 'empty' && (
                      <span
                        className={`sbx-sc-status ${st === 'ok' ? 'is-ok' : 'is-bad'}`}
                        aria-hidden="true"
                      >
                        {st === 'ok' ? '✓' : '✗'}
                      </span>
                    )}
                    {x.title || `Scenario ${i + 1}`}
                    {st !== 'empty' && (
                      <span className="sr-only">
                        {st === 'ok' ? ' (balances)' : ' (doesn’t balance)'}
                      </span>
                    )}
                  </>
                );
              })}
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
              {/* One line: the story's first line (click to read or edit it all), and the scenario's menu. */}
              <div className="sbx-scenario-bar">
                <ScenarioText
                  key={`${epoch}:${sc.id}`}
                  uid={uid}
                  text={sc.text}
                  onText={(text) => onChange(updateScenario(state, si, { text }))}
                />
                <Menu label="Scenario menu" align="end">
                  {(close) => (
                    <>
                      <label className="sbx-menu-field">
                        Title
                        <input
                          aria-label="Scenario title"
                          value={sc.title}
                          placeholder={`Scenario ${si + 1}`}
                          onChange={(e) =>
                            onChange(updateScenario(state, si, { title: e.target.value }))
                          }
                        />
                      </label>
                      <button
                        type="button"
                        aria-label="Move scenario left"
                        disabled={si === 0}
                        onClick={() => {
                          onChange(moveScenario(state, si, -1));
                          onScenarioSelect(si - 1);
                        }}
                      >
                        <span aria-hidden="true">← </span>Move earlier
                      </button>
                      <button
                        type="button"
                        aria-label="Move scenario right"
                        disabled={si === state.scenarios.length - 1}
                        onClick={() => {
                          onChange(moveScenario(state, si, 1));
                          onScenarioSelect(si + 1);
                        }}
                      >
                        <span aria-hidden="true">→ </span>Move later
                      </button>
                      <button
                        type="button"
                        aria-label="Duplicate scenario"
                        onClick={() => {
                          close();
                          duplicateScenario();
                        }}
                      >
                        Duplicate
                      </button>
                      {confirmRemoveScenario ? (
                        <span
                          className="sbx-confirm"
                          role="group"
                          aria-label="Confirm remove scenario"
                        >
                          Remove {sc.title || 'this scenario'} and its entries?
                          <button
                            type="button"
                            className="btn"
                            onClick={() => {
                              close();
                              removeScenario();
                            }}
                          >
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
                          aria-label="Remove scenario"
                          onClick={() => setConfirmRemoveScenario(true)}
                        >
                          Remove
                        </button>
                      )}
                    </>
                  )}
                </Menu>
              </div>
            </div>
          </section>

          <details className="sbx-panel sbx-coa">
            <summary>
              Chart of accounts ({state.entities.reduce((n, e) => n + e.accounts.length, 0)}{' '}
              accounts, {state.entities.length} entit{state.entities.length > 1 ? 'ies' : 'y'})
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
              showCodes={showCodes}
              scope={
                view === 'journal' && state.scenarios.length > 1 ? (
                  <span className="vs-order" role="group" aria-label="Scenarios shown">
                    <span className="vs-order-label">Show</span>
                    <button
                      type="button"
                      aria-pressed={!allScenarios}
                      onClick={() => setAllScenarios(false)}
                    >
                      This scenario
                    </button>
                    <button
                      type="button"
                      aria-pressed={allScenarios}
                      onClick={() => setAllScenarios(true)}
                      title="Every scenario's journal for this entity, one after another"
                    >
                      All scenarios
                    </button>
                  </span>
                ) : null
              }
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
                    {allScenarios ? (
                      /* Every scenario's journal for this entity, one after another, each under its own
                       heading — still editable. Click a heading to make that scenario the current one. */
                      state.scenarios.map((x, i) => {
                        const st = scenarioStatus(state, i);
                        return (
                          <section
                            key={`${epoch}:${x.id}:${current.id}`}
                            className={`sbx-allsc${i === si ? ' is-current' : ''}`}
                            aria-label={`${scenarioNumber(i)} ${x.title || `Scenario ${i + 1}`}`}
                          >
                            <h3 className="sbx-allsc-head">
                              <button
                                type="button"
                                aria-current={i === si ? 'true' : undefined}
                                title="Make this the current scenario"
                                onClick={() => selectScenario(i)}
                              >
                                <span className="sbx-sc-num">{scenarioNumber(i)}</span>
                                {st !== 'empty' && (
                                  <span
                                    className={`sbx-sc-status ${st === 'ok' ? 'is-ok' : 'is-bad'}`}
                                    aria-hidden="true"
                                  >
                                    {st === 'ok' ? '✓' : '✗'}
                                  </span>
                                )}
                                {x.title || `Scenario ${i + 1}`}
                              </button>
                              {storyLine(x.text) && (
                                <span className="sbx-allsc-story note">{storyLine(x.text)}</span>
                              )}
                            </h3>
                            <JournalEditor
                              entity={booksOf(state, i, ei)}
                              onChange={(b) => onChange(withBooks(state, i, ei, b))}
                              at={i === si ? at : undefined}
                              idPrefix={i === si ? '' : `s${i + 1}-`}
                              hint={false}
                              parts={partsFor(i)}
                              self={ei}
                            />
                          </section>
                        );
                      })
                    ) : (
                      <JournalEditor
                        key={`${epoch}:${sc.id}:${current.id}`}
                        entity={books}
                        onChange={setBooks}
                        at={at}
                        parts={partsFor(si)}
                        self={ei}
                      />
                    )}
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
      </ShowCodes.Provider>
    </SandboxNavProvider>
  );
}

/** The scenario's story, in markdown. Collapsed to its first line (the books matter more); click to read it
 *  all or edit it. */
function ScenarioText({
  uid,
  text,
  onText,
}: {
  uid: string;
  text: string;
  onText(t: string): void;
}) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState(() => !!text.trim());
  const line = storyLine(text);
  return (
    <div className={`sbx-story${open ? ' is-open' : ''}`}>
      <button
        type="button"
        className="sbx-story-line"
        aria-expanded={open}
        aria-controls={`${uid}-story`}
        title={open ? 'Hide the story' : 'Show the whole story'}
        onClick={() => setOpen((o) => !o)}
      >
        <span aria-hidden="true">{open ? '▾' : '▸'} </span>
        {line ? (
          <span className="sbx-story-text">{line}</span>
        ) : (
          <span className="sbx-story-text note">Describe what happens in this scenario…</span>
        )}
      </button>
      {open && (
        <div id={`${uid}-story`} className="sbx-scenario-body">
          <ScenarioBody
            uid={uid}
            text={text}
            onText={onText}
            preview={preview}
            setPreview={setPreview}
          />
        </div>
      )}
    </div>
  );
}

function ScenarioBody({
  uid,
  text,
  onText,
  preview,
  setPreview,
}: {
  uid: string;
  text: string;
  onText(t: string): void;
  preview: boolean;
  setPreview(p: boolean): void;
}) {
  return (
    <>
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
    </>
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
  names: ReactNode[];
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
  scope,
  showCodes,
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
  /** The Journal's "This scenario | All scenarios" switch (none in the other views). */
  scope?: ReactNode;
  /** Show the entity code field (codes and GL numbers are on). */
  showCodes: boolean;
}) {
  const summary = summarize(books);
  return (
    <div className="sbx-partybar">
      <Tabs
        label="Entities"
        heading="Entities"
        names={state.entities.map((x, i) => entityLabel(x, showCodes, `Entity ${i + 1}`))}
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
        {showCodes && (
          <label className="sh-rename">
            <span>Code</span>
            <input
              className="sh-entity-code"
              aria-label="Entity code"
              placeholder="e.g. 1000"
              size={6}
              value={books.code ?? ''}
              onChange={(e) => {
                const next: EntityBooks = { ...books, code: e.target.value };
                if (!e.target.value.trim()) delete next.code;
                setBooks(next);
              }}
            />
          </label>
        )}
        {scope}
        <ColumnOrderToggle
          mode={orderMode(books)}
          byNumber={showCodes}
          disabled={books.accounts.length === 0}
          onChange={(m) => setBooks(setOrderMode(books, m))}
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
