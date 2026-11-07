import { useState } from 'react';
import type { AccountType, Side, TAccountBuilderProps, TransactionRow } from '@contracts';
import { engine } from '@engine';

const TYPES: AccountType[] = ['asset', 'liability', 'equity', 'revenue', 'expense', 'dividend'];
const fmt = (cents: number) => `$${(cents / 100).toLocaleString('en-US')}`;

/**
 * PHASE-0 STUB builder: one table, rows × accounts, type-then-name picker, per-row Dr=Cr check.
 * UI workstream replaces this with the full T-account grid (VISION-2 §5).
 */
export function TAccountBuilder(props: TAccountBuilderProps) {
  const { accounts, rows, onRowsChange, coaOrder } = props;
  const [type, setType] = useState<AccountType | ''>('');
  const [accountId, setAccountId] = useState('');
  const [cols, setCols] = useState<{ accountId: string; type: AccountType }[]>(() => {
    const seen = new Map<string, AccountType>();
    for (const r of rows) for (const p of r.postings) if (p.chosenType) seen.set(p.accountId, p.chosenType);
    return [...seen].map(([id, t]) => ({ accountId: id, type: t }));
  });
  const ordered = engine.orderColumns(
    cols.map((c) => ({ ...c, contraOf: accounts.find((a) => a.id === c.accountId)?.contraOf })),
    coaOrder,
  );
  const nameOf = (id: string) => accounts.find((a) => a.id === id)?.name ?? id;
  const typeOfCol = (id: string) => cols.find((c) => c.accountId === id)?.type;

  const setCell = (ri: number, acct: string, side: Side, value: string) => {
    const amount = Math.round(Number(value || 0) * 100);
    const next: TransactionRow[] = rows.map((r, i) => {
      if (i !== ri) return r;
      const postings = r.postings.filter((p) => !(p.accountId === acct && p.side === side));
      if (amount > 0) postings.push({ accountId: acct, side, amount, chosenType: typeOfCol(acct) });
      return { ...r, postings };
    });
    onRowsChange(next);
  };
  const cell = (r: TransactionRow, acct: string, side: Side) =>
    r.postings.filter((p) => p.accountId === acct && p.side === side).reduce((s, p) => s + p.amount, 0);

  return (
    <div className="builder">
      <div className="picker">
        <select aria-label="Account type" value={type} onChange={(e) => setType(e.target.value as AccountType)}>
          <option value="">1. Type…</option>
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select aria-label="Account" value={accountId} disabled={!type} onChange={(e) => setAccountId(e.target.value)}>
          <option value="">2. Account…</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <button
          disabled={!type || !accountId}
          onClick={() => {
            setCols((c) => [...c.filter((x) => x.accountId !== accountId), { accountId, type: type as AccountType }]);
            setAccountId('');
            setType('');
          }}
        >
          Add T-account
        </button>
        <button onClick={() => onRowsChange([...rows, { id: `r${rows.length + 1}`, postings: [] }])}>Add row</button>
      </div>
      <table>
        <thead>
          <tr>
            <th>#</th>
            {ordered.map((c) => (
              <th key={c.accountId} colSpan={2}>
                {nameOf(c.accountId)} ({typeOfCol(c.accountId)})
              </th>
            ))}
            <th>Dr = Cr?</th>
          </tr>
          <tr>
            <th />
            {ordered.map((c) => [<th key={c.accountId + 'd'}>Dr</th>, <th key={c.accountId + 'c'}>Cr</th>])}
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => {
            const t = engine.rowTotals(r);
            return (
              <tr key={r.id}>
                <td>{ri + 1}</td>
                {ordered.map((c) =>
                  (['dr', 'cr'] as Side[]).map((side) => (
                    <td key={c.accountId + side}>
                      <input
                        aria-label={`Row ${ri + 1} ${nameOf(c.accountId)} ${side}`}
                        inputMode="decimal"
                        size={6}
                        value={cell(r, c.accountId, side) ? String(cell(r, c.accountId, side) / 100) : ''}
                        onChange={(e) => setCell(ri, c.accountId, side, e.target.value)}
                      />
                    </td>
                  )),
                )}
                <td>{t.balanced ? '✓' : `✗ ${fmt(t.dr)} / ${fmt(t.cr)}`}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
