import { Fragment, useId, useState } from 'react';
import type { Account, AccountType, SandboxEntity } from '@contracts';
import { entities as contentEntities } from '@content';
import { TAccountBuilder } from '../../components/builder/TAccountBuilder';
import { formatDollars, parseDollars } from '../../components/builder/model';
import { ColumnOrderToggle } from './ColumnOrderToggle';
import {
  ACCOUNT_TYPES,
  accountUsed,
  applyAccounts,
  applyTemplate,
  fmtMoney,
  isManualOrder,
  moveAccountInOrder,
  orderedAccounts,
  setManualOrder,
  setOpening,
  summarize,
  withColumnOrder,
} from './model';

interface Props {
  entity: SandboxEntity;
  /** Changes when a whole new board is loaded, so the builder remounts. */
  builderKey: string;
  onChange(next: SandboxEntity): void;
  onDuplicate(): void;
  onRemove(): void;
}

const typeLabel = (t: AccountType) => ACCOUNT_TYPES.find((x) => x.type === t)?.label ?? t;

export function EntityCard({ entity, builderKey, onChange, onDuplicate, onRemove }: Props) {
  const uid = useId();
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [showAccounts, setShowAccounts] = useState(false);
  const [showOpening, setShowOpening] = useState(false);
  const summary = summarize(entity);
  const coaOrder = entity.accounts.map((a) => a.id);
  const manual = isManualOrder(entity);
  const setAccounts = (accounts: Account[]) => onChange(applyAccounts(entity, accounts));

  return (
    <section className="sbx-entity" aria-label={`Entity: ${entity.name || 'unnamed'}`}>
      <header className="sbx-entity-head">
        <label className="sr-only" htmlFor={`${uid}-name`}>
          Entity name
        </label>
        <input
          id={`${uid}-name`}
          className="sbx-entity-name"
          value={entity.name}
          placeholder="Entity name"
          onChange={(e) => onChange({ ...entity, name: e.target.value })}
        />
        <div className="sbx-entity-actions">
          <button type="button" className="btn" onClick={onDuplicate}>
            Duplicate
          </button>
          {confirmRemove ? (
            <span className="sbx-confirm" role="group" aria-label="Confirm remove entity">
              Remove?
              <button type="button" className="btn" onClick={onRemove}>
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
      </header>

      <EntitySummaryLine summary={summary} rows={entity.rows.length} />

      <div className="sbx-entity-opts">
        <TemplatePicker onPick={(id) => contentEntities[id] && onChange(applyTemplate(entity, contentEntities[id]))} />
        <label className="sbx-check">
          <input
            type="checkbox"
            checked={entity.showBalanceSheets}
            onChange={(e) => onChange({ ...entity, showBalanceSheets: e.target.checked })}
          />
          Show balance sheets
        </label>
        <ColumnOrderToggle
          manual={manual}
          disabled={entity.accounts.length === 0}
          onChange={(m) => onChange(setManualOrder(entity, m))}
        />
      </div>

      <div className="sbx-builder table-scroll">
        <TAccountBuilder
          key={builderKey}
          mode="sandbox"
          accounts={entity.accounts}
          coaOrder={coaOrder}
          rows={entity.rows}
          onRowsChange={(rows) => onChange({ ...entity, rows })}
          onAccountsChange={setAccounts}
          showBalanceSheets={entity.showBalanceSheets}
          opening={entity.opening}
          // The builder's "Journal view" toggle button is always available in the sandbox.
          journalView
          // Manual order only: then ◀ ▶ (and drag) reorder the same order the Spreadsheet uses.
          columnOrder={entity.columnOrder}
          onColumnOrderChange={manual ? (order) => onChange(withColumnOrder(entity, order)) : undefined}
        />
      </div>

      <details className="sbx-panel" open={showAccounts} onToggle={(e) => setShowAccounts(e.currentTarget.open)}>
        <summary>Accounts ({entity.accounts.length})</summary>
        <AccountsEditor entity={entity} onAccounts={setAccounts} onChange={onChange} />
      </details>

      <details className="sbx-panel" open={showOpening} onToggle={(e) => setShowOpening(e.currentTarget.open)}>
        <summary>
          Opening balances{entity.opening ? ` (${entity.opening.lines.length})` : ''}
        </summary>
        <OpeningEditor entity={entity} onChange={onChange} />
      </details>
    </section>
  );
}

function Mark({ ok }: { ok: boolean }) {
  return (
    <span className={ok ? 'sbx-ok' : 'sbx-err'} aria-hidden="true">
      {ok ? '✓' : '✗'}
    </span>
  );
}

function EntitySummaryLine({ summary, rows }: { summary: ReturnType<typeof summarize>; rows: number }) {
  const eq = summary.equation;
  return (
    <p className="sbx-summary" aria-live="polite">
      <span>
        <Mark ok={summary.rowsBalanced} />{' '}
        {summary.rowsBalanced
          ? `Rows balanced (${rows})`
          : `Unbalanced row${summary.unbalancedRows.length > 1 ? 's' : ''}: ${summary.unbalancedRows.join(', ')}`}
      </span>
      <span>
        <Mark ok={eq.balanced} /> A = L + E: {fmtMoney(eq.assets)} {eq.balanced ? '=' : '≠'}{' '}
        {fmtMoney(eq.liabilities)} + {fmtMoney(eq.equity)}
      </span>
      {summary.opening && !summary.opening.balanced && (
        <span className="sbx-err">Opening balances don’t satisfy A = L + E</span>
      )}
    </p>
  );
}

function TemplatePicker({ onPick }: { onPick(entityId: string): void }) {
  const list = Object.values(contentEntities).sort((a, b) =>
    a.id === 'you' ? -1 : b.id === 'you' ? 1 : a.name.localeCompare(b.name),
  );
  return (
    <label className="sbx-inline">
      Start from a template:
      <select
        value=""
        onChange={(e) => {
          if (e.target.value) onPick(e.target.value);
        }}
      >
        <option value="">Choose…</option>
        {list.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name} ({c.accounts.length} accounts)
          </option>
        ))}
      </select>
    </label>
  );
}

