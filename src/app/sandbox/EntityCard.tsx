import { useId, useState } from 'react';
import type { Account, AccountType, SandboxEntity } from '@contracts';
import { entities as contentEntities } from '@content';
import { TAccountBuilder } from '../../components/builder/TAccountBuilder';
import {
  ACCOUNT_TYPES,
  accountUsed,
  applyAccounts,
  applyTemplate,
  canonicalOrder,
  fmtMoney,
  moveInOrder,
  withColumnOrder,
  setOpening,
  summarize,
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
  const [journalView, setJournalView] = useState(false);
  const [showAccounts, setShowAccounts] = useState(false);
  const [showOpening, setShowOpening] = useState(false);
  const summary = summarize(entity);
  const coaOrder = entity.accounts.map((a) => a.id);
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
        <label className="sbx-check">
          <input type="checkbox" checked={journalView} onChange={(e) => setJournalView(e.target.checked)} />
          Journal view
        </label>
        <label className="sbx-check">
          <input
            type="checkbox"
            checked={!!entity.columnOrder}
            disabled={entity.accounts.length === 0}
            onChange={(e) => onChange(withColumnOrder(entity, e.target.checked ? canonicalOrder(entity) : undefined))}
          />
          Manual column order
        </label>
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
          journalView={journalView}
          columnOrder={entity.columnOrder}
          onColumnOrderChange={(order) => onChange(withColumnOrder(entity, order))}
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
  const manual = entity.columnOrder;
  const byId = new Map(entity.accounts.map((a) => [a.id, a]));
  const listed: Account[] = manual
    ? [
        ...manual.map((id) => byId.get(id)).filter((a): a is Account => !!a),
        ...entity.accounts.filter((a) => !manual.includes(a.id)),
      ]
    : entity.accounts;

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
              <tr key={a.id}>
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
                        onClick={() => onChange({ ...entity, columnOrder: moveInOrder(listedIds(listed), a.id, -1) })}
                      >
                        ←
                      </button>
                      <button
                        type="button"
                        className="btn"
                        aria-label={`Move ${a.name} right`}
                        disabled={i === listed.length - 1}
                        onClick={() => onChange({ ...entity, columnOrder: moveInOrder(listedIds(listed), a.id, 1) })}
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

const listedIds = (list: Account[]) => list.map((a) => a.id);

function OpeningEditor({ entity, onChange }: { entity: SandboxEntity; onChange(e: SandboxEntity): void }) {
  if (entity.accounts.length === 0) return <p className="note">Add accounts first.</p>;
  const amountOf = (id: string) => entity.opening?.lines.find((l) => l.accountId === id)?.amount;
  return (
    <div>
      <p className="note">Whole dollars, on each account’s normal side. Leave blank for zero.</p>
      <table className="sbx-table">
        <tbody>
          {entity.accounts.map((a) => {
            const amt = amountOf(a.id);
            return (
              <tr key={a.id}>
                <th scope="row">
                  {a.name} <span className="note">({typeLabel(a.type)})</span>
                </th>
                <td>
                  <input
                    aria-label={`Opening balance for ${a.name}`}
                    inputMode="numeric"
                    size={8}
                    value={amt === undefined ? '' : String(amt / 100)}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[$,\s]/g, '');
                      if (raw === '') return onChange(setOpening(entity, a.id, null));
                      if (!/^-?\d+$/.test(raw)) return;
                      onChange(setOpening(entity, a.id, Number(raw)));
                    }}
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
