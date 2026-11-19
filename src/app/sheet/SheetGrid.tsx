import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import type { Account, AccountType, BalanceSheet, Money, SandboxEntity, Side } from '@contracts';
import { engine } from '@engine';
import { cellAmount, formatDollars, parseDollars } from '../../components/builder/model';
import { ACCOUNT_TYPES } from '../sandbox/model';
import {
  addAccount,
  contraBase,
  contraCandidates,
  equalsAt,
  moveAccount,
  removeAccount,
  setAmount,
  setLabel,
  setOpening,
  sheetBalance,
  toneOf,
  updateAccount,
  visibleRowCount,
} from './model';

const SIDES: Side[] = ['dr', 'cr'];
const SIDE_WORD: Record<Side, string> = { dr: 'debit', cr: 'credit' };
/** Nav columns: 0 = event label, then two per account (Dr, Cr). */
const FIRST_AMOUNT_COL = 1;
/** Frozen left block: #, Event, Dr = Cr? */
const LEFT_COLS = 3;

/**
 * The grid itself. Every editable cell carries `data-nav="row:col"`; arrow keys / Enter move between them like a
 * spreadsheet (Left/Right only once the caret is at the edge of the text, so editing still works).
 */
export function SheetGrid({
  entity: e,
  onChange,
}: {
  entity: SandboxEntity;
  onChange(e: SandboxEntity): void;
}) {
  const tableRef = useRef<HTMLTableElement>(null);
  const [showOpening, setShowOpening] = useState(() => !!e.opening);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<AccountType>('asset');

  const accounts = e.accounts;
  const n = visibleRowCount(e.rows);
  const balance = sheetBalance(e);
  const eqAt = equalsAt(accounts);
  const lastCol = FIRST_AMOUNT_COL + accounts.length * 2 - 1;

  const focusCell = (r: number, c: number) => {
    const el = tableRef.current?.querySelector<HTMLElement>(`[data-nav="${r}:${c}"]`);
    if (!el) return false;
    el.focus();
    if (el instanceof HTMLInputElement && el.type === 'text') el.select();
    return true;
  };

  const onNav = (ev: KeyboardEvent<HTMLElement>) => {
    const t = ev.target as HTMLElement;
    const nav = t.getAttribute('data-nav');
    if (!nav) return;
    const [r, c] = nav.split(':').map(Number) as [number, number];
    const text = t instanceof HTMLInputElement && t.type === 'text' ? t : null;
    const atStart = !text || (text.selectionStart === 0 && text.selectionEnd === 0);
    const atEnd =
      !text ||
      (text.selectionStart === text.value.length && text.selectionEnd === text.value.length);
    let to: [number, number] | null = null;
    if (ev.key === 'ArrowDown' || (ev.key === 'Enter' && !ev.shiftKey)) to = [r + 1, c];
    else if (ev.key === 'ArrowUp' || (ev.key === 'Enter' && ev.shiftKey)) to = [r - 1, c];
    else if (ev.key === 'ArrowLeft' && atStart) to = [r, c - 1];
    else if (ev.key === 'ArrowRight' && atEnd) to = [r, c + 1];
    if (!to) return;
    const [nr, nc] = to;
    if (nr < 0 || nr >= n || nc < 0 || nc > lastCol) return;
    if (focusCell(nr, nc)) ev.preventDefault();
  };

  const add = () => {
    const name = newName.trim();
    if (!name) return;
    const { entity } = addAccount(e, name, newType);
    onChange(entity);
    setNewName('');
    // Jump to the new column's first debit cell, ready to type an amount.
    const col = FIRST_AMOUNT_COL + accounts.length * 2;
    setTimeout(() => focusCell(0, col));
  };

  const remove = (a: Account) => {
    const used = e.rows.some((r) => r.postings.some((p) => p.accountId === a.id));
    if (used && !window.confirm(`Remove ${a.name} and its amounts?`)) return;
    onChange(removeAccount(e, a.id));
  };

  /** Divider classes: a double rule before the first right-hand account (A ‖ = ‖ L + E), a rule between T's. */
  const colCls = (i: number, side?: Side) =>
    [
      'sh-col',
      `sh-tone-${toneOf(accounts[i]!.type)}`,
      side && `sh-${side}`,
      (side ?? 'dr') === 'dr' && (i === eqAt ? 'sh-eq-start' : 'sh-t-start'),
    ]
      .filter(Boolean)
      .join(' ');

  const balanceCells = (bs: BalanceSheet, key: string) =>
    accounts.map((a, i) => {
      const amt = bs.lines.find((l) => l.accountId === a.id)?.amount ?? 0;
      const normal = engine.normalSide(a.type);
      const shown: Side = amt < 0 ? (normal === 'dr' ? 'cr' : 'dr') : normal;
      return SIDES.map((s) => (
        <td key={`${key}-${a.id}-${s}`} className={`${colCls(i, s)} sh-num sh-bal`}>
          {s === shown ? formatDollars(Math.abs(amt)) : formatDollars(0)}
          {s === shown && amt < 0 && <span className="sh-abnormal"> (abnormal)</span>}
        </td>
      ));
    });

  const headRow = (label: string, cells: (a: Account, i: number) => ReactNode, className = '') => (
    <tr className={className}>
      <th scope="row" colSpan={LEFT_COLS} className="sh-left sh-head-label">
        {label}
      </th>
      {accounts.map((a, i) => (
        <th key={a.id} colSpan={2} className={`${colCls(i)} sh-head`} data-col={a.id}>
          {cells(a, i)}
        </th>
      ))}
      {/* the "Add account" cell spans these header rows */}
    </tr>
  );

  return (
    <div
      className="sh-scroll"
      role="region"
      aria-label="Spreadsheet: events and T-accounts"
      tabIndex={0}
    >
      <table className="sh-grid" ref={tableRef} onKeyDown={onNav}>
        <caption className="sr-only">
          Events are rows; each account has a debit and a credit column. Arrow keys and Enter move
          between cells.
        </caption>
        <colgroup>
          <col className="sh-w-num" />
          <col className="sh-w-event" />
          <col className="sh-w-check" />
          {accounts.map((a) => SIDES.map((s) => <col key={`${a.id}-${s}`} className="sh-w-amt" />))}
          <col className="sh-w-add" />
        </colgroup>
        <thead>
          <tr className="sh-names">
            <th scope="col" colSpan={LEFT_COLS} className="sh-left sh-corner">
              <span className="sh-corner-title">Accounts</span>
            </th>
            {accounts.map((a, i) => (
              <th
                key={a.id}
                scope="colgroup"
                colSpan={2}
                className={`${colCls(i)} sh-head`}
                data-col={a.id}
              >
                <div className="sh-name-row">
                  <NameInput
                    name={a.name}
                    onCommit={(name) => onChange(updateAccount(e, a.id, { name }))}
                  />
                </div>
                <div className="sh-col-tools">
                  <button
                    type="button"
                    aria-label={`Move ${a.name} left`}
                    disabled={i === 0}
                    onClick={() => onChange(moveAccount(e, a.id, -1))}
                  >
                    <span aria-hidden="true">◀</span>
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${a.name} right`}
                    disabled={i === accounts.length - 1}
                    onClick={() => onChange(moveAccount(e, a.id, 1))}
                  >
                    <span aria-hidden="true">▶</span>
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove ${a.name}`}
                    title="Remove this account"
                    onClick={() => remove(a)}
                  >
                    <span aria-hidden="true">×</span>
                  </button>
                </div>
              </th>
            ))}
            {/* spans the name, label, type and debit/credit header rows */}
            <th rowSpan={4} className="sh-add-col sh-add">
              <form
                onSubmit={(ev) => {
                  ev.preventDefault();
                  add();
                }}
              >
                <strong>Add account</strong>
                <input
                  aria-label="New account name"
                  placeholder="Name"
                  value={newName}
                  onChange={(ev) => setNewName(ev.target.value)}
                />
                <select
                  aria-label="New account type"
                  value={newType}
                  onChange={(ev) => setNewType(ev.target.value as AccountType)}
                >
                  {ACCOUNT_TYPES.map((t) => (
                    <option
                      key={t.type}
                      value={t.type}
                      disabled={
                        !!contraBase(t.type) && contraCandidates(accounts, t.type).length === 0
                      }
                    >
                      {t.label}
                    </option>
                  ))}
                </select>
                <button type="submit" className="btn" disabled={!newName.trim()}>
                  ＋ Add
                </button>
              </form>
            </th>
          </tr>
          {headRow('Label', (a) => (
            <input
              className="sh-subtitle"
              aria-label={`${a.name} label`}
              placeholder="label"
              value={a.subtitle ?? ''}
              onChange={(ev) => onChange(updateAccount(e, a.id, { subtitle: ev.target.value }))}
            />
          ))}
          {headRow('Account type', (a) => (
            <div className="sh-type-cell">
              <select
                className={`sh-type sh-tone-${toneOf(a.type)}`}
                aria-label={`${a.name} account type`}
                value={a.type}
                onChange={(ev) =>
                  onChange(updateAccount(e, a.id, { type: ev.target.value as AccountType }))
                }
              >
                {ACCOUNT_TYPES.map((t) => (
                  <option
                    key={t.type}
                    value={t.type}
                    disabled={
                      !!contraBase(t.type) && contraCandidates(accounts, t.type, a.id).length === 0
                    }
                  >
                    {t.label}
                  </option>
                ))}
              </select>
              {contraBase(a.type) && (
                <label className="sh-contra">
                  reduces{' '}
                  <select
                    value={a.contraOf ?? ''}
                    onChange={(ev) =>
                      onChange(updateAccount(e, a.id, { contraOf: ev.target.value }))
                    }
                  >
                    {contraCandidates(accounts, a.type, a.id).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          ))}
          <tr className="sh-sides">
            <th scope="col" className="sh-left sh-l1">
              #
            </th>
            <th scope="col" className="sh-left sh-l2">
              Event
            </th>
            <th scope="col" className="sh-left sh-l4">
              Dr = Cr?
            </th>
            {accounts.map((a, i) =>
              SIDES.map((s) => {
                // ▲ marks the side that increases this account (its normal side), in place of a
                // separate "normal balance" row.
                const up = s === engine.normalSide(a.type);
                return (
                  <th
                    key={`${a.id}-${s}`}
                    scope="col"
                    className={colCls(i, s)}
                    title={up ? `${a.name} increases with a ${SIDE_WORD[s]}` : undefined}
                  >
                    <span aria-hidden="true">
                      {SIDE_WORD[s]}
                      {up && <span className="sh-up"> ▲</span>}
                    </span>
                    <span className="sr-only">
                      {a.name} {SIDE_WORD[s]}
                      {up ? ' (increases)' : ''}
                    </span>
                  </th>
                );
              }),
            )}
          </tr>
          {showOpening && (
            <tr className="sh-opening">
              <th scope="row" colSpan={LEFT_COLS} className="sh-left sh-head-label">
                Opening balance
              </th>
              {accounts.map((a, i) => {
                const amt = e.opening?.lines.find((l) => l.accountId === a.id)?.amount ?? 0;
                const normal = engine.normalSide(a.type);
                return SIDES.map((s) => (
                  <td key={`${a.id}-${s}`} className={`${colCls(i, s)} sh-num`}>
                    {s === normal && (
                      <MoneyCell
                        label={`Opening balance ${a.name}`}
                        cents={amt}
                        allowNegative
                        onChange={(c) => onChange(setOpening(e, a.id, c))}
                      />
                    )}
                  </td>
                ));
              })}
              <td className="sh-add-col" />
            </tr>
          )}
          <tr className="sh-balance">
            <th scope="row" colSpan={LEFT_COLS} className="sh-left sh-head-label">
              Balance
              <button
                type="button"
                className="sh-link"
                onClick={() => setShowOpening((o) => !o)}
                aria-pressed={showOpening}
              >
                {showOpening ? 'hide opening row' : '+ opening balances'}
              </button>
            </th>
            {balanceCells(balance, 'balance')}
            <td className="sh-add-col" />
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: n }, (_, ri) => {
            const row = e.rows[ri];
            const totals = row ? engine.rowTotals(row) : null;
            const used = !!row && row.postings.length > 0;
            return (
              // Keyed by position: typing into a blank row creates it, and the row must not remount (focus would drop).
              <tr key={ri} data-row={ri}>
                <th scope="row" className="sh-left sh-l1 sh-rownum">
                  {ri + 1}
                </th>
                <td className="sh-left sh-l2">
                  <input
                    className="sh-event"
                    data-nav={`${ri}:0`}
                    aria-label={`Row ${ri + 1} event`}
                    placeholder={ri === 0 && !row?.label ? 'What happened?' : ''}
                    value={row?.label ?? ''}
                    onChange={(ev) => onChange(setLabel(e, ri, ev.target.value))}
                  />
                </td>
                <td className="sh-left sh-l4 sh-check">
                  {used &&
                    (totals!.balanced ? (
                      <span className="is-ok">
                        <span aria-hidden="true">✓</span>
                        <span className="sr-only">Balanced</span>
                      </span>
                    ) : (
                      <span
                        className="is-bad"
                        title={`Dr ${formatDollars(totals!.dr)} ≠ Cr ${formatDollars(totals!.cr)}`}
                      >
                        <span aria-hidden="true">✗</span>{' '}
                        {formatDollars(Math.abs(totals!.dr - totals!.cr))}
                        <span className="sr-only">
                          {' '}
                          Unbalanced: debits {formatDollars(totals!.dr)}, credits{' '}
                          {formatDollars(totals!.cr)}
                        </span>
                      </span>
                    ))}
                </td>
                {accounts.map((a, i) =>
                  SIDES.map((s, si) => (
                    <td key={`${a.id}-${s}`} className={`${colCls(i, s)} sh-num`}>
                      <MoneyCell
                        nav={`${ri}:${FIRST_AMOUNT_COL + i * 2 + si}`}
                        label={`Row ${ri + 1} ${a.name} ${SIDE_WORD[s]}`}
                        cents={row ? cellAmount(row, a.id, s) : 0}
                        onChange={(c) => onChange(setAmount(e, ri, a.id, s, c))}
                      />
                    </td>
                  )),
                )}
                <td className="sh-add-col" />
              </tr>
            );
          })}
        </tbody>
      </table>
      {accounts.length === 0 && (
        <p className="sh-empty">
          Add your first account on the right — start with the one you’re sure changes (often{' '}
          <strong>Cash</strong>).
        </p>
      )}
    </div>
  );
}

