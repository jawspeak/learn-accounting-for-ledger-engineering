/** Entity-level panels shared by the Sandbox views: checks summary, accounts list, opening balances,
 *  and the small account controls every view uses (type options, "reduces…", remove-with-confirm). */
import { createContext, Fragment, useContext, useId, useState } from 'react';
import type { Account, AccountId, AccountType, EntityBooks } from '@contracts';
import { engine } from '@engine';
import { accountLabel, useShowCodes } from './codes';
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
  orderMode,
  removeAccount,
  setOpening,
  summarize,
  typeResolver,
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

/** Lines (and opening balances) per scenario that use an account of the current entity. The host provides it;
 *  without one, only the books on screen are counted. */
export type AccountUsage = (accountId: AccountId) => number[];
export const AccountUsage = createContext<AccountUsage | null>(null);

/** Remove an account everywhere — asking first when any scenario posts to it (its lines go too). */
export function useRemoveAccount() {
  const usage = useContext(AccountUsage);
  return (e: EntityBooks, a: Account): EntityBooks | null => {
    const per = usage ? usage(a.id) : [linesUsing(e, a.id)];
    const n = per.reduce((t, x) => t + x, 0);
    const where = per.filter((x) => x > 0).length;
    if (
      n > 0 &&
      !window.confirm(
        `Remove ${a.name} and its ${n} line${n > 1 ? 's' : ''}${where > 1 ? ` in ${where} scenarios` : ''}?`,
      )
    )
      return null;
    return removeAccount(e, a.id);
  };
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
  entity: EntityBooks;
  onChange(e: EntityBooks): void;
}) {
  const uid = useId();
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('asset');
  const [contraOf, setContraOf] = useState<AccountId>();
  const [number, setNumber] = useState('');
  const show = useShowCodes();
  const manual = isManualOrder(entity);
  // Section headings only in the balance-sheet (Auto) order.
  const sections = orderMode(entity) === 'auto';
  /** GL numbers used more than once in this entity (flagged, not blocked). */
  const dupes = new Set(
    entity.accounts
      .map((a) => a.number?.trim())
      .filter((n, i, all): n is string => !!n && all.indexOf(n) !== i),
  );
  const isDupe = (a: Account) => !!a.number && dupes.has(a.number.trim());
  // The same order as the Grid's columns: balance-sheet order (auto) or the manual order.
  const listed = orderedAccounts(entity);
  const removeAsking = useRemoveAccount();

  const add = () => {
    const n = name.trim();
    if (!n) return;
    onChange(addAccount(entity, n, type, contraOf, number).entity);
    setName('');
    setNumber('');
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
              {show && <th scope="col">GL number</th>}
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
                {sections && (i === 0 || sectionOf(listed[i - 1]!.type) !== sectionOf(a.type)) && (
                  <tr className="sbx-section-row">
                    <th scope="rowgroup" colSpan={show ? 4 : 3}>
                      {SECTION_LABEL[sectionOf(a.type)]}
                    </th>
                  </tr>
                )}
                <tr>
                  {show && (
                    <td>
                      <input
                        className={`sbx-gl${isDupe(a) ? ' is-dupe' : ''}`}
                        aria-label={`GL number of ${a.name}`}
                        size={8}
                        value={a.number ?? ''}
                        title={
                          isDupe(a) ? 'Another account in this entity has this number' : undefined
                        }
                        onChange={(ev) =>
                          onChange(updateAccount(entity, a.id, { number: ev.target.value }))
                        }
                      />
                    </td>
                  )}
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
                        const next = removeAsking(entity, a);
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
        {show && (
          <input
            aria-label="New account GL number"
            placeholder="GL number"
            size={8}
            value={number}
            onChange={(e) => setNumber(e.target.value)}
          />
        )}
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

/** Balance-sheet groups for the opening balances: the three sections, and the income-statement accounts. */
type BsGroup = 'assets' | 'liabilities' | 'equity' | 'revenue' | 'expenses';
const groupOf = (t: AccountType): BsGroup => sectionOf(t);

export function OpeningEditor({
  entity,
  onChange,
}: {
  entity: EntityBooks;
  onChange(e: EntityBooks): void;
}) {
  const show = useShowCodes();
  if (entity.accounts.length === 0) return <p className="note">Add accounts first.</p>;
  const amountOf = (id: string) => entity.opening?.lines.find((l) => l.accountId === id)?.amount;
  const accounts = orderedAccounts(entity);
  const inGroup = (g: BsGroup) => accounts.filter((a) => groupOf(a.type) === g);
  const eq = engine.checkEquation(entity.opening ?? { lines: [] }, typeResolver(entity));
  const row = (a: Account) => (
    <tr key={a.id} className="sbx-bs-acct">
      <th scope="row">
        {accountLabel(a, show)}
        {(a.type.startsWith('contra-') || a.type === 'dividend' || a.type === 'expense') && (
          <span className="note"> ({typeLabel(a.type).toLowerCase()})</span>
        )}
      </th>
      <td className="sbx-bs-amt">
        <OpeningInput
          label={`Opening balance for ${a.name}`}
          cents={amountOf(a.id)}
          onCents={(c) => onChange(setOpening(entity, a.id, c))}
        />
      </td>
    </tr>
  );
  const total = (label: string, cents: number) => (
    <tr className="sbx-bs-total">
      <th scope="row">{label}</th>
      <td className="sbx-bs-amt">{formatDollars(cents)}</td>
    </tr>
  );
  const pnl = [...inGroup('revenue'), ...inGroup('expenses')];
  return (
    <div>
      <p className="note">
        The opening balance sheet: each account on its normal side (cents allowed; negative =
        abnormal). Blank or 0 means no opening balance.
      </p>
      {/* A balance sheet in report form: Assets, then Liabilities and Equity, each with its total. */}
      <table className="sbx-bs">
        <caption className="sr-only">Opening balance sheet</caption>
        <tbody>
          <tr className="sbx-bs-section">
            <th scope="rowgroup" colSpan={2}>
              Assets
            </th>
          </tr>
          {inGroup('assets').map(row)}
          {total('Total assets', eq.assets)}
        </tbody>
        <tbody>
          <tr className="sbx-bs-section">
            <th scope="rowgroup" colSpan={2}>
              Liabilities
            </th>
          </tr>
          {inGroup('liabilities').map(row)}
          {total('Total liabilities', eq.liabilities)}
        </tbody>
        <tbody>
          <tr className="sbx-bs-section">
            <th scope="rowgroup" colSpan={2}>
              Equity
            </th>
          </tr>
          {inGroup('equity').map(row)}
          {pnl.length > 0 && (
            <>
              {/* Income-statement accounts roll into equity; at the start of a period they're usually 0. */}
              <tr className="sbx-bs-sub">
                <th scope="rowgroup" colSpan={2}>
                  Revenue &amp; expenses <span className="note">(usually 0 at the start)</span>
                </th>
              </tr>
              {pnl.map(row)}
            </>
          )}
          {total('Total equity', eq.equity)}
        </tbody>
        <tfoot>
          {total('Total liabilities + equity', eq.liabilities + eq.equity)}
          <tr className="sbx-bs-check">
            <td colSpan={2}>
              <Mark ok={eq.balanced} /> A = L + E
              {eq.balanced
                ? ''
                : ` — off by ${formatDollars(Math.abs(eq.assets - eq.liabilities - eq.equity))}`}
            </td>
          </tr>
        </tfoot>
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
