import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Account, AccountId, AccountType, Side, TAccountBuilderProps, TransactionRow } from '@contracts';
import { engine } from '@engine';
import { AccountPicker } from './AccountPicker';
import { AmountInput } from './AmountInput';
import { BalanceSheetPanel } from './BalanceSheetPanel';
import { JournalView } from './JournalView';
import {
  GROUP_LABEL,
  PICKER_TYPES,
  cellAmount,
  columnsFromRows,
  deriveColumns,
  equalsIndex,
  formatDollars,
  isCorrectCell,
  isCorrectColumn,
  isCorrectRow,
  isEquityGroup,
  nextRowId,
  placeColumns,
  resolveHighlight,
  runs,
  setCell,
  slugId,
  typeLabel,
  type Column,
  type PlacedColumn,
} from './model';
import './builder.css';

const SIDES: Side[] = ['dr', 'cr'];
const SIDE_LABEL: Record<Side, string> = { dr: 'Dr', cr: 'Cr' };
const FLASH_MS = 1200;

/**
 * The T-account builder (VISION-2 §5): rows = transactions, columns = T-accounts in canonical `A = L + E` order
 * by the learner's chosen type, live per-row Dr = Cr check, optional before/after balance sheets and journal view.
 */
export function TAccountBuilder(props: TAccountBuilderProps) {
  const {
    mode,
    accounts,
    coaOrder,
    rows,
    onRowsChange,
    onAccountsChange,
    lockedRowCount = 0,
    showBalanceSheets,
    opening,
    afterBalanceSheet,
    onAfterBalanceSheetChange,
    journalView,
    correctParts,
    highlights,
    columnOrder,
    onColumnOrderChange,
  } = props;

  const [cols, setCols] = useState<Column[]>(() => columnsFromRows(rows));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [showJournal, setShowJournal] = useState(false);
  const [flash, setFlash] = useState<AccountId | null>(null);
  const [dragging, setDragging] = useState<AccountId | null>(null);
  /** Sandbox accounts created here, shown by name until the parent passes them back in `accounts`. */
  const [created, setCreated] = useState<Account[]>([]);
  const gridRef = useRef<HTMLDivElement>(null);
  const addBtnRef = useRef<HTMLButtonElement>(null);

  const allAccounts = [...accounts, ...created.filter((c) => !accounts.some((a) => a.id === c.id))];
  const accountById = new Map(allAccounts.map((a) => [a.id, a]));
  const nameOf = (id: AccountId) => accountById.get(id)?.name ?? id;

  const columns = deriveColumns(cols, rows, allAccounts);
  const colType = new Map(columns.map((c) => [c.accountId, c.type]));
  const typeOf = (id: AccountId): AccountType | undefined => colType.get(id) ?? accountById.get(id)?.type;
  const sandbox = mode === 'sandbox';
  const canReorder = sandbox && !!onColumnOrderChange;
  const placed = placeColumns(columns, allAccounts, coaOrder, canReorder ? columnOrder : undefined);
  const eqIdx = equalsIndex(placed);
  const dividerAt = placed.length === 0 ? -1 : eqIdx >= 0 ? eqIdx : placed.every((c) => c.group === 'assets') ? placed.length : -1;

  const isLocked = (ri: number) => ri < lockedRowCount;
  const lockedAccounts = new Set(rows.slice(0, lockedRowCount).flatMap((r) => r.postings.map((p) => p.accountId)));

  // ---- feedback overlays ----
  const columnIds = new Set(columns.map((c) => c.accountId));
  const hl = { cell: new Set<string>(), filled: new Set<string>(), col: new Set<string>(), type: new Set<string>(), row: new Set<string>(), bs: new Set<string>() };
  for (const loc of highlights ?? []) {
    const h = resolveHighlight(loc, columnIds);
    if (!h) continue;
    const key = `${h.rowId}|${h.accountId}`;
    if (h.target === 'bs-line') hl.bs.add(h.accountId!);
    else if (h.target === 'type') {
      hl.type.add(h.accountId!);
      if (h.rowId) hl.cell.add(key);
    } else if (h.target === 'cell') hl.cell.add(key);
    else if (h.target === 'cell-filled') hl.filled.add(key);
    else if (h.target === 'column') hl.col.add(h.accountId!);
    else hl.row.add(h.rowId!);
  }
  const cellHighlighted = (row: TransactionRow, acct: AccountId, side: Side) => {
    const key = `${row.id}|${acct}`;
    if (hl.cell.has(key)) return true;
    if (!hl.filled.has(key)) return false;
    const anyFilled = cellAmount(row, acct, 'dr') > 0 || cellAmount(row, acct, 'cr') > 0;
    return !anyFilled || cellAmount(row, acct, side) > 0;
  };

  // ---- column flash + scroll-into-view when a column snaps into place ----
  useEffect(() => {
    if (!flash) return;
    const el = gridRef.current?.querySelector<HTMLElement>(`[data-col-head="${CSS.escape(flash)}"]`);
    const reduce = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el?.scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
    const t = setTimeout(() => setFlash(null), FLASH_MS);
    return () => clearTimeout(t);
  }, [flash]);

  // ---- mutations ----
  const retypeRows = (id: AccountId, type: AccountType) => {
    let changed = false;
    const next = rows.map((r, ri) => {
      if (isLocked(ri) || !r.postings.some((p) => p.accountId === id && p.chosenType !== type)) return r;
      changed = true;
      return { ...r, postings: r.postings.map((p) => (p.accountId === id ? { ...p, chosenType: type } : p)) };
    });
    if (changed) onRowsChange(next);
  };

  const setColumnType = (id: AccountId, type: AccountType) => {
    setCols((cs) => (cs.some((c) => c.accountId === id) ? cs.map((c) => (c.accountId === id ? { ...c, type } : c)) : [...cs, { accountId: id, type }]));
    retypeRows(id, type);
    setFlash(id);
  };

  const addColumn = (id: AccountId, type: AccountType) => {
    setColumnType(id, type);
    setPickerOpen(false);
    queueMicrotask(() => addBtnRef.current?.focus());
  };

  const createAccount = (name: string, type: AccountType) => {
    const account: Account = { id: slugId(name, allAccounts.map((a) => a.id)), name, type };
    setCreated((c) => [...c, account]);
    onAccountsChange?.([...accounts, account]);
    addColumn(account.id, type);
  };

  const removeColumn = (id: AccountId) => {
    setCols((cs) => cs.filter((c) => c.accountId !== id));
    if (rows.some((r, ri) => !isLocked(ri) && r.postings.some((p) => p.accountId === id)))
      onRowsChange(rows.map((r, ri) => (isLocked(ri) ? r : { ...r, postings: r.postings.filter((p) => p.accountId !== id) })));
    if (canReorder && columnOrder?.includes(id)) onColumnOrderChange!(columnOrder.filter((x) => x !== id));
    queueMicrotask(() => addBtnRef.current?.focus());
  };

  const updateRow = (ri: number, f: (r: TransactionRow) => TransactionRow) => onRowsChange(rows.map((r, i) => (i === ri ? f(r) : r)));
  const addRow = () => onRowsChange([...rows, { id: nextRowId(rows), postings: [] }]);
  const removeRow = (ri: number) => onRowsChange(rows.filter((_, i) => i !== ri));

  const moveColumn = (id: AccountId, to: number) => {
    const order = placed.map((c) => c.accountId);
    const from = order.indexOf(id);
    if (from === -1 || to < 0 || to >= order.length || to === from) return;
    order.splice(from, 1);
    order.splice(to, 0, id);
    onColumnOrderChange?.(order);
    setFlash(id);
  };

  // ---- balances ----
  const balances = engine.computeBalances(rows, typeOf, opening);
  const balanceOf = new Map(balances.lines.map((l) => [l.accountId, l.amount]));
  const openingOf = new Map((opening?.lines ?? []).map((l) => [l.accountId, l.amount]));
  const hasOpeningRow = placed.some((c) => openingOf.has(c.accountId));

  /** Amount shown on the normal side; an abnormal (negative) balance moves to the other side. */
  const sideCells = (id: AccountId, amount: number | undefined, key: string) => {
    const t = typeOf(id) ?? 'asset';
    const normal = engine.normalSide(t);
    const shownSide: Side = (amount ?? 0) < 0 ? (normal === 'dr' ? 'cr' : 'dr') : normal;
    return SIDES.map((s) => (
      <td key={`${key}-${s}`} className={`tab-cell tab-num tab-${s}`}>
        {amount !== undefined && amount !== 0 && s === shownSide ? (
          <>
            {formatDollars(Math.abs(amount))}
            {amount < 0 && <span className="tab-abnormal"> (abnormal)</span>}
          </>
        ) : amount === 0 && s === normal ? (
          formatDollars(0)
        ) : null}
      </td>
    ));
  };

  // Accounts in play for the balance sheets: anything in the opening BS or on the grid, in column order.
  const bsIds = [...placed.map((c) => c.accountId), ...(opening?.lines ?? []).map((l) => l.accountId).filter((id) => !columnIds.has(id))];
  const editableAfter = !!afterBalanceSheet && !!onAfterBalanceSheetChange;

  /**
   * Before-BS typing: accounts given in the opening balances show their real (given) type; anything the learner
   * added shows the learner's chosen type — otherwise the Before panel would leak a trap account's real type.
   */
  const beforeTypeOf = (id: AccountId): AccountType | undefined =>
    openingOf.has(id) ? (accountById.get(id)?.type ?? colType.get(id)) : (colType.get(id) ?? accountById.get(id)?.type);

  /** One fragment per column, with the `=` divider cell spliced in at the assets | right-hand boundary. */
  const eachCol = (render: (c: PlacedColumn, i: number) => ReactNode, divider: (() => ReactNode) | null): ReactNode[] => {
    const parts = placed.map((c, i) => <Fragment key={c.accountId}>{render(c, i)}</Fragment>);
    if (divider && dividerAt >= 0) parts.splice(dividerAt, 0, <Fragment key="__eq">{divider()}</Fragment>);
    return parts;
  };
  const eqCell = () => <td className="tab-eq-col" aria-hidden="true" />;

  const topBand = (g: PlacedColumn['group']) => (g === 'assets' ? 'Assets' : g === 'liabilities' ? 'Liabilities' : 'Equity');
  const colCls = (c: PlacedColumn, ...extra: (string | false | undefined)[]) =>
    ['tab-col', `tab-g-${c.group}`, flash === c.accountId && 'tab-flash', ...extra].filter(Boolean).join(' ');

  const HEAD_ROWS = 4;
  const bandCells: ReactNode[] = [];
  for (const r of runs(placed, (c) => topBand(c.group))) {
    if (dividerAt === r.start) bandCells.push(<DividerHead key="eq" rowSpan={HEAD_ROWS} />);
    bandCells.push(
      <th key={`b-${r.start}`} scope="colgroup" colSpan={r.length * 2} className={`tab-band tab-band-${r.key.toLowerCase()}`}>
        {r.key}
      </th>,
    );
  }
  if (placed.length > 0 && dividerAt === placed.length) bandCells.push(<DividerHead key="eq" rowSpan={HEAD_ROWS} />);

  const subBandCells = runs(placed, (c) => (isEquityGroup(c.group) ? c.group : `-${c.group}`)).map((r) => {
    const g = placed[r.start]!.group;
    return (
      <th key={`sb-${r.start}`} scope="colgroup" colSpan={r.length * 2} className={`tab-subband${isEquityGroup(g) ? ' is-equity' : ''}`}>
        {isEquityGroup(g) ? GROUP_LABEL[g] : ''}
      </th>
    );
  });

  const typeOptions = (current: AccountType) => [
    ...PICKER_TYPES,
    ...(PICKER_TYPES.some((t) => t.type === current) ? [] : [{ type: current, label: typeLabel(current) }]),
  ];

  const rowCheck = (r: TransactionRow) => {
    if (r.postings.length === 0)
      return (
        <span className="tab-rowcheck is-empty">
          <span aria-hidden="true">–</span>
          <span className="sr-only">Empty row</span>
        </span>
      );
    const t = engine.rowTotals(r);
    return t.balanced ? (
      <span className="tab-rowcheck is-ok">
        <span aria-hidden="true">✓</span> Balanced
      </span>
    ) : (
      <span className="tab-rowcheck is-bad">
        <span aria-hidden="true">✗</span> Unbalanced: Dr {formatDollars(t.dr)} ≠ Cr {formatDollars(t.cr)}
      </span>
    );
  };

  const grid = (
    <table className="tab-grid">
      <caption className="sr-only">
        T-accounts. Rows are transactions; each account has a debit (Dr) and a credit (Cr) column.
      </caption>
      <thead>
        <tr>
          <th scope="col" rowSpan={HEAD_ROWS} className="tab-rowhead-col">
            #
          </th>
          {placed.length === 0 ? (
            <th scope="col" rowSpan={HEAD_ROWS} className="tab-empty-head">
              Accounts
            </th>
          ) : (
            bandCells
          )}
          <th scope="col" rowSpan={HEAD_ROWS} className="tab-check-col">
            Dr = Cr?
          </th>
        </tr>
        <tr>{subBandCells}</tr>
        <tr>
          {placed.map((c, i) => {
            const id = c.accountId;
            const name = nameOf(id);
            const locked = lockedAccounts.has(id);
            return (
              <th
                key={id}
                scope="colgroup"
                colSpan={2}
                data-col-head={id}
                className={colCls(c, 'tab-head', hl.col.has(id) && 'tab-hl', dragging === id && 'is-dragging')}
                draggable={canReorder}
                onDragStart={
                  canReorder
                    ? (e) => {
                        e.dataTransfer.setData('text/plain', id);
                        e.dataTransfer.effectAllowed = 'move';
                        setDragging(id);
                      }
                    : undefined
                }
                onDragOver={canReorder && dragging ? (e) => e.preventDefault() : undefined}
                onDrop={
                  canReorder
                    ? (e) => {
                        e.preventDefault();
                        if (dragging) moveColumn(dragging, i);
                        setDragging(null);
                      }
                    : undefined
                }
                onDragEnd={canReorder ? () => setDragging(null) : undefined}
              >
                <div className="tab-head-name">
                  {name}
                  {isCorrectColumn(correctParts, id) && <OkMark />}
                  {hl.col.has(id) && <span className="sr-only"> (flagged)</span>}
                </div>
                <div className="tab-head-tools">
                  <select
                    className={`tab-type-badge tab-type-${c.type}${hl.type.has(id) ? ' tab-hl' : ''}`}
                    aria-label={`Type of ${name}`}
                    value={c.type}
                    disabled={locked}
                    onChange={(e) => setColumnType(id, e.target.value as AccountType)}
                  >
                    {typeOptions(c.type).map((t) => (
                      <option key={t.type} value={t.type}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                  {hl.type.has(id) && <span className="sr-only"> (type flagged)</span>}
                  {canReorder && (
                    <>
                      <button
                        type="button"
                        className="tab-icon-btn"
                        aria-label={`Move ${name} left`}
                        disabled={i === 0}
                        onClick={() => moveColumn(id, i - 1)}
                      >
                        <span aria-hidden="true">◀</span>
                      </button>
                      <button
                        type="button"
                        className="tab-icon-btn"
                        aria-label={`Move ${name} right`}
                        disabled={i === placed.length - 1}
                        onClick={() => moveColumn(id, i + 1)}
                      >
                        <span aria-hidden="true">▶</span>
                      </button>
                    </>
                  )}
                  {!locked && (
                    <button
                      type="button"
                      className="tab-icon-btn"
                      aria-label={`Remove ${name}`}
                      title="Remove this account"
                      onClick={() => removeColumn(id)}
                    >
                      <span aria-hidden="true">×</span>
                    </button>
                  )}
                </div>
              </th>
            );
          })}
        </tr>
        <tr className="tab-sides">
          {placed.map((c) =>
            SIDES.map((s) => (
              <th key={`${c.accountId}-${s}`} scope="col" className={colCls(c, `tab-${s}`)}>
                <span aria-hidden="true">{SIDE_LABEL[s]}</span>
                <span className="sr-only">
                  {nameOf(c.accountId)} {s === 'dr' ? 'debit' : 'credit'}
                </span>
              </th>
            )),
          )}
        </tr>
      </thead>
      <tbody>
        {hasOpeningRow && (
          <tr className="tab-opening-row">
            <th scope="row" className="tab-rowhead">
              <span className="tab-rowlabel">Opening</span>
            </th>
            {eachCol((c) => sideCells(c.accountId, openingOf.get(c.accountId), 'open'), eqCell)}
            <td className="tab-check-col" />
          </tr>
        )}
        {rows.map((r, ri) => {
          const locked = isLocked(ri);
          const rowHl = hl.row.has(r.id);
          return (
            <tr
              key={r.id}
              data-row={r.id}
              className={[locked && 'is-locked', rowHl && 'tab-hl-row'].filter(Boolean).join(' ') || undefined}
            >
              <th scope="row" className="tab-rowhead">
                <span className="tab-rownum">{ri + 1}</span>
                {locked ? (
                  <>
                    {r.label && <span className="tab-rowlabel">{r.label}</span>}
                    <span className="tab-lock-badge">Example</span>
                  </>
                ) : (
                  <input
                    className="tab-label-input"
                    aria-label={`Row ${ri + 1} label`}
                    placeholder="Label (optional)"
                    value={r.label ?? ''}
                    onChange={(e) =>
                      updateRow(ri, (row) => {
                        const next = { ...row };
                        if (e.target.value) next.label = e.target.value;
                        else delete next.label;
                        return next;
                      })
                    }
                  />
                )}
                {!locked && (
                  <button
                    type="button"
                    className="tab-icon-btn tab-row-remove"
                    aria-label={`Remove row ${ri + 1}`}
                    title="Remove this row"
                    onClick={() => removeRow(ri)}
                  >
                    <span aria-hidden="true">×</span>
                  </button>
                )}
                {rowHl && <span className="sr-only"> (flagged)</span>}
              </th>
              {placed.length === 0 && ri === 0 && (
                <td rowSpan={rows.length} className="tab-empty-cell">
                  Add an account to start — choose its type, then its name.
                </td>
              )}
              {eachCol((c) => {
                const id = c.accountId;
                const name = nameOf(id);
                return SIDES.map((side) => {
                  const amt = cellAmount(r, id, side);
                  const flagged = cellHighlighted(r, id, side);
                  const ok = amt > 0 && isCorrectCell(correctParts, r.id, id);
                  return (
                    <td key={side} data-account={id} className={colCls(c, 'tab-cell', `tab-${side}`, flagged && 'tab-hl')}>
                      {locked ? (
                        <span className="tab-num">{amt ? formatDollars(amt) : ''}</span>
                      ) : (
                        <AmountInput
                          className="tab-amount"
                          aria-label={`Row ${ri + 1} ${name} ${SIDE_LABEL[side]}`}
                          cents={amt}
                          onCentsChange={(cents) => updateRow(ri, (row) => setCell(row, id, side, cents, typeOf(id)!))}
                        />
                      )}
                      {ok && <OkMark />}
                      {flagged && <span className="sr-only"> (flagged)</span>}
                    </td>
                  );
                });
              }, eqCell)}
              <td className="tab-check-col">
                {rowCheck(r)}
                {isCorrectRow(correctParts, r.id) && <OkMark />}
              </td>
            </tr>
          );
        })}
      </tbody>
      {placed.length > 0 && (
        <tfoot>
          <tr className="tab-balance-row">
            <th scope="row" className="tab-rowhead">
              Balance
            </th>
            {eachCol((c) => sideCells(c.accountId, balanceOf.get(c.accountId) ?? 0, 'bal'), eqCell)}
            <td className="tab-check-col" />
          </tr>
        </tfoot>
      )}
    </table>
  );

  return (
    <div className={`tab-builder${showBalanceSheets ? ' has-bs' : ''}`}>
      <div className="tab-toolbar">
        {!showJournal && (
          <>
            <button type="button" ref={addBtnRef} aria-expanded={pickerOpen} onClick={() => setPickerOpen((o) => !o)}>
              <span aria-hidden="true">＋ </span>Add account
            </button>
            <button type="button" onClick={addRow}>
              <span aria-hidden="true">＋ </span>Add row
            </button>
          </>
        )}
        {journalView && (
          <button type="button" aria-pressed={showJournal} onClick={() => setShowJournal((j) => !j)}>
            Journal view
          </button>
        )}
        {canReorder && !!columnOrder?.length && (
          <button type="button" onClick={() => onColumnOrderChange!([])}>
            Reset to canonical order
          </button>
        )}
      </div>
      {pickerOpen && !showJournal && (
        <AccountPicker
          accounts={sandbox ? [...allAccounts].sort((a, b) => a.name.localeCompare(b.name)) : allAccounts}
          existing={columnIds}
          allowCreate={sandbox && !!onAccountsChange}
          onPick={addColumn}
          onCreate={createAccount}
          onCancel={() => {
            setPickerOpen(false);
            addBtnRef.current?.focus();
          }}
        />
      )}
      <div className="tab-layout">
        {showBalanceSheets && (
          <div className="tab-bs-before">
            <BalanceSheetPanel
              title="Before"
              bs={opening ?? { lines: [] }}
              accountIds={bsIds}
              typeOf={beforeTypeOf}
              nameOf={nameOf}
            />
          </div>
        )}
        <div
          className="tab-scroll"
          ref={gridRef}
          role="region"
          aria-label={showJournal ? 'Journal entries' : 'T-account grid'}
          tabIndex={0}
        >
          {showJournal ? <JournalView rows={rows} nameOf={nameOf} /> : grid}
        </div>
        {showBalanceSheets && (
          <div className="tab-bs-after">
            <BalanceSheetPanel
              title="After"
              bs={editableAfter ? afterBalanceSheet! : balances}
              accountIds={bsIds}
              typeOf={typeOf}
              nameOf={nameOf}
              onChange={editableAfter ? onAfterBalanceSheetChange : undefined}
              highlighted={hl.bs}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function OkMark() {
  return (
    <span className="tab-ok-mark">
      <span aria-hidden="true">✓</span>
      <span className="sr-only"> correct</span>
    </span>
  );
}

function DividerHead({ rowSpan }: { rowSpan: number }) {
  return (
    <th rowSpan={rowSpan} className="tab-eq-col tab-eq-sign" scope="col">
      <span aria-hidden="true">=</span>
      <span className="sr-only">equals: assets on the left, liabilities and equity on the right</span>
    </th>
  );
}
