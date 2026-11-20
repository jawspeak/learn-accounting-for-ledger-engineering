import { useState, useSyncExternalStore } from 'react';
import type { Account, AccountType, EntityBooks, EventRow, Posting, Side } from '@contracts';
import { engine } from '@engine';
import { AmountInput } from '../components/builder/AmountInput';
import { formatDollars } from '../components/builder/model';
import { useScrollToAt } from '../lib/useScrollToAt';
import {
  addAccount,
  addEntry,
  addLine,
  debitsFirst,
  entryCheck,
  moveRow,
  nextLineSide,
  orderedAccounts,
  removeLine,
  removeRow,
  setLineAccount,
  setLineAmount,
  blankLine,
  eventNumber,
  type EventPart,
} from './model';
import { SECTION_LABEL, sectionOf, TypeOptions, typeLabel, type BsSection } from './EntityPanels';
import { Menu } from './Menu';
import { SandboxLink } from './nav';
import './journal.css';

const NEW = '__new';
const SECTIONS: BsSection[] = ['assets', 'liabilities', 'equity', 'revenue', 'expenses'];
const SIDES: Side[] = ['dr', 'cr'];
export const entryAnchor = (n: number) => `entry-${n}`;

/**
 * An event's other sides, behind one linked-event button. The button says how many other entities book the event
 * ("⇄ 2"), or "⇄ ✗" when one of them still has to; it opens the list — each entity, its part (✓ entry, — no
 * entry, ✗ to do), and a link to its entry.
 */
function LinkedSides({
  event,
  anchor,
  others,
}: {
  event: string;
  anchor: string;
  others: { entity: string; index: number; part: EventPart }[];
}) {
  const posted = others.filter((o) => o.part === 'posted').length;
  const todo = others.some((o) => o.part === 'todo');
  const summary = others.map((o) => `${o.entity}: ${PART_WORD[o.part]}`).join(' · ');
  return (
    <Menu
      label={`${event} in other entities`}
      align="end"
      title={`${event} in other entities — ${summary}`}
      buttonClass={`jx-linked${todo ? ' is-todo' : ''}`}
      button={
        <>
          <span aria-hidden="true">⇄ {todo ? '✗' : posted}</span>
          <span className="sr-only">
            {' '}
            (
            {todo
              ? 'a side is still to do'
              : `${posted} other ${posted === 1 ? 'entity' : 'entities'}`}
            )
          </span>
        </>
      }
    >
      {(close) => (
        <>
          <p className="jx-linked-head">{event} is the same event in every entity’s books</p>
          {others.map((o) => (
            <SandboxLink
              key={o.index}
              className={`jx-linked-row is-${o.part}`}
              to={{ view: 'journal', entity: o.index, at: anchor }}
              onClick={close}
            >
              <span className="jx-linked-mark" aria-hidden="true">
                {PART_MARK[o.part]}
              </span>
              <span className="jx-linked-name">{o.entity}</span>
              <span className="jx-linked-part">{PART_WORD[o.part]}</span>
            </SandboxLink>
          ))}
        </>
      )}
    </Menu>
  );
}

const PART_MARK: Record<EventPart, string> = { posted: '✓', none: '—', todo: '✗' };
const PART_WORD: Record<EventPart, string> = {
  posted: 'has its entry',
  none: 'no entry',
  todo: 'entry still to do',
};

/** Phone width (matches journal.css): the entry's heading row then spans the Dr and Cr columns too. */
const NARROW = '(max-width: 560px)';
function useNarrow(): boolean {
  return useSyncExternalStore(
    (cb) => {
      if (typeof window.matchMedia !== 'function') return () => {};
      const m = window.matchMedia(NARROW);
      m.addEventListener('change', cb);
      return () => m.removeEventListener('change', cb);
    },
    () => typeof window.matchMedia === 'function' && window.matchMedia(NARROW).matches,
    () => false,
  );
}

/**
 * The Journal view: the books as a general journal — one ruled sheet, an entry per business event, each a set of
 * lines (account, debit or credit) that must balance, credits indented under the debits. Columns: # | Account |
 * Dr | Cr. A working tool, laid out like ledger paper: tight rows, rules between entries, figures in columns.
 */
