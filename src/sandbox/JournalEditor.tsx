import { useState, useSyncExternalStore } from 'react';
import type { AccountType, EntityBooks, Posting, Side } from '@contracts';
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
} from './model';
import { SECTION_LABEL, sectionOf, TypeOptions, type BsSection } from './EntityPanels';
import './journal.css';

const NEW = '__new';
const SECTIONS: BsSection[] = ['assets', 'liabilities', 'equity', 'revenue', 'expenses'];
const SIDES: Side[] = ['dr', 'cr'];
export const entryAnchor = (n: number) => `entry-${n}`;

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
}: {
  entity: EntityBooks;
  onChange(e: EntityBooks): void;
  at?: string;
  /** Prefixes element ids when several journals share a page (all scenarios); "" for the current one, so
   *  links to "entry-3" land there. */
  idPrefix?: string;
  /** The "Write your first entry" hint above a blank journal. */
  hint?: boolean;
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
                <th scope="row" className="jx-num">
                  {n}
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
                    {t.started && (
                      <span className={`jx-status ${t.balanced ? 'is-ok' : 'is-bad'}`}>
                        {t.balanced ? (
                          <>
                            <span aria-hidden="true">✓</span> Debits = credits
                          </>
                        ) : t.missingAccount ? (
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
                    {narrow && <span className="jx-add">{addLineButton(ri, n)}</span>}
                    {/* Nothing to move or remove until the blank first entry is written. */}
                    <span className="jx-tools" hidden={placeholder}>
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
                        title="Remove this entry"
                        onClick={() => onChange(removeRow(e, ri))}
                      >
                        <span aria-hidden="true">×</span>
                      </button>
                    </span>
                  </div>
                </td>
                {!narrow && (
                  <td colSpan={2} className="jx-add">
                    {addLineButton(ri, n)}
                  </td>
                )}
                <td />
              </tr>
              {r.postings.map((p, li) => {
                const line = `Entry ${n} line ${li + 1}`;
                return (
                  <tr key={li} className={`jx-line ${p.side === 'cr' ? 'is-cr' : 'is-dr'}`}>
                    <td />
                    <td className="jx-acct">
                      {accountSelect(p, ri, li, line)}
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
                        <AmountInput
                          className="jx-amount jx-quiet"
                          aria-label={`${line} ${s === 'dr' ? 'debit' : 'credit'}`}
                          allowCents
                          formatAtRest
                          placeholder={p.side === s && p.amount === 0 ? '$0.00' : ''}
                          cents={p.side === s ? p.amount : 0}
                          onCentsChange={(c) => onChange(setLineAmount(e, ri, li, c, s))}
                        />
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
