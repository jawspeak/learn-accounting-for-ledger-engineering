import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import type {
  AccountId,
  AccountType,
  Side,
  TAccountBuilderProps,
  TransactionRow,
} from '@contracts';
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
    accounts,
    coaOrder,
    rows,
    onRowsChange,
    lockedRowCount = 0,
    lockedPostings,
    readOnly = false,
    showBalanceSheets,
    opening,
    afterBalanceSheet,
    onAfterBalanceSheetChange,
    journalView,
    correctParts,
    highlights,
    pickerTypes,
  } = props;

  const [cols, setCols] = useState<Column[]>(() => columnsFromRows(rows));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [showJournal, setShowJournal] = useState(false);
  const [flash, setFlash] = useState<AccountId | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const addBtnRef = useRef<HTMLButtonElement>(null);
  /** The account added most recently through the picker (for "Enter amounts"). */
  const lastAdded = useRef<AccountId | null>(null);

  const accountById = new Map(accounts.map((a) => [a.id, a]));
  const nameOf = (id: AccountId) => accountById.get(id)?.name ?? id;

  const columns = deriveColumns(cols, rows, accounts);
  const colType = new Map(columns.map((c) => [c.accountId, c.type]));
  const typeOf = (id: AccountId): AccountType | undefined =>
    colType.get(id) ?? accountById.get(id)?.type;
  const placed = placeColumns(columns, accounts, coaOrder);
  const eqIdx = equalsIndex(placed);
  const dividerAt =
    placed.length === 0
      ? -1
      : eqIdx >= 0
        ? eqIdx
        : placed.every((c) => c.group === 'assets')
          ? placed.length
          : -1;

  const isLocked = (ri: number) => ri < lockedRowCount;
  /** Faded examples lock only the prefilled cells; otherwise a locked row is locked completely. */
  const lockedCells = lockedPostings
    ? new Set(lockedPostings.map((l) => `${l.rowId}|${l.accountId}|${l.side}`))
    : null;
  const isCellLocked = (ri: number, rowId: string, acct: AccountId, side: Side) =>
    isLocked(ri) && (!lockedCells || lockedCells.has(`${rowId}|${acct}|${side}`));
  const lockedAccounts = new Set(
    lockedPostings
      ? lockedPostings.map((l) => l.accountId)
      : rows.slice(0, lockedRowCount).flatMap((r) => r.postings.map((p) => p.accountId)),
  );

  // ---- feedback overlays ----
  const columnIds = new Set(columns.map((c) => c.accountId));
  const hl = {
    cell: new Set<string>(),
    filled: new Set<string>(),
    col: new Set<string>(),
    type: new Set<string>(),
    row: new Set<string>(),
    bs: new Set<string>(),
  };
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
    const el = gridRef.current?.querySelector<HTMLElement>(
      `[data-col-head="${CSS.escape(flash)}"]`,
    );
    const reduce =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el?.scrollIntoView?.({
      block: 'nearest',
      inline: 'nearest',
      behavior: reduce ? 'auto' : 'smooth',
    });
    const t = setTimeout(() => setFlash(null), FLASH_MS);
    return () => clearTimeout(t);
  }, [flash]);

  // ---- mutations ----
  const retypeRows = (id: AccountId, type: AccountType) => {
    let changed = false;
    const next = rows.map((r, ri) => {
      const editable = (p: TransactionRow['postings'][number]) =>
        p.accountId === id && p.chosenType !== type && !isCellLocked(ri, r.id, p.accountId, p.side);
      if (!r.postings.some(editable)) return r;
      changed = true;
      return {
        ...r,
        postings: r.postings.map((p) => (editable(p) ? { ...p, chosenType: type } : p)),
      };
    });
    if (changed) onRowsChange(next);
  };

  const setColumnType = (id: AccountId, type: AccountType) => {
    setCols((cs) =>
      cs.some((c) => c.accountId === id)
        ? cs.map((c) => (c.accountId === id ? { ...c, type } : c))
        : [...cs, { accountId: id, type }],
    );
    retypeRows(id, type);
    setFlash(id);
  };

  /** The picker stays open after a pick (it resets itself for the next account); "Done" closes it. */
  const addColumn = (id: AccountId, type: AccountType) => {
    lastAdded.current = id;
    setColumnType(id, type);
  };

  /** "Enter amounts": close the picker and put the cursor in the new account's first open amount cell. */
  const finishAdding = () => {
    setPickerOpen(false);
    const id = lastAdded.current;
    queueMicrotask(() => {
      const cell = id
        ? gridRef.current?.querySelector<HTMLInputElement>(
            `td[data-account="${CSS.escape(id)}"] input.tab-amount`,
          )
        : null;
      (cell ?? addBtnRef.current)?.focus();
    });
  };

  const removeColumn = (id: AccountId) => {
    setCols((cs) => cs.filter((c) => c.accountId !== id));
    const removable = (ri: number, r: TransactionRow, p: TransactionRow['postings'][number]) =>
      p.accountId === id && !isCellLocked(ri, r.id, p.accountId, p.side);
    if (rows.some((r, ri) => r.postings.some((p) => removable(ri, r, p))))
      onRowsChange(
        rows.map((r, ri) => ({ ...r, postings: r.postings.filter((p) => !removable(ri, r, p)) })),
      );
    queueMicrotask(() => addBtnRef.current?.focus());
  };

  const updateRow = (ri: number, f: (r: TransactionRow) => TransactionRow) =>
    onRowsChange(rows.map((r, i) => (i === ri ? f(r) : r)));
  const addRow = () => onRowsChange([...rows, { id: nextRowId(rows), postings: [] }]);
  const removeRow = (ri: number) => onRowsChange(rows.filter((_, i) => i !== ri));

  // ---- balances ----
  const balances = engine.computeBalances(rows, typeOf, opening);
  const balanceOf = new Map(balances.lines.map((l) => [l.accountId, l.amount]));
  const openingOf = new Map((opening?.lines ?? []).map((l) => [l.accountId, l.amount]));
  const hasOpeningRow = placed.some((c) => openingOf.has(c.accountId));

  /** Amount shown on the normal side; an abnormal (negative) balance moves to the other side. */
  /** `total`: the balance line — the side that carries the amount gets `is-total` (its rule; see builder.css). */
  const sideCells = (id: AccountId, amount: number | undefined, key: string, total = false) => {
    const t = typeOf(id) ?? 'asset';
    const normal = engine.normalSide(t);
    const shownSide: Side = (amount ?? 0) < 0 ? (normal === 'dr' ? 'cr' : 'dr') : normal;
    return SIDES.map((s) => (
      <td
        key={`${key}-${s}`}
        className={`tab-cell tab-num tab-${s}${total && s === shownSide ? ' is-total' : ''}`}
      >
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
  const bsIds = [
    ...placed.map((c) => c.accountId),
    ...(opening?.lines ?? []).map((l) => l.accountId).filter((id) => !columnIds.has(id)),
  ];
  const editableAfter = !!afterBalanceSheet && !!onAfterBalanceSheetChange;

  /**
   * Before-BS typing: accounts given in the opening balances show their real (given) type; anything the learner
   * added shows the learner's chosen type — otherwise the Before panel would leak a trap account's real type.
   */
  const beforeTypeOf = (id: AccountId): AccountType | undefined =>
    openingOf.has(id)
      ? (accountById.get(id)?.type ?? colType.get(id))
      : (colType.get(id) ?? accountById.get(id)?.type);

  /** One fragment per column, with the `=` divider cell spliced in at the assets | right-hand boundary. */
  const eachCol = (
    render: (c: PlacedColumn, i: number) => ReactNode,
    divider: (() => ReactNode) | null,
  ): ReactNode[] => {
    const parts = placed.map((c, i) => <Fragment key={c.accountId}>{render(c, i)}</Fragment>);
    if (divider && dividerAt >= 0)
      parts.splice(dividerAt, 0, <Fragment key="__eq">{divider()}</Fragment>);
    return parts;
  };
  const eqCell = () => <td className="tab-eq-col" aria-hidden="true" />;

  const topBand = (g: PlacedColumn['group']) =>
    g === 'assets' ? 'Assets' : g === 'liabilities' ? 'Liabilities' : 'Equity';
  const colCls = (c: PlacedColumn, ...extra: (string | false | undefined)[]) =>
    ['tab-col', `tab-g-${c.group}`, flash === c.accountId && 'tab-flash', ...extra]
      .filter(Boolean)
      .join(' ');

  const HEAD_ROWS = 4;
  const bandCells: ReactNode[] = [];
  for (const r of runs(placed, (c) => topBand(c.group))) {
    if (dividerAt === r.start) bandCells.push(<DividerHead key="eq" rowSpan={HEAD_ROWS} />);
    bandCells.push(
      <th
        key={`b-${r.start}`}
        scope="colgroup"
        colSpan={r.length * 2}
        className={`tab-band tab-band-${r.key.toLowerCase()}`}
      >
        {r.key}
      </th>,
    );
  }
  if (placed.length > 0 && dividerAt === placed.length)
    bandCells.push(<DividerHead key="eq" rowSpan={HEAD_ROWS} />);

  const subBandCells = runs(placed, (c) => (isEquityGroup(c.group) ? c.group : `-${c.group}`)).map(
    (r) => {
      const g = placed[r.start]!.group;
      return (
        <th
          key={`sb-${r.start}`}
          scope="colgroup"
          colSpan={r.length * 2}
          className={`tab-subband${isEquityGroup(g) ? ' is-equity' : ''}`}
        >
          {isEquityGroup(g) ? GROUP_LABEL[g] : ''}
        </th>
      );
    },
  );

  const offered = pickerTypes
    ? PICKER_TYPES.filter((t) => pickerTypes.includes(t.type))
    : PICKER_TYPES;
  const typeOptions = (current: AccountType) => [
    ...offered,
    ...(offered.some((t) => t.type === current)
      ? []
      : [{ type: current, label: typeLabel(current) }]),
  ];

  // Dr = Cr per row, summarised in ONE bar above the grid (instead of a column on every row): quiet when every
  // row balances, loud — naming the row — when one doesn't. Empty rows don't count yet.
  const unbalanced = rows
    .map((r, ri) => ({ r, ri, t: engine.rowTotals(r) }))
    .filter(({ r, t }) => r.postings.length > 0 && !t.balanced);
  const anyPosted = rows.some((r) => r.postings.length > 0);
  const balanceClass = `tab-balance-bar ${!anyPosted ? 'is-empty' : unbalanced.length ? 'is-bad' : 'is-ok'}`;
  const balanceText = (
    <>
      {!anyPosted ? (
        <>Each row’s debits must equal its credits.</>
      ) : unbalanced.length === 0 ? (
        <>
          <span aria-hidden="true">✓</span> Debits = credits in every row
        </>
      ) : (
        <>
          <span aria-hidden="true">✗</span>{' '}
          {unbalanced
            .map(
              ({ ri, t }) =>
                `Row ${ri + 1} doesn’t balance: Dr ${formatDollars(t.dr)} ≠ Cr ${formatDollars(t.cr)}`,
            )
            .join(' · ')}
        </>
      )}
    </>
  );
  // The Dr = Cr check sits under the grid, starting at the first account column (plain text, no banner);
  // with no grid to sit in (no accounts yet, or Journal view) it goes under the work area instead.
  const inGrid = !showJournal && placed.length > 0;
  const balanceBar = (
    <p className={balanceClass} role="status" aria-live="polite">
      {balanceText}
    </p>
  );
  const unbalancedIds = new Set(unbalanced.map(({ r }) => r.id));

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
        </tr>
        <tr>{subBandCells}</tr>
        <tr>
          {placed.map((c) => {
            const id = c.accountId;
            const name = nameOf(id);
            const locked = lockedAccounts.has(id);
            return (
              <th
                key={id}
                scope="colgroup"
                colSpan={2}
                data-col-head={id}
                className={colCls(c, 'tab-head', hl.col.has(id) && 'tab-hl')}
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
          </tr>
        )}
        {rows.map((r, ri) => {
          const locked = isLocked(ri);
          const rowHl = hl.row.has(r.id);
          return (
            <tr
              key={r.id}
              data-row={r.id}
              className={
                [locked && 'is-locked', rowHl && 'tab-hl-row'].filter(Boolean).join(' ') ||
                undefined
              }
            >
              <th scope="row" className="tab-rowhead">
                <span className="tab-rownum">{ri + 1}</span>
                {unbalancedIds.has(r.id) && (
                  <span className="tab-row-bad" title="This row doesn’t balance">
                    <span aria-hidden="true">✗</span>
                    <span className="sr-only"> (doesn’t balance)</span>
                  </span>
                )}
                {isCorrectRow(correctParts, r.id) && <OkMark />}
                {locked ? (
                  <>
                    {r.label && <span className="tab-rowlabel">{r.label}</span>}
                    {!readOnly && <span className="tab-lock-badge">Example</span>}
                  </>
                ) : (
                  <input
                    className="tab-label-input"
                    aria-label={`Row ${ri + 1} label`}
                    placeholder="Label"
                    title={r.label || 'Optional label for this transaction'}
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
                  {pickerOpen ? (
                    'Choose a type, then a name, above.'
                  ) : (
                    <button
                      type="button"
                      className="tab-empty-add"
                      onClick={() => setPickerOpen(true)}
                    >
                      <span aria-hidden="true">＋ </span>Add your first account
                    </button>
                  )}
                  <span className="tab-empty-hint">
                    Start with the account you’re sure changes.
                  </span>
                </td>
              )}
              {eachCol((c) => {
                const id = c.accountId;
                const name = nameOf(id);
                return SIDES.map((side) => {
                  const amt = cellAmount(r, id, side);
                  const flagged = cellHighlighted(r, id, side);
                  const ok = amt > 0 && isCorrectCell(correctParts, r.id, id);
                  const cellLocked = isCellLocked(ri, r.id, id, side);
                  return (
                    <td
                      key={side}
                      data-account={id}
                      className={colCls(
                        c,
                        'tab-cell',
                        `tab-${side}`,
                        flagged && 'tab-hl',
                        cellLocked && 'is-locked-cell',
                      )}
                    >
                      {cellLocked ? (
                        <span className="tab-num">{amt ? formatDollars(amt) : ''}</span>
                      ) : (
                        <AmountInput
                          className="tab-amount"
                          aria-label={`Row ${ri + 1} ${name} ${SIDE_LABEL[side]}`}
                          cents={amt}
                          onCentsChange={(cents) =>
                            updateRow(ri, (row) => setCell(row, id, side, cents, typeOf(id)!))
                          }
                        />
                      )}
                      {ok && <OkMark />}
                      {flagged && <span className="sr-only"> (flagged)</span>}
                    </td>
                  );
                });
              }, eqCell)}
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
            {eachCol(
              (c) => sideCells(c.accountId, balanceOf.get(c.accountId) ?? 0, 'bal', true),
              eqCell,
            )}
          </tr>
          <tr className="tab-check-row">
            <td />
            <td colSpan={placed.length * 2 + (dividerAt >= 0 ? 1 : 0)}>
              <p className={balanceClass} role="status" aria-live="polite">
                {balanceText}
              </p>
            </td>
          </tr>
        </tfoot>
      )}
    </table>
  );

  return (
    <div
      className={`tab-builder${showBalanceSheets ? ' has-bs' : ''}${placed.length <= 2 ? ' bs-side' : ''}`}
    >
      <div className="tab-toolbar">
        {!showJournal && !readOnly && (
          <>
            <button
              type="button"
              ref={addBtnRef}
              aria-expanded={pickerOpen}
              onClick={() => setPickerOpen((o) => !o)}
            >
              <span aria-hidden="true">＋ </span>Add account
            </button>
          </>
        )}
        {journalView && (
          <button
            type="button"
            aria-pressed={showJournal}
            onClick={() => setShowJournal((j) => !j)}
          >
            Journal view
          </button>
        )}
      </div>
      {pickerOpen && !showJournal && (
        <AccountPicker
          accounts={accounts}
          existing={columnIds}
          types={pickerTypes ? offered.map((t) => t.type) : undefined}
          onPick={addColumn}
          onCancel={() => {
            setPickerOpen(false);
            addBtnRef.current?.focus();
          }}
          onFinish={finishAdding}
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
        <div className="tab-grid-area">
          <div
            className="tab-scroll"
            ref={gridRef}
            role="region"
            aria-label={showJournal ? 'Journal entries' : 'T-account grid'}
            tabIndex={0}
          >
            {showJournal ? <JournalView rows={rows} nameOf={nameOf} /> : grid}
          </div>
          {!showJournal && !readOnly && (
            <button type="button" className="tab-add-row" onClick={addRow}>
              <span aria-hidden="true">＋ </span>Add row
            </button>
          )}
          {!inGrid && balanceBar}
        </div>
        {showBalanceSheets && (
          <div className="tab-bs-after">
            <BalanceSheetPanel
              title="After"
              bs={editableAfter ? afterBalanceSheet! : balances}
              compareTo={opening ?? { lines: [] }}
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
      <span className="sr-only">
        equals: assets on the left, liabilities and equity on the right
      </span>
    </th>
  );
}