export function JournalEditor({
  entity: stored,
  onChange,
  at,
  idPrefix = '',
  hint = true,
  parts = [],
  self = 0,
}: {
  entity: EntityBooks;
  onChange(e: EntityBooks): void;
  at?: string;
  /** Prefixes element ids when several journals share a page (all scenarios); "" for the current one, so
   *  links to "entry-3" land there. */
  idPrefix?: string;
  /** The "Write your first entry" hint above a blank journal. */
  hint?: boolean;
  /** For each event (row): every entity's part in it, so each event shows the other side ("Bank ✓"). */
  parts?: { entity: string; index: number; part: EventPart }[][];
  /** This entity's index (in `parts`). */
  self?: number;
}) {
  // With no entries yet, show one blank entry (a debit line and a credit line) so it's clear how to start. It
  // isn't in the state (or a link) until you type in it: every edit below starts from `e`, so the first one
  // stores exactly this entry.
  const placeholder = stored.rows.length === 0;
  const e = placeholder ? addEntry(stored) : stored;
  useScrollToAt(at, e.id);
  /** The line whose "New account…" form is open: `${row}:${line}`. */
  const [creating, setCreating] = useState<string | null>(null);
  const accounts = orderedAccounts(e);
  const narrow = useNarrow();

  /** "+ Line": a new line, on the side that's short (type in the other column to switch it). */
  const addLineButton = (ri: number, n: number) => (
    <button
      type="button"
      aria-label={`Add a line to entry ${n}`}
      title="Add a line — type its amount under Dr or Cr"
      onClick={() => onChange(addLine(e, ri, nextLineSide(e.rows[ri]!)))}
    >
      ＋ Line
    </button>
  );

  const add = () => {
    onChange(addEntry(e));
    // Put the cursor in the new entry's description.
    setTimeout(() =>
      document.getElementById(`${idPrefix}${e.id}-entry-${e.rows.length + 1}-desc`)?.focus(),
    );
  };

  /** This event doesn't touch these books ("No entry"), or does after all (a blank Dr and Cr line to fill). */
  const setNone = (ri: number, none: boolean) => {
    const r = e.rows[ri]!;
    if (none && r.postings.some((p) => p.amount > 0)) {
      if (
        !window.confirm(`Mark ${eventNumber(ri)} as no entry in ${e.name}’s books? Its lines go.`)
      )
        return;
    }
    onChange({
      ...e,
      rows: e.rows.map((x, i) => {
        if (i !== ri) return x;
        if (none) return { ...x, none: true, postings: [] };
        const next: EventRow = { ...x, postings: [blankLine('dr'), blankLine('cr')] };
        delete next.none;
        return next;
      }),
    });
  };

  /** Removing an event removes it from every entity — ask first when another entity has lines in it. */
  const removeEvent = (ri: number) => {
    const others = (parts[ri] ?? []).filter((p) => p.index !== self && p.part === 'posted');
    if (
      others.length &&
      !window.confirm(
        `Remove ${eventNumber(ri)} from every entity? ${others.map((o) => o.entity).join(', ')}’s entry goes too.`,
      )
    )
      return;
    onChange(removeRow(e, ri));
  };

  const setDescription = (ri: number, label: string) =>
    onChange({
      ...e,
      rows: e.rows.map((x, i) => {
        if (i !== ri) return x;
        const next = { ...x };
        if (label) next.label = label;
        else delete next.label;
        return next;
      }),
    });

  const accountSelect = (p: Posting, ri: number, li: number, label: string) => (
    <select
      aria-label={`${label} account`}
      // Reads as plain text once chosen; looks like a control on hover / focus.
      className={`jx-quiet${p.accountId ? '' : ' is-empty'}`}
      value={p.accountId}
      onChange={(ev) => {
        if (ev.target.value === NEW) setCreating(`${ri}:${li}`);
        else onChange(setLineAccount(e, ri, li, ev.target.value));
      }}
    >
      <option value="">Choose an account…</option>
      {SECTIONS.map((s) => {
        const inS = accounts.filter((a) => sectionOf(a.type) === s);
        return inS.length ? (
          <optgroup key={s} label={SECTION_LABEL[s]}>
            {inS.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </optgroup>
        ) : null;
      })}
      <option value={NEW}>＋ New account…</option>
    </select>
  );

  return (
    <div className="jx">
      {placeholder && hint && (
        <p className="note">
          Write your first entry: what happened, then the accounts it debits and credits. Each
          business event is one entry, and its debits must equal its credits.
        </p>
      )}
      <table className="jx-sheet">
        <caption className="sr-only">Journal entries</caption>
        <colgroup>
          <col className="jx-c-num" />
          <col />
          <col className="jx-c-amt" />
          <col className="jx-c-amt" />
          <col className="jx-c-tools" />
        </colgroup>
        <thead>
          <tr>
            <th scope="col" className="jx-num">
              #
            </th>
            <th scope="col">Account</th>
            <th scope="col" className="jx-amt">
              <span aria-hidden="true">Dr</span>
              <span className="sr-only">Debit</span>
            </th>
            <th scope="col" className="jx-amt">
              <span aria-hidden="true">Cr</span>
              <span className="sr-only">Credit</span>
            </th>
            <th scope="col">
              <span className="sr-only">Tools</span>
            </th>
          </tr>
        </thead>
        {e.rows.map((r, ri) => {
          const n = ri + 1;
          const t = entryCheck(r);
          // The other entities' parts in this event, and whether this entity's side is the one missing.
          const others = (parts[ri] ?? []).filter((p) => p.index !== self);
          const missing =
            !r.none && !t.started && others.some((p) => p.part === 'posted') && !placeholder;
          // "No entry", ↑ ↓ ×. Nothing to move or remove until the blank first entry is written.
          const tools = (
            <span className="jx-tools" hidden={placeholder}>
              {!r.none && (
                <button
                  type="button"
                  aria-label={`No entry for entry ${n}`}
                  title={`${eventNumber(ri)} doesn’t touch ${e.name || 'these'}’s books`}
                  onClick={() => setNone(ri, true)}
                >
                  No entry
                </button>
              )}
              <button
                type="button"
                aria-label={`Move entry ${n} up`}
                disabled={ri === 0}
                onClick={() => onChange(moveRow(e, ri, -1))}
              >
                <span aria-hidden="true">↑</span>
              </button>
              <button
                type="button"
                aria-label={`Move entry ${n} down`}
                disabled={ri === e.rows.length - 1}
                onClick={() => onChange(moveRow(e, ri, 1))}
              >
                <span aria-hidden="true">↓</span>
              </button>
              <button
                type="button"
                aria-label={`Remove entry ${n}`}
                title={`Remove ${eventNumber(ri)} (from every entity)`}
                onClick={() => removeEvent(ri)}
              >
                <span aria-hidden="true">×</span>
              </button>
            </span>
          );
          return (
            <tbody
              key={r.id}
              id={idPrefix + entryAnchor(n)}
              className="jx-entry"
              // Leaving the entry puts its debits first (the journal convention) — not while typing, so
              // the line you're in never jumps.
              onBlur={(ev) => {
                if (ev.currentTarget.contains(ev.relatedTarget as Node | null)) return;
                const sorted = debitsFirst(e, ri);
                if (sorted !== e) onChange(sorted);
              }}
            >
              {/* The entry's first row: its number, what happened, and whether it balances. */}
              <tr className="jx-head">
                <th
                  scope="row"
                  className="jx-num"
                  title={`Event ${n} — the same E${n} in every entity`}
                >
                  {eventNumber(ri)}
                </th>
                {/* On a phone the description gets the whole row, with "+ Line" in it. */}
                <td colSpan={narrow ? 3 : 1}>
                  <div className="jx-head-cell">
                    <input
                      id={`${idPrefix}${e.id}-entry-${n}-desc`}
                      className="jx-desc"
                      aria-label={`Entry ${n} description`}
                      placeholder="What happened?"
                      value={r.label ?? ''}
                      onChange={(ev) => setDescription(ri, ev.target.value)}
                    />
                    {r.none && (
                      <span
                        className="jx-none"
                        title={`${eventNumber(ri)} has no entry in ${e.name || 'these'}’s books`}
                      >
                        No entry here{' '}
                        <button type="button" onClick={() => setNone(ri, false)}>
                          ＋ Add one
                        </button>
                      </span>
                    )}
                    {missing && (
                      <span className="jx-status is-bad">
                        <span aria-hidden="true">✗</span> {e.name || 'This entity'}’s side is
                        missing — fill it in, or mark “No entry”
                      </span>
                    )}
                    {/* Only a problem is worth the space: a balanced entry says nothing. */}
                    {t.started && !t.balanced && (
                      <span className="jx-status is-bad">
                        {t.missingAccount ? (
                          <>
                            <span aria-hidden="true">✗</span> Choose an account for every line
                          </>
                        ) : (
                          <>
                            <span aria-hidden="true">✗</span> Debits {formatDollars(t.dr)} ≠ credits{' '}
                            {formatDollars(t.cr)}
                          </>
                        )}
                      </span>
                    )}
                    {/* The same event in the other entities' books, behind one "linked" button: "⇄ 2" (how
                        many other entities post it), "⇄ ✗" when one is still to do. Click for the list. */}
                    {others.length > 0 && (
                      <LinkedSides
                        event={eventNumber(ri)}
                        anchor={entryAnchor(n)}
                        others={others}
                      />
                    )}
                    {narrow && !r.none && <span className="jx-add">{addLineButton(ri, n)}</span>}
                    {narrow && tools}
                  </div>
                </td>
                {/* Desktop: "+ Line" and the event's tools in the heading row's Dr | Cr cells. */}
                {!narrow && (
                  <td colSpan={2} className="jx-add">
                    <div className="jx-add-cell">
                      {!r.none && addLineButton(ri, n)}
                      {tools}
                    </div>
                  </td>
                )}
                <td />
              </tr>
              {/* No entry here: just the heading row. */}
              {!r.none &&
                r.postings.map((p, li) => {
                  const line = `Entry ${n} line ${li + 1}`;
                  return (
                    <tr key={li} className={`jx-line ${p.side === 'cr' ? 'is-cr' : 'is-dr'}`}>
                      <td />
                      <td className="jx-acct">
                        <span className="jx-acct-row">
                          {accountSelect(p, ri, li, line)}
                          {/* The account's type, in the room at the right of the Account column. */}
                          {(() => {
                            const a = accounts.find((x) => x.id === p.accountId);
                            return a ? (
                              <span className="jx-acct-type">{typeLabel(a.type)}</span>
                            ) : null;
                          })()}
                        </span>
                        {creating === `${ri}:${li}` && (
                          <NewAccountForm
                            entity={e}
                            onCancel={() => setCreating(null)}
                            onCreate={(name, type) => {
                              const { entity, id } = addAccount(e, name, type);
                              onChange(setLineAccount(entity, ri, li, id));
                              setCreating(null);
                            }}
                          />
                        )}
                      </td>
                      {/* Type in Dr or Cr: that makes it a debit (flush left) or a credit (indented). The
                        faint "$0.00" marks the side the line is on until an amount is typed. */}
                      {SIDES.map((s) => (
                        <td key={s} className="jx-amt">
                          <span className="jx-amt-row">
                            <AmountInput
                              className="jx-amount jx-quiet"
                              aria-label={`${line} ${s === 'dr' ? 'debit' : 'credit'}`}
                              allowCents
                              formatAtRest
                              placeholder={p.side === s && p.amount === 0 ? '$0.00' : ''}
                              cents={p.side === s ? p.amount : 0}
                              onCentsChange={(c) => onChange(setLineAmount(e, ri, li, c, s))}
                            />
                            {/* Beside the amount: ▲ it increases the account, ▼ it decreases it. */}
                            <EffectMark
                              account={
                                p.side === s
                                  ? accounts.find((a) => a.id === p.accountId)
                                  : undefined
                              }
                              line={p}
                            />
                          </span>
                        </td>
                      ))}
                      <td className="jx-tools-cell">
                        <button
                          type="button"
                          className="jx-remove-line"
                          aria-label={`Remove ${line.toLowerCase()}`}
                          onClick={() => onChange(removeLine(e, ri, li))}
                        >
                          <span aria-hidden="true">×</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          );
        })}
      </table>
      <button type="button" className="jx-add-entry" onClick={add}>
        <span aria-hidden="true">＋ </span>Add entry
      </button>
    </div>
  );
}

/**
 * Beside a line's amount, what it does to the account: a green ▲ when it increases it, a red ▼ when it decreases
 * it (hidden while you edit the amount). The tooltip names the account's type: "Asset — this debit increases
 * Cash: FBO Account".
 */
function EffectMark({ account, line }: { account?: Account; line: Posting }) {
  if (!account || !(line.amount > 0)) return <span className="jx-eff" aria-hidden="true" />;
  const up = line.side === engine.normalSide(account.type);
  const what = `${typeLabel(account.type)} — this ${line.side === 'dr' ? 'debit' : 'credit'} ${
    up ? 'increases' : 'decreases'
  } ${account.name}`;
  return (
    <span className={`jx-eff ${up ? 'is-up' : 'is-down'}`} title={what}>
      <span aria-hidden="true">{up ? '▲' : '▼'}</span>
      <span className="sr-only"> {up ? 'increases' : 'decreases'} the account</span>
    </span>
  );
}

/** Inline "New account": a name and a type, added to this entity's accounts and chosen for the line. */
function NewAccountForm({
  entity,
  onCreate,
  onCancel,
}: {
  entity: EntityBooks;
  onCreate(name: string, type: AccountType): void;
  onCancel(): void;
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('asset');
  return (
    <form
      className="jx-new"
      aria-label="New account"
      onSubmit={(ev) => {
        ev.preventDefault();
        if (name.trim()) onCreate(name.trim(), type);
      }}
    >
      {/* Focus moves here on purpose: the learner just chose "New account…" from the list. */}
      <input
        aria-label="New account name"
        placeholder="Account name"
        autoFocus
        value={name}
        onChange={(ev) => setName(ev.target.value)}
        onKeyDown={(ev) => ev.key === 'Escape' && onCancel()}
      />
      <select
        aria-label="New account type"
        value={type}
        onChange={(ev) => setType(ev.target.value as AccountType)}
      >
        {/* Contra types only when there's something to reduce (the parent is picked; change it in Accounts). */}
        <TypeOptions accounts={entity.accounts} />
      </select>
      <button type="submit" className="btn" disabled={!name.trim()}>
        Add
      </button>
      <button type="button" className="btn" onClick={onCancel}>
        Cancel
      </button>
    </form>
  );
}
