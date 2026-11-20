/** Party-level panels shared by the Sandbox views: checks summary, accounts list, opening balances,
 *  and the small account controls every view uses (type options, "reduces…", remove-with-confirm). */
import { Fragment, useId, useState } from 'react';
import type { Account, AccountId, AccountType, SandboxEntity } from '@contracts';
import { formatDollars, parseDollars } from '../components/builder/model';
import {
  ACCOUNT_TYPES,
  addAccount,
  contraBase,
  contraCandidates,
  isManualOrder,
  linesUsing,
  moveAccountInOrder,
  orderedAccounts,
  removeAccount,
  setOpening,
  summarize,
  updateAccount,
} from './model';

export const typeLabel = (t: AccountType) => ACCOUNT_TYPES.find((x) => x.type === t)?.label ?? t;

function Mark({ ok }: { ok: boolean }) {
  return (
    <span className={ok ? 'sbx-ok' : 'sbx-err'} aria-hidden="true">
      {ok ? '✓' : '✗'}
    </span>
  );
}

export function EntitySummaryLine({
  summary,
  rows,
}: {
  summary: ReturnType<typeof summarize>;
  rows: number;
}) {
  const eq = summary.equation;
  const bad = summary.unbalancedRows;
  return (
    <p className="sbx-summary" aria-live="polite">
      <span>
        <Mark ok={summary.rowsBalanced} />{' '}
        {summary.rowsBalanced
          ? `Entries balanced (${rows})`
          : `Unbalanced entr${bad.length > 1 ? 'ies' : 'y'}: ${bad.join(', ')}`}
      </span>
      <span>
        <Mark ok={eq.balanced} /> A = L + E: {formatDollars(eq.assets)} {eq.balanced ? '=' : '≠'}{' '}
        {formatDollars(eq.liabilities)} + {formatDollars(eq.equity)}
      </span>
      {summary.opening && !summary.opening.balanced && (
        <span className="sbx-err">Opening balances don’t satisfy A = L + E</span>
      )}
    </p>
  );
}

// ---- Account controls shared by every view (Grid header, Journal "New account…", Accounts panel) ----

/** The account types; a contra type is offered only when there's an account for it to reduce. */
const NEEDS: Partial<Record<AccountType, string>> = {
  asset: 'an asset',
  liability: 'a liability',
  equity: 'an equity account',
  revenue: 'a revenue account',
};

export function TypeOptions({ accounts, self }: { accounts: Account[]; self?: AccountId }) {
  return (
    <>
      {ACCOUNT_TYPES.map((t) => {
        // A contra account reduces one account of its family, so it needs one to exist first — say so.
        const base = contraBase(t.type);
        const blocked = !!base && contraCandidates(accounts, t.type, self).length === 0;
        return (
          <option key={t.type} value={t.type} disabled={blocked}>
            {blocked ? `${t.label} (add ${NEEDS[base!]} first)` : t.label}
          </option>
        );
      })}
    </>
  );
}

