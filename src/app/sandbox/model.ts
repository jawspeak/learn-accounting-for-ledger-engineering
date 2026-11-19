/** Pure helpers for the Sandbox (Scenario Board). No React here — easy to unit test. */
import type {
  Account,
  AccountId,
  AccountType,
  BalanceSheet,
  EntityCoA,
  EquationCheck,
  Money,
  Posting,
  SandboxEntity,
  SandboxState,
  Side,
  TransactionRow,
} from '@contracts';
import { engine } from '@engine';

/** Warn (non-blocking) once the shareable URL gets longer than this. */
export const URL_WARN_LENGTH = 6000;

export const ACCOUNT_TYPES: { type: AccountType; label: string }[] = [
  { type: 'asset', label: 'Asset' },
  { type: 'contra-asset', label: 'Contra-asset' },
  { type: 'liability', label: 'Liability' },
  { type: 'contra-liability', label: 'Contra-liability' },
  { type: 'equity', label: 'Equity' },
  { type: 'contra-equity', label: 'Contra-equity' },
  { type: 'revenue', label: 'Revenue' },
  { type: 'contra-revenue', label: 'Contra-revenue' },
  { type: 'expense', label: 'Expense' },
  { type: 'dividend', label: 'Dividends' },
];

export function emptyState(): SandboxState {
  return { v: 1, title: '', scenario: '', entities: [newEntity([], 'You')] };
}

/** kebab-case slug: "Cash: Vault" → "cash-vault". Never empty. */
export function slugify(name: string, fallback = 'account'): string {
  const s = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return s || fallback;
}

