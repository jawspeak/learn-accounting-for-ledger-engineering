/** Pure helpers for the Sandbox (Scenario Board). No React here — easy to unit test. */
import type {
  Account,
  AccountId,
  AccountType,
  BalanceSheet,
  EntityCoA,
  EquationCheck,
  SandboxEntity,
  SandboxState,
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

/** kebab-case slug: "Cash – Vault" → "cash-vault". Never empty. */
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
    id: uniqueId(name, existing.map((e) => e.id), 'entity'),
    name,
    accounts: [],
    rows: [{ id: 'r1', postings: [] }],
    showBalanceSheets: false,
  };
}

export function duplicateEntity(existing: SandboxEntity[], src: SandboxEntity): SandboxEntity {
  const name = `${src.name} (copy)`;
  return { ...structuredClone(src), id: uniqueId(name, existing.map((e) => e.id), 'entity'), name };
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
  const openingLines = e.opening?.lines.map((l) => ({ ...l, accountId: sw(l.accountId) })).filter((l) => ids.has(l.accountId));
  const out: SandboxEntity = {
    ...e,
    accounts,
    rows: rename.size
      ? e.rows.map((r) => ({ ...r, postings: r.postings.map((p) => ({ ...p, accountId: sw(p.accountId) })) }))
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
  for (const r of e.rows) for (const p of r.postings) if (p.chosenType) chosen.set(p.accountId, p.chosenType);
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
  const unbalancedRows = e.rows.flatMap((r, i) => (r.postings.length === 0 || engine.rowTotals(r).balanced ? [] : [i + 1]));
  const closing = engine.computeBalances(e.rows, typeOf, e.opening);
  return {
    rowsBalanced: unbalancedRows.length === 0,
    unbalancedRows,
    opening: e.opening ? engine.checkEquation(e.opening, typeOf) : null,
    closing,
    equation: engine.checkEquation(closing, typeOf),
  };
}

/** Set (or clear, when `dollars` is null) one opening balance line. Amounts are whole dollars. */
export function setOpening(e: SandboxEntity, accountId: AccountId, dollars: number | null): SandboxEntity {
  const lines = (e.opening?.lines ?? []).filter((l) => l.accountId !== accountId);
  if (dollars !== null && Number.isFinite(dollars)) lines.push({ accountId, amount: Math.round(dollars) * 100 });
  const order = new Map(e.accounts.map((a, i) => [a.id, i]));
  lines.sort((a, b) => (order.get(a.accountId) ?? 1e9) - (order.get(b.accountId) ?? 1e9));
  return { ...e, opening: lines.length ? { lines } : undefined };
}

/** Canonical order for all of an entity's accounts (used to seed manual ordering). */
export function canonicalOrder(e: SandboxEntity): AccountId[] {
  return engine
    .orderColumns(
      e.accounts.map((a) => ({ accountId: a.id, type: a.type, contraOf: a.contraOf, equityGroup: a.equityGroup })),
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
