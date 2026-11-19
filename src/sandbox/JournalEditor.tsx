import { useState } from 'react';
import type { AccountType, SandboxEntity, Side } from '@contracts';
import { AmountInput } from '../components/builder/AmountInput';
import { formatDollars } from '../components/builder/model';
import { useScrollToAt } from '../lib/useScrollToAt';
import {
  addAccount,
  addEntry,
  addLine,
  entryCheck,
  moveRow,
  orderedAccounts,
  removeLine,
  removeRow,
  setLineAccount,
  setLineAmount,
} from './model';
import { SECTION_LABEL, sectionOf, TypeOptions, type BsSection } from './PartyPanels';
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
          const t = entryCheck(r);
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
                <span className="jx-tools">
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

              <table className="jx-lines">
                <caption className="sr-only">Entry {n} lines</caption>
                <thead>
                  <tr>
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
                            // Reads as plain text once chosen; looks like a control on hover / focus.
                            className={`jx-quiet${p.accountId ? '' : ' is-empty'}`}
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
                        {/* A debit line has an amount only in Dr; a credit line only in Cr. */}
                        {(['dr', 'cr'] as Side[]).map((s) => (
                          <td key={s} className="jx-amt">
                            {p.side === s && (
                              <AmountInput
                                className="jx-amount jx-quiet"
                                aria-label={`${line} ${s === 'dr' ? 'debit' : 'credit'}`}
                                allowCents
                                formatAtRest
                                cents={p.amount}
                                onCentsChange={(c) => onChange(setLineAmount(e, ri, li, c))}
                              />
                            )}
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
                  ＋ Dr line
                </button>
                <button type="button" onClick={() => onChange(addLine(e, ri, 'cr'))}>
                  ＋ Cr line
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
  entity,
  onCreate,
  onCancel,
}: {
  entity: SandboxEntity;
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