/** Slug of `name`, de-duplicated against `taken` by appending -2, -3, … */
export function uniqueId(name: string, taken: Iterable<string>, fallback?: string): string {
  const set = new Set(taken);
  const base = slugify(name, fallback);
  if (!set.has(base)) return base;
  let n = 2;
  while (set.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

export function newEntity(existing: SandboxEntity[], name = 'New entity'): SandboxEntity {
  return {
    id: uniqueId(
      name,
      existing.map((e) => e.id),
      'entity',
    ),
    name,
    accounts: [],
    rows: [{ id: 'r1', postings: [] }],
    showBalanceSheets: false,
  };
}

export function duplicateEntity(existing: SandboxEntity[], src: SandboxEntity): SandboxEntity {
  const name = `${src.name} (copy)`;
  return {
    ...structuredClone(src),
    id: uniqueId(
      name,
      existing.map((e) => e.id),
      'entity',
    ),
    name,
  };
}

/**
 * Apply an account list coming from the builder (or the accounts panel).
 * Newly created accounts get a kebab-case slug of their name as id (de-duplicated); references to the
 * builder-assigned id (rows, opening, column order, contraOf) are rewritten. Existing accounts keep their ids,
 * so renames don't break rows. Opening lines / column order for deleted accounts are dropped.
 */
export function applyAccounts(e: SandboxEntity, next: Account[]): SandboxEntity {
  const before = new Set(e.accounts.map((a) => a.id));
  const taken = new Set<string>(next.filter((a) => before.has(a.id)).map((a) => a.id));
  const rename = new Map<string, string>();
  for (const a of next) {
    if (before.has(a.id)) continue;
    const id = uniqueId(a.name, taken);
    taken.add(id);
    if (id !== a.id) rename.set(a.id, id);
  }
  const sw = (id: string) => rename.get(id) ?? id;
  const accounts = next.map((a) => {
    const out: Account = { ...a, id: sw(a.id) };
    if (a.contraOf !== undefined) out.contraOf = sw(a.contraOf);
    return out;
  });
  const ids = new Set(accounts.map((a) => a.id));
  const openingLines = e.opening?.lines
    .map((l) => ({ ...l, accountId: sw(l.accountId) }))
    .filter((l) => ids.has(l.accountId));
  const out: SandboxEntity = {
    ...e,
    accounts,
    rows: rename.size
      ? e.rows.map((r) => ({
          ...r,
          postings: r.postings.map((p) => ({ ...p, accountId: sw(p.accountId) })),
        }))
      : e.rows,
    opening: openingLines && openingLines.length ? { lines: openingLines } : undefined,
  };
  if (e.columnOrder) {
    const order = e.columnOrder.map(sw).filter((id) => ids.has(id));
    if (order.length) out.columnOrder = order;
    else delete out.columnOrder;
  }
  if (!e.opening) delete out.opening;
  return out;
}

/** Copy a content entity's accounts into a sandbox entity (accounts already present by id are kept). */
export function applyTemplate(e: SandboxEntity, coa: EntityCoA): SandboxEntity {
  const have = new Set(e.accounts.map((a) => a.id));
  const added = coa.accounts.filter((a) => !have.has(a.id)).map((a) => ({ ...a }));
  const pristineName = e.accounts.length === 0 && /^(new entity|you)( \d+)?$/i.test(e.name.trim());
  return { ...e, name: pristineName ? coa.name : e.name, accounts: [...e.accounts, ...added] };
}

export function typeResolver(e: SandboxEntity): (id: AccountId) => AccountType | undefined {
  const byId = new Map(e.accounts.map((a) => [a.id, a.type]));
  const chosen = new Map<string, AccountType>();
  for (const r of e.rows)
    for (const p of r.postings) if (p.chosenType) chosen.set(p.accountId, p.chosenType);
  return (id) => byId.get(id) ?? chosen.get(id);
}

export interface EntitySummary {
  rowsBalanced: boolean;
  unbalancedRows: number[];
  opening: EquationCheck | null;
  closing: BalanceSheet;
  equation: EquationCheck;
}

export function summarize(e: SandboxEntity): EntitySummary {
  const typeOf = typeResolver(e);
  // An empty row isn't an error yet — it's just a row waiting to be filled in.
  const unbalancedRows = e.rows.flatMap((r, i) =>
    r.postings.length === 0 || engine.rowTotals(r).balanced ? [] : [i + 1],
  );
  const closing = engine.computeBalances(e.rows, typeOf, e.opening);
  return {
    rowsBalanced: unbalancedRows.length === 0,
    unbalancedRows,
    opening: e.opening ? engine.checkEquation(e.opening, typeOf) : null,
    closing,
    equation: engine.checkEquation(closing, typeOf),
  };
}

/** Set (or clear, when `cents` is null) one opening balance line, in cents. */
export function setOpening(
  e: SandboxEntity,
  accountId: AccountId,
  cents: number | null,
): SandboxEntity {
  const lines = (e.opening?.lines ?? []).filter((l) => l.accountId !== accountId);
  if (cents !== null && Number.isFinite(cents))
    lines.push({ accountId, amount: Math.round(cents) });
  const order = new Map(e.accounts.map((a, i) => [a.id, i]));
  lines.sort((a, b) => (order.get(a.accountId) ?? 1e9) - (order.get(b.accountId) ?? 1e9));
  return { ...e, opening: lines.length ? { lines } : undefined };
}

/** Canonical order for all of an entity's accounts (used to seed manual ordering). */
export function canonicalOrder(e: SandboxEntity): AccountId[] {
  return engine
    .orderColumns(
      e.accounts.map((a) => ({
        accountId: a.id,
        type: a.type,
        contraOf: a.contraOf,
        equityGroup: a.equityGroup,
      })),
      e.accounts.map((a) => a.id),
    )
    .map((c) => c.accountId);
}

export function moveInOrder(order: AccountId[], id: AccountId, delta: -1 | 1): AccountId[] {
  const i = order.indexOf(id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= order.length) return order;
  const next = [...order];
  [next[i], next[j]] = [next[j]!, next[i]!];
  return next;
}

export function accountUsed(e: SandboxEntity, id: AccountId): boolean {
  return (
    e.rows.some((r) => r.postings.some((p) => p.accountId === id)) ||
    e.accounts.some((a) => a.contraOf === id)
  );
}

export function nextRowId(rows: { id: string }[]): string {
  const ids = new Set(rows.map((r) => r.id));
  let n = rows.length + 1;
  while (ids.has(`r${n}`)) n++;
  return `r${n}`;
}

export const fmtMoney = (cents: number) =>
  `${cents < 0 ? '−' : ''}$${(Math.abs(cents) / 100).toLocaleString('en-US')}`;

/** Builder convention: an empty (or missing) column order means "canonical" — stored as `undefined`. */
export function withColumnOrder(e: SandboxEntity, order: AccountId[] | undefined): SandboxEntity {
  const next = { ...e };
  if (order && order.length) next.columnOrder = order;
  else delete next.columnOrder;
  return next;
}

// ---- One account order for the whole Sandbox (both views, the Accounts panel, opening balances) ----
// Auto (no `columnOrder`): the conventional balance-sheet order, A ‖ L │ E, contras after their parent.
// Manual (`columnOrder` set): the learner's order; moving an account in either view edits it.

export const isManualOrder = (e: SandboxEntity) => !!e.columnOrder?.length;

/** Every account id in display order. In manual mode, accounts the order doesn't list yet go at the end. */
export function orderedIds(e: SandboxEntity): AccountId[] {
  const auto = canonicalOrder(e);
  if (!isManualOrder(e)) return auto;
  const have = new Set(auto);
  const manual = e.columnOrder!.filter((id) => have.has(id));
  return [...manual, ...auto.filter((id) => !manual.includes(id))];
}

export function orderedAccounts(e: SandboxEntity): Account[] {
  const byId = new Map(e.accounts.map((a) => [a.id, a]));
  return orderedIds(e).map((id) => byId.get(id)!);
}

/** Switch auto ↔ manual. Manual starts from the order you're looking at, so nothing jumps. */
export function setManualOrder(e: SandboxEntity, manual: boolean): SandboxEntity {
  return withColumnOrder(e, manual && e.accounts.length ? orderedIds(e) : undefined);
}

/** Move one account left/right in the manual order (a no-op in auto mode). */
export function moveAccountInOrder(e: SandboxEntity, id: AccountId, delta: -1 | 1): SandboxEntity {
  return isManualOrder(e) ? withColumnOrder(e, moveInOrder(orderedIds(e), id, delta)) : e;
}

/** Move a transaction row up/down — the same rows in both views. */
export function moveRow(e: SandboxEntity, i: number, delta: -1 | 1): SandboxEntity {
  const j = i + delta;
  if (i < 0 || j < 0 || i >= e.rows.length || j >= e.rows.length) return e;
  const rows = [...e.rows];
  [rows[i], rows[j]] = [rows[j]!, rows[i]!];
  return { ...e, rows };
}

export function removeRow(e: SandboxEntity, i: number): SandboxEntity {
  return { ...e, rows: e.rows.filter((_, j) => j !== i) };
}

// ---- Journal editing: an entry is a row; each line is one posting ----
// A line can be half-written (no account yet, or no amount yet). It lives in the state so the editor keeps it,
// but `persistable` drops it before the state goes into a link (the link format needs real ids, amounts > 0).

export const blankLine = (side: Side): Posting => ({ accountId: '', side, amount: 0 });

/** A new journal entry: one debit line and one credit line, ready to fill in. */
export function addEntry(e: SandboxEntity): SandboxEntity {
  return {
    ...e,
    rows: [...e.rows, { id: nextRowId(e.rows), postings: [blankLine('dr'), blankLine('cr')] }],
  };
}

function updateLines(e: SandboxEntity, ri: number, f: (ps: Posting[]) => Posting[]): SandboxEntity {
  return { ...e, rows: e.rows.map((r, i) => (i === ri ? { ...r, postings: f(r.postings) } : r)) };
}

export const addLine = (e: SandboxEntity, ri: number, side: Side) =>
  updateLines(e, ri, (ps) => [...ps, blankLine(side)]);

export const removeLine = (e: SandboxEntity, ri: number, li: number) =>
  updateLines(e, ri, (ps) => ps.filter((_, j) => j !== li));

/** Choose a line's account; the posting carries the account's type (as everywhere in the sandbox). */
export function setLineAccount(
  e: SandboxEntity,
  ri: number,
  li: number,
  accountId: AccountId,
): SandboxEntity {
  const type = e.accounts.find((a) => a.id === accountId)?.type;
  return updateLines(e, ri, (ps) =>
    ps.map((p, j) => {
      if (j !== li) return p;
      const next: Posting = { ...p, accountId };
      if (type) next.chosenType = type;
      else delete next.chosenType;
      return next;
    }),
  );
}

/** Type an amount into a line's debit or credit column. A line is one posting, so typing on the other side
 *  moves it there; clearing the side it's on leaves an empty line (kept while editing, not saved in links). */
export function setLineAmount(
  e: SandboxEntity,
  ri: number,
  li: number,
  side: Side,
  cents: Money,
): SandboxEntity {
  return updateLines(e, ri, (ps) =>
    ps.map((p, j) => {
      if (j !== li) return p;
      if (cents > 0) return { ...p, side, amount: cents };
      return p.side === side ? { ...p, amount: 0 } : p;
    }),
  );
}

/** Totals of an entry's lines (half-written lines count as 0). */
export function entryTotals(r: TransactionRow): { dr: Money; cr: Money } {
  let dr = 0;
  let cr = 0;
  for (const p of r.postings)
    if (p.side === 'dr') dr += p.amount;
    else cr += p.amount;
  return { dr, cr };
}

/** The state as it can be saved in a link: half-written lines (no account, or no amount) are left out. */
export function persistable(s: SandboxState): SandboxState {
  return {
    ...s,
    entities: s.entities.map((e) => ({
      ...e,
      rows: e.rows.map((r) => ({
        ...r,
        postings: r.postings.filter((p) => p.accountId && p.amount > 0),
      })),
    })),
  };
}
