import { useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import type { Account, AccountType, BalanceSheet, Money, SandboxEntity, Side } from '@contracts';
import { engine } from '@engine';
import { cellAmount, formatDollars, parseDollars } from '../../components/builder/model';
import {
  addAccount,
  addEntry,
  entryCheck,
  isManualOrder,
  moveAccountInOrder,
  moveRow,
  nextRowId,
  orderedAccounts,
  orderedIds,
  removeRow,
  setOpening,
  updateAccount,
} from '../model';
import { ContraParentSelect, removeAccountAsking, TypeOptions } from '../PartyPanels';
import { equalsAt, setAmount, setLabel, sheetBalance, toneOf } from './model';

const SIDES: Side[] = ['dr', 'cr'];
const SIDE_WORD: Record<Side, string> = { dr: 'debit', cr: 'credit' };
/** Nav columns: 0 = event label, then two per account (Dr, Cr). */
const FIRST_AMOUNT_COL = 1;
/** Frozen left block: #, Description, Dr = Cr? */
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
  const [descWidth, setDescWidth] = useStoredWidth();
  const [showOpening, setShowOpening] = useState(() => !!e.opening);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<AccountType>('asset');

  // One account order for every view: auto (A = L + E) or the manual order; ← → only in manual.
  const accounts = orderedAccounts(e);
  const manual = isManualOrder(e);
  // The same entries as the Journal — no padding rows; "+ Add entry" adds one. With no entries yet, one blank
  // placeholder entry is shown so there's somewhere to type; it isn't in the state (or a link) until you do.
  const placeholder = e.rows.length === 0;
  const rows = placeholder ? [{ id: nextRowId([]), postings: [] }] : e.rows;
  const n = rows.length;
  /** The entity with entry `ri` stored (typing into the placeholder creates it). */
  const stored = (ri: number) => (ri < e.rows.length ? e : addEntry(e, { blankLines: false }));
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
    const { entity, id } = addAccount(e, name, newType);
    onChange(entity);
    setNewName('');
    // Jump to the new column's first debit cell (auto order may place it mid-grid), ready to type.
    const col = FIRST_AMOUNT_COL + orderedIds(entity).indexOf(id) * 2;
    setTimeout(() => focusCell(0, col));
  };

  const remove = (a: Account) => {
    const next = removeAccountAsking(e, a);
    if (next) onChange(next);
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
      // The Description column's width (drag its edge); every sticky offset follows the variable.
      style={descWidth ? ({ '--sh-w2': `${descWidth}px` } as CSSProperties) : undefined}
    >
      <table className="sh-grid" ref={tableRef} onKeyDown={onNav}>
        <caption className="sr-only">
          Journal entries are rows; each account has a debit and a credit column. Arrow keys and
          Enter move between cells.
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
                  {manual && (
                    <>
                      <button
                        type="button"
                        aria-label={`Move ${a.name} left`}
                        disabled={i === 0}
                        onClick={() => onChange(moveAccountInOrder(e, a.id, -1))}
                      >
                        <span aria-hidden="true">←</span>
                      </button>
                      <button
                        type="button"
                        aria-label={`Move ${a.name} right`}
                        disabled={i === accounts.length - 1}
                        onClick={() => onChange(moveAccountInOrder(e, a.id, 1))}
                      >
                        <span aria-hidden="true">→</span>
                      </button>
                    </>
                  )}
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
                  <TypeOptions accounts={accounts} />
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
                <TypeOptions accounts={accounts} self={a.id} />
              </select>
              <ContraParentSelect
                label={`Account ${a.name} reduces`}
                accounts={accounts}
                type={a.type}
                self={a.id}
                value={a.contraOf}
                onChange={(id) => onChange(updateAccount(e, a.id, { contraOf: id }))}
              />
            </div>
          ))}
          <tr className="sh-sides">
            <th scope="col" className="sh-left sh-l1">
              #
            </th>
            <th scope="col" className="sh-left sh-l2">
              Description
              <ColumnResizer width={descWidth} onWidth={setDescWidth} />
            </th>
            <th scope="col" className="sh-left sh-l4">
              Dr = Cr?
            </th>
            {accounts.map((a, i) =>
              SIDES.map((s) => {
                // "Dr ▲ / Cr", as on every T: ▲ marks the side that increases this account (its normal side).
                const up = s === engine.normalSide(a.type);
                return (
                  <th
                    key={`${a.id}-${s}`}
                    scope="col"
                    className={colCls(i, s)}
                    title={up ? `${a.name} increases with a ${SIDE_WORD[s]}` : undefined}
                  >
                    <span aria-hidden="true">
                      {s === 'dr' ? 'Dr' : 'Cr'}
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
        </thead>
        <tbody>
          {rows.map((row, ri) => {
            const n1 = ri + 1;
            const check = entryCheck(row);
            return (
              <tr key={row.id} data-row={ri}>
                <th scope="row" className="sh-left sh-l1 sh-rownum">
                  {n1}
                </th>
                <td className="sh-left sh-l2">
                  <input
                    className="sh-event"
                    data-nav={`${ri}:0`}
                    aria-label={`Entry ${n1} description`}
                    placeholder={row.label ? '' : 'What happened?'}
                    value={row.label ?? ''}
                    onChange={(ev) => onChange(setLabel(stored(ri), ri, ev.target.value))}
                  />
                  {/* Entry tools (the same entries as the Journal): move up / down, remove. */}
                  {!placeholder && (
                    <span className="sh-row-tools">
                      <button
                        type="button"
                        aria-label={`Move entry ${n1} up`}
                        disabled={ri === 0}
                        onClick={() => onChange(moveRow(e, ri, -1))}
                      >
                        <span aria-hidden="true">↑</span>
                      </button>
                      <button
                        type="button"
                        aria-label={`Move entry ${n1} down`}
                        disabled={ri >= e.rows.length - 1}
                        onClick={() => onChange(moveRow(e, ri, 1))}
                      >
                        <span aria-hidden="true">↓</span>
                      </button>
                      <button
                        type="button"
                        aria-label={`Remove entry ${n1}`}
                        title="Remove this entry"
                        onClick={() => onChange(removeRow(e, ri))}
                      >
                        <span aria-hidden="true">×</span>
                      </button>
                    </span>
                  )}
                </td>
                <td className="sh-left sh-l4 sh-check">
                  {check.started &&
                    (check.balanced ? (
                      <span className="is-ok">
                        <span aria-hidden="true">✓</span>
                        <span className="sr-only">Balanced</span>
                      </span>
                    ) : check.missingAccount ? (
                      <span className="is-bad" title="A line has no account yet (see the Journal)">
                        <span aria-hidden="true">✗</span>
                        <span className="sr-only"> A line has no account yet</span>
                      </span>
                    ) : (
                      <span
                        className="is-bad"
                        title={`Dr ${formatDollars(check.dr)} ≠ Cr ${formatDollars(check.cr)}`}
                      >
                        <span aria-hidden="true">✗</span>{' '}
                        {formatDollars(Math.abs(check.dr - check.cr))}
                        <span className="sr-only">
                          {' '}
                          Unbalanced: debits {formatDollars(check.dr)}, credits{' '}
                          {formatDollars(check.cr)}
                        </span>
                      </span>
                    ))}
                </td>
                {accounts.map((a, i) =>
                  SIDES.map((s, si) => (
                    <td key={`${a.id}-${s}`} className={`${colCls(i, s)} sh-num`}>
                      <MoneyCell
                        nav={`${ri}:${FIRST_AMOUNT_COL + i * 2 + si}`}
                        label={`Entry ${n1} ${a.name} ${SIDE_WORD[s]}`}
                        cents={cellAmount(row, a.id, s)}
                        lines={
                          row.postings.filter(
                            (p) => p.accountId === a.id && p.side === s && p.amount > 0,
                          ).length
                        }
                        onChange={(c) => onChange(setAmount(stored(ri), ri, a.id, s, c))}
                      />
                    </td>
                  )),
                )}
                <td className="sh-add-col" />
              </tr>
            );
          })}
        </tbody>
        {/* Balances at the bottom, like the total under each T: opening (if shown at the top) + every entry. */}
        <tfoot>
          <tr className="sh-balance">
            <th scope="row" colSpan={LEFT_COLS} className="sh-left sh-head-label">
              Balance
            </th>
            {balanceCells(balance, 'balance')}
            <td className="sh-add-col" />
          </tr>
        </tfoot>
      </table>
      <div className="sh-below">
        <button
          type="button"
          className="sh-add-row"
          onClick={() => {
            // From the placeholder, keep it (now stored) and add the next one below it.
            onChange(addEntry(stored(n - 1), { blankLines: false }));
            setTimeout(() => focusCell(n, 0));
          }}
        >
          <span aria-hidden="true">＋ </span>Add entry
        </button>
        <button
          type="button"
          className="sh-add-row"
          onClick={() => setShowOpening((o) => !o)}
          aria-pressed={showOpening}
        >
          {showOpening ? 'Hide opening balances' : '＋ Opening balances'}
        </button>
      </div>
      {accounts.length === 0 && (
        <p className="sh-empty">
          Add your first account on the right — start with the one you’re sure changes (often{' '}
          <strong>Cash</strong>).
        </p>
      )}
    </div>
  );
}

// ---- Description column width: drag (or ← →) its right edge; remembered in this browser only ----

const WIDTH_KEY = 'sbx-grid-description-width';
const MIN_W = 120;
const MAX_W = 640;
const clampW = (w: number) => Math.round(Math.max(MIN_W, Math.min(MAX_W, w)));

/** The Description width in px, or null for the default. A viewer convenience: storage may be unavailable. */
function useStoredWidth(): [number | null, (w: number | null) => void] {
  const [w, setW] = useState<number | null>(() => {
    try {
      const v = Number(localStorage.getItem(WIDTH_KEY));
      return v ? clampW(v) : null;
    } catch {
      return null;
    }
  });
  const set = (next: number | null) => {
    setW(next);
    try {
      if (next === null) localStorage.removeItem(WIDTH_KEY);
      else localStorage.setItem(WIDTH_KEY, String(next));
    } catch {
      // storage blocked: the width just isn't remembered
    }
  };
  return [w, set];
}

/** The draggable right edge of the Description header. Double-click resets to the default width. */
function ColumnResizer({
  width,
  onWidth,
}: {
  width: number | null;
  onWidth(w: number | null): void;
}) {
  const current = (el: HTMLElement) => width ?? el.parentElement!.getBoundingClientRect().width;
  return (
    <span
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize the Description column"
      aria-valuemin={MIN_W}
      aria-valuemax={MAX_W}
      aria-valuenow={width ?? undefined}
      tabIndex={0}
      className="sh-resizer"
      title="Drag to widen the Description column (double-click resets)"
      onPointerDown={(ev) => {
        ev.preventDefault();
        const el = ev.currentTarget;
        el.setPointerCapture(ev.pointerId);
        const startX = ev.clientX;
        const startW = current(el);
        const move = (m: PointerEvent) => onWidth(clampW(startW + m.clientX - startX));
        const up = () => {
          el.removeEventListener('pointermove', move);
          el.removeEventListener('pointerup', up);
          el.removeEventListener('pointercancel', up);
        };
        el.addEventListener('pointermove', move);
        el.addEventListener('pointerup', up);
        el.addEventListener('pointercancel', up);
      }}
      onDoubleClick={() => onWidth(null)}
      onKeyDown={(ev) => {
        const step = ev.shiftKey ? 64 : 16;
        if (ev.key === 'ArrowRight') onWidth(clampW(current(ev.currentTarget) + step));
        else if (ev.key === 'ArrowLeft') onWidth(clampW(current(ev.currentTarget) - step));
        else return;
        ev.preventDefault();
        ev.stopPropagation(); // not the grid's cell navigation
      }}
    />
  );
}

/** Account name: free editing (it may be blank while retyping); only non-blank names are saved. */
function NameInput({ name, onCommit }: { name: string; onCommit(name: string): void }) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    // Two lines, wrapping, so a long name fits a narrow column instead of being cut off. Enter finishes
    // (a name has no line breaks).
    <textarea
      className="sh-name"
      aria-label={`Account name: ${name}`}
      rows={2}
      spellCheck={false}
      value={draft ?? name}
      onFocus={() => setDraft(name)}
      onBlur={() => setDraft(null)}
      onKeyDown={(ev) => {
        if (ev.key === 'Enter') {
          ev.preventDefault();
          ev.currentTarget.blur();
        }
      }}
      onChange={(ev) => {
        const v = ev.target.value.replace(/\s*\n\s*/g, ' ');
        setDraft(v);
        if (v.trim()) onCommit(v);
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
  lines = 1,
}: {
  cents: Money;
  onChange(c: Money): void;
  label: string;
  nav?: string;
  allowNegative?: boolean;
  /** How many journal lines make up this cell. A split (2+) shows its total read-only: typing one number here
   *  would merge the lines, so they're edited in the Journal. */
  lines?: number;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const rest = cents === 0 ? '' : cents < 0 ? `−${formatDollars(-cents)}` : formatDollars(cents);
  if (lines > 1)
    return (
      <span className="sh-split" title={`${lines} journal lines — edit them in the Journal`}>
        <input
          type="text"
          readOnly
          className="sh-amt"
          data-nav={nav}
          aria-label={`${label} (${lines} lines; edit in the Journal)`}
          value={rest}
        />
        <span className="sh-split-note" aria-hidden="true">
          {lines} lines
        </span>
      </span>
    );
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
        const parsed = parseDollars(ev.target.value, { allowNegative, allowCents: true });
        if (parsed === null) return;
        setDraft(ev.target.value);
        if (parsed !== cents) onChange(parsed);
      }}
    />
  );
}