/** "reduces [Equipment]" for a contra type: only same-family accounts are offered. */
export function ContraParentSelect({
  accounts,
  type,
  self,
  value,
  onChange,
  label,
}: {
  accounts: Account[];
  type: AccountType;
  self?: AccountId;
  value: AccountId | undefined;
  onChange(id: AccountId): void;
  label: string;
}) {
  if (!contraBase(type)) return null;
  return (
    <label className="sh-contra">
      reduces{' '}
      <select aria-label={label} value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
        {contraCandidates(accounts, type, self).map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Remove an account everywhere — asking first when entries post to it (its lines go too). */
export function removeAccountAsking(e: SandboxEntity, a: Account): SandboxEntity | null {
  const n = linesUsing(e, a.id);
  if (n > 0 && !window.confirm(`Remove ${a.name} and its ${n} line${n > 1 ? 's' : ''}?`))
    return null;
  return removeAccount(e, a.id);
}

/** An account name field: free editing (it may be blank while retyping); only non-blank names are saved. */
function AccountNameInput({
  name,
  onCommit,
  label,
}: {
  name: string;
  onCommit(name: string): void;
  label: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      aria-label={label}
      value={draft ?? name}
      onFocus={() => setDraft(name)}
      onBlur={() => setDraft(null)}
      onChange={(ev) => {
        setDraft(ev.target.value);
        if (ev.target.value.trim()) onCommit(ev.target.value);
      }}
    />
  );
}

/** The Accounts panel (Journal view): the same accounts, order, add and remove as the Grid's columns. */
export function AccountsEditor({
  entity,
  onChange,
}: {
  entity: SandboxEntity;
  onChange(e: SandboxEntity): void;
}) {
  const uid = useId();
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('asset');
  const [contraOf, setContraOf] = useState<AccountId>();
  const manual = isManualOrder(entity);
  // The same order as the Grid's columns: balance-sheet order (auto) or the manual order.
  const listed = orderedAccounts(entity);

  const add = () => {
    const n = name.trim();
    if (!n) return;
    onChange(addAccount(entity, n, type, contraOf).entity);
    setName('');
    setContraOf(undefined);
  };

  return (
    <div className="sbx-accounts">
      {listed.length === 0 ? (
        <p className="note">
          No accounts yet — add one below, choose “New account…” on a journal line, or load an
          example scenario.
        </p>
      ) : (
        <table className="sbx-table">
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Type</th>
              <th scope="col">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {listed.map((a, i) => (
              <Fragment key={a.id}>
                {!manual && (i === 0 || sectionOf(listed[i - 1]!.type) !== sectionOf(a.type)) && (
                  <tr className="sbx-section-row">
                    <th scope="rowgroup" colSpan={3}>
                      {SECTION_LABEL[sectionOf(a.type)]}
                    </th>
                  </tr>
                )}
                <tr>
                  <td>
                    <AccountNameInput
                      label={`Name of ${a.name}`}
                      name={a.name}
                      onCommit={(n) => onChange(updateAccount(entity, a.id, { name: n }))}
                    />
                  </td>
                  <td className="sbx-type-cell">
                    <select
                      aria-label={`${a.name} account type`}
                      value={a.type}
                      onChange={(ev) =>
                        onChange(
                          updateAccount(entity, a.id, { type: ev.target.value as AccountType }),
                        )
                      }
                    >
                      <TypeOptions accounts={entity.accounts} self={a.id} />
                    </select>
                    <ContraParentSelect
                      label={`Account ${a.name} reduces`}
                      accounts={entity.accounts}
                      type={a.type}
                      self={a.id}
                      value={a.contraOf}
                      onChange={(id) => onChange(updateAccount(entity, a.id, { contraOf: id }))}
                    />
                    {a.type === 'equity' && (
                      <span className="note">
                        {' '}
                        ({a.equityGroup === 'retained' ? 'retained' : 'paid-in'})
                      </span>
                    )}
                  </td>
                  <td className="sbx-row-actions">
                    {manual && (
                      <>
                        <button
                          type="button"
                          className="btn"
                          // A list, so up / down — the same order the Grid shows left → right.
                          aria-label={`Move ${a.name} up`}
                          title="Earlier in the order (left in the Grid)"
                          disabled={i === 0}
                          onClick={() => onChange(moveAccountInOrder(entity, a.id, -1))}
                        >
                          <span aria-hidden="true">↑</span>
                        </button>
                        <button
                          type="button"
                          className="btn"
                          aria-label={`Move ${a.name} down`}
                          title="Later in the order (right in the Grid)"
                          disabled={i === listed.length - 1}
                          onClick={() => onChange(moveAccountInOrder(entity, a.id, 1))}
                        >
                          <span aria-hidden="true">↓</span>
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      className="btn"
                      aria-label={`Remove ${a.name}`}
                      title="Remove this account (and its lines)"
                      onClick={() => {
                        const next = removeAccountAsking(entity, a);
                        if (next) onChange(next);
                      }}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              </Fragment>
            ))}
          </tbody>
        </table>
      )}
      <form
        className="sbx-add-account"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <label htmlFor={`${uid}-n`} className="sr-only">
          New account name
        </label>
        <input
          id={`${uid}-n`}
          placeholder="New account name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <label htmlFor={`${uid}-t`} className="sr-only">
          New account type
        </label>
        <select
          id={`${uid}-t`}
          value={type}
          onChange={(e) => setType(e.target.value as AccountType)}
        >
          <TypeOptions accounts={entity.accounts} />
        </select>
        <ContraParentSelect
          label="New account reduces"
          accounts={entity.accounts}
          type={type}
          value={contraOf ?? contraCandidates(entity.accounts, type)[0]?.id}
          onChange={setContraOf}
        />
        <button type="submit" className="btn" disabled={!name.trim()}>
          Add account
        </button>
      </form>
    </div>
  );
}

/** Balance-sheet sections for the Accounts list headings (income-statement accounts sit inside equity). */
export type BsSection = 'assets' | 'liabilities' | 'equity' | 'revenue' | 'expenses';
export const SECTION_LABEL: Record<BsSection, string> = {
  assets: 'Assets',
  liabilities: 'Liabilities',
  equity: 'Equity',
  revenue: 'Revenue',
  expenses: 'Expenses & dividends',
};
export function sectionOf(t: AccountType): BsSection {
  if (t === 'asset' || t === 'contra-asset') return 'assets';
  if (t === 'liability' || t === 'contra-liability') return 'liabilities';
  if (t === 'revenue' || t === 'contra-revenue') return 'revenue';
  if (t === 'expense' || t === 'dividend') return 'expenses';
  return 'equity';
}

export function OpeningEditor({
  entity,
  onChange,
}: {
  entity: SandboxEntity;
  onChange(e: SandboxEntity): void;
}) {
  if (entity.accounts.length === 0) return <p className="note">Add accounts first.</p>;
  const amountOf = (id: string) => entity.opening?.lines.find((l) => l.accountId === id)?.amount;
  return (
    <div>
      <p className="note">
        On each account’s normal side (cents allowed; negative = abnormal). Blank or 0 means no
        opening balance.
      </p>
      <table className="sbx-table">
        <tbody>
          {orderedAccounts(entity).map((a) => {
            const amt = amountOf(a.id);
            return (
              <tr key={a.id}>
                <th scope="row">
                  {a.name} <span className="note">({typeLabel(a.type)})</span>
                </th>
                <td>
                  <OpeningInput
                    label={`Opening balance for ${a.name}`}
                    cents={amt}
                    onCents={(c) => onChange(setOpening(entity, a.id, c))}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {entity.opening && (
        <button
          type="button"
          className="btn"
          onClick={() => onChange(setOpening({ ...entity, opening: undefined }, '', null))}
        >
          Clear opening balances
        </button>
      )}
    </div>
  );
}

/** Opening balance: dollars and cents, negative allowed (an abnormal balance); blank or 0 clears the line. */
function OpeningInput({
  label,
  cents,
  onCents,
}: {
  label: string;
  cents?: number;
  onCents(c: number | null): void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const rest = cents === undefined ? '' : String(cents / 100);
  return (
    <input
      aria-label={label}
      inputMode="decimal"
      size={9}
      title={cents === undefined ? undefined : formatDollars(cents)}
      value={draft ?? rest}
      onFocus={() => setDraft(rest)}
      onBlur={() => setDraft(null)}
      onChange={(e) => {
        const raw = e.target.value;
        if (raw.trim() === '') {
          setDraft('');
          return onCents(null);
        }
        const c = parseDollars(raw, { allowNegative: true, allowCents: true });
        if (c === null) return;
        setDraft(raw);
        if (raw.trim() !== '-') onCents(c);
      }}
    />
  );
}
