import { useState } from 'react';
import type { AccountType, SandboxEntity, Side } from '@contracts';
import { AmountInput } from '../../components/builder/AmountInput';
import { formatDollars } from '../../components/builder/model';
import { addAccount } from '../sheet/model';
import { useScrollToAt } from '../useScrollToAt';
import {
  ACCOUNT_TYPES,
  addEntry,
  addLine,
  entryTotals,
  moveRow,
  orderedAccounts,
  removeLine,
  removeRow,
  setLineAccount,
  setLineAmount,
} from './model';
import { SECTION_LABEL, sectionOf, type BsSection } from './PartyPanels';
import './journal.css';

const NEW = '__new';
const SECTIONS: BsSection[] = ['assets', 'liabilities', 'equity', 'revenue', 'expenses'];
export const entryAnchor = (n: number) => `entry-${n}`;

/**
 * The Journal view: the books as a list of entries, in order — one per business event, each a set of lines
 * (account, debit or credit) that must balance. This is how a ledger is written to: one transaction, N postings.
 */
export function JournalEditor({
  entity: e,
  onChange,
  at,
}: {
  entity: SandboxEntity;
  onChange(e: SandboxEntity): void;
  at?: string;
}) {
  useScrollToAt(at, e.id);
  /** The line whose "New account…" form is open: `${row}:${line}`. */
  const [creating, setCreating] = useState<string | null>(null);
  const accounts = orderedAccounts(e);

  const add = () => {
    onChange(addEntry(e));
    // Put the cursor in the new entry's description.
    setTimeout(() => document.getElementById(`${e.id}-entry-${e.rows.length + 1}-desc`)?.focus());
  };

  return (
    <div className="jx">
      {e.rows.length === 0 && (
        <p className="note">
          No entries yet. Each business event is one entry: its debits and credits must be equal.
        </p>
      )}
      <ol className="jx-entries">
        {e.rows.map((r, ri) => {
          const n = ri + 1;
          const t = entryTotals(r);
          const filled = r.postings.some((p) => p.amount > 0);
          const balanced = t.dr === t.cr;
          return (
            <li key={r.id} id={entryAnchor(n)} className="jx-entry">
              <div className="jx-head">
                <span className="jx-num" aria-hidden="true">
                  {n}
                </span>
                <input
                  id={`${e.id}-entry-${n}-desc`}
                  className="jx-desc"
                  aria-label={`Entry ${n} description`}
                  placeholder="What happened?"
                  value={r.label ?? ''}
                  onChange={(ev) =>
                    onChange({
                      ...e,
                      rows: e.rows.map((x, i) => {
                        if (i !== ri) return x;
                        const next = { ...x };
                        if (ev.target.value) next.label = ev.target.value;
                        else delete next.label;
                        return next;
                      }),
                    })
                  }
                />
                {filled && (
                  <span className={`jx-status ${balanced ? 'is-ok' : 'is-bad'}`}>
                    {balanced ? (
                      <>
                        <span aria-hidden="true">✓</span> Debits = credits
                      </>
                    ) : (
                      <>
                        <span aria-hidden="true">✗</span> Debits {formatDollars(t.dr)} ≠ credits{' '}
                        {formatDollars(t.cr)}
                      </>
                    )}
                  </span>
                )}
                <span className="jx-tools">
                  <button
                    type="button"
                    aria-label={`Move entry ${n} up`}
                    disabled={ri === 0}
                    onClick={() => onChange(moveRow(e, ri, -1))}
                  >
                    <span aria-hidden="true">▲</span>
                  </button>
                  <button
                    type="button"
                    aria-label={`Move entry ${n} down`}
                    disabled={ri === e.rows.length - 1}
                    onClick={() => onChange(moveRow(e, ri, 1))}
                  >
                    <span aria-hidden="true">▼</span>
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

              <table className="jx-lines">
                <caption className="sr-only">Entry {n} lines</caption>
                <thead>
                  <tr>
                    <th scope="col">Account</th>
                    <th scope="col" className="jx-amt">
                      Debit
                    </th>
                    <th scope="col" className="jx-amt">
                      Credit
                    </th>
                    <th scope="col">
                      <span className="sr-only">Remove</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {r.postings.map((p, li) => {
                    const key = `${ri}:${li}`;
                    const line = `Entry ${n} line ${li + 1}`;
                    return (
                      <tr key={li} className={p.side === 'cr' ? 'is-cr' : 'is-dr'}>
                        <td className="jx-acct">
                          <select
                            aria-label={`${line} account`}
                            value={p.accountId}
                            onChange={(ev) => {
                              if (ev.target.value === NEW) setCreating(key);
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
                          {creating === key && (
                            <NewAccountForm
                              onCancel={() => setCreating(null)}
                              onCreate={(name, type) => {
                                const { entity, id } = addAccount(e, name, type);
                                onChange(setLineAccount(entity, ri, li, id));
                                setCreating(null);
                              }}
                            />
                          )}
                        </td>
                        {(['dr', 'cr'] as Side[]).map((s) => (
                          <td key={s} className="jx-amt">
                            <AmountInput
                              className="jx-amount"
                              aria-label={`${line} ${s === 'dr' ? 'debit' : 'credit'}`}
                              allowCents
                              cents={p.side === s ? p.amount : 0}
                              onCentsChange={(c) => onChange(setLineAmount(e, ri, li, s, c))}
                            />
                          </td>
                        ))}
                        <td>
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
              </table>
              <div className="jx-line-tools">
                <button type="button" onClick={() => onChange(addLine(e, ri, 'dr'))}>
                  ＋ Debit line
                </button>
                <button type="button" onClick={() => onChange(addLine(e, ri, 'cr'))}>
                  ＋ Credit line
                </button>
              </div>
            </li>
          );
        })}
      </ol>
      <button type="button" className="jx-add-entry" onClick={add}>
        <span aria-hidden="true">＋ </span>Add entry
      </button>
    </div>
  );
}

/** Inline "New account": a name and a type, added to this party's accounts and chosen for the line. */
function NewAccountForm({
  onCreate,
  onCancel,
}: {
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
        {ACCOUNT_TYPES.map((t) => (
          <option key={t.type} value={t.type}>
            {t.label}
          </option>
        ))}
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