function AccountsEditor({
  entity,
  onAccounts,
  onChange,
}: {
  entity: SandboxEntity;
  onAccounts(a: Account[]): void;
  onChange(e: SandboxEntity): void;
}) {
  const uid = useId();
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('asset');
  const [contraOf, setContraOf] = useState('');
  const isContra = type.startsWith('contra-');
  const manual = isManualOrder(entity);
  const byId = new Map(entity.accounts.map((a) => [a.id, a]));
  // The same order as the columns: balance-sheet order (auto) or the manual order.
  const listed = orderedAccounts(entity);

  const add = () => {
    const n = name.trim();
    if (!n) return;
    const acct: Account = { id: `new-${Date.now()}`, name: n, type };
    if (type === 'equity') acct.equityGroup = 'paid-in';
    if (isContra && contraOf) acct.contraOf = contraOf;
    const next = applyAccounts(entity, [...entity.accounts, acct]);
    if (next.columnOrder) next.columnOrder = [...next.columnOrder, next.accounts[next.accounts.length - 1]!.id];
    onChange(next);
    setName('');
    setContraOf('');
  };
  const update = (id: string, patch: Partial<Account>) =>
    onAccounts(entity.accounts.map((a) => (a.id === id ? { ...a, ...patch } : a)));

  return (
    <div className="sbx-accounts">
      {listed.length === 0 ? (
        <p className="note">No accounts yet — add one below, create one in the builder, or start from a template.</p>
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
                  <input
                    aria-label={`Name of ${a.name}`}
                    value={a.name}
                    title={a.description}
                    onChange={(e) => update(a.id, { name: e.target.value })}
                  />
                </td>
                <td>
                  {typeLabel(a.type)}
                  {a.type === 'equity' && ` (${a.equityGroup === 'retained' ? 'retained' : 'paid-in'})`}
                  {a.contraOf && ` of ${byId.get(a.contraOf)?.name ?? a.contraOf}`}
                </td>
                <td className="sbx-row-actions">
                  {manual && (
                    <>
                      <button
                        type="button"
                        className="btn"
                        aria-label={`Move ${a.name} left`}
                        disabled={i === 0}
                        onClick={() => onChange(moveAccountInOrder(entity, a.id, -1))}
                      >
                        ←
                      </button>
                      <button
                        type="button"
                        className="btn"
                        aria-label={`Move ${a.name} right`}
                        disabled={i === listed.length - 1}
                        onClick={() => onChange(moveAccountInOrder(entity, a.id, 1))}
                      >
                        →
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    className="btn"
                    aria-label={`Delete ${a.name}`}
                    disabled={accountUsed(entity, a.id)}
                    title={accountUsed(entity, a.id) ? 'Used in a row (or as a contra parent) — remove those first' : undefined}
                    onClick={() => onAccounts(entity.accounts.filter((x) => x.id !== a.id))}
                  >
                    Delete
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
        <input id={`${uid}-n`} placeholder="New account name" value={name} onChange={(e) => setName(e.target.value)} />
        <label htmlFor={`${uid}-t`} className="sr-only">
          New account type
        </label>
        <select id={`${uid}-t`} value={type} onChange={(e) => setType(e.target.value as AccountType)}>
          {ACCOUNT_TYPES.map((t) => (
            <option key={t.type} value={t.type}>
              {t.label}
            </option>
          ))}
        </select>
        {isContra && (
          <select aria-label="Reduces account" value={contraOf} onChange={(e) => setContraOf(e.target.value)}>
            <option value="">Reduces…</option>
            {entity.accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        )}
        <button type="submit" className="btn" disabled={!name.trim()}>
          Add account
        </button>
      </form>
    </div>
  );
}

/** Balance-sheet sections for the Accounts list headings (income-statement accounts sit inside equity). */
type BsSection = 'assets' | 'liabilities' | 'equity' | 'revenue' | 'expenses';
const SECTION_LABEL: Record<BsSection, string> = {
  assets: 'Assets',
  liabilities: 'Liabilities',
  equity: 'Equity',
  revenue: 'Revenue',
  expenses: 'Expenses & dividends',
};
function sectionOf(t: AccountType): BsSection {
  if (t === 'asset' || t === 'contra-asset') return 'assets';
  if (t === 'liability' || t === 'contra-liability') return 'liabilities';
  if (t === 'revenue' || t === 'contra-revenue') return 'revenue';
  if (t === 'expense' || t === 'dividend') return 'expenses';
  return 'equity';
}

function OpeningEditor({ entity, onChange }: { entity: SandboxEntity; onChange(e: SandboxEntity): void }) {
  if (entity.accounts.length === 0) return <p className="note">Add accounts first.</p>;
  const amountOf = (id: string) => entity.opening?.lines.find((l) => l.accountId === id)?.amount;
  return (
    <div>
      <p className="note">On each account’s normal side (cents allowed). Leave blank for zero.</p>
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
        <button type="button" className="btn" onClick={() => onChange(setOpening({ ...entity, opening: undefined }, '', null))}>
          Clear opening balances
        </button>
      )}
    </div>
  );
}

/** Opening balance: dollars and cents, negative allowed (an abnormal balance); blank clears the line. */
function OpeningInput({ label, cents, onCents }: { label: string; cents?: number; onCents(c: number | null): void }) {
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