/** Account name: free editing (it may be blank while retyping); only non-blank names are saved. */
function NameInput({ name, onCommit }: { name: string; onCommit(name: string): void }) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      className="sh-name"
      aria-label={`Account name: ${name}`}
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

/** A money cell: "$1,200" at rest, a plain number while editing; non-numeric keystrokes are rejected. */
function MoneyCell({
  cents,
  onChange,
  label,
  nav,
  allowNegative,
}: {
  cents: Money;
  onChange(c: Money): void;
  label: string;
  nav?: string;
  allowNegative?: boolean;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const rest = cents === 0 ? '' : cents < 0 ? `−${formatDollars(-cents)}` : formatDollars(cents);
  return (
    <input
      type="text"
      inputMode={allowNegative ? 'text' : 'decimal'}
      autoComplete="off"
      className="sh-amt"
      data-nav={nav}
      aria-label={label}
      value={draft ?? rest}
      onFocus={() => setDraft(cents === 0 ? '' : String(cents / 100))}
      onBlur={() => setDraft(null)}
      onChange={(ev) => {
        const parsed = parseDollars(ev.target.value, { allowNegative });
        if (parsed === null) return;
        setDraft(ev.target.value);
        if (parsed !== cents) onChange(parsed);
      }}
    />
  );
}
