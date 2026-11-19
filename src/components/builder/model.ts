/**
 * Pure helpers for the T-account builder (no React). Money is integer cents; the UI shows whole dollars.
 */
import type {
  Account,
  AccountId,
  AccountType,
  ColumnGroup,
  CorrectPart,
  DiagnosticLocation,
  Money,
  Side,
  TransactionRow,
} from '@contracts';
import { engine } from '@engine';

export interface Column {
  accountId: AccountId;
  /** The type the learner chose (or the real type for prefilled rows without a chosen type). */
  type: AccountType;
}

export interface PlacedColumn extends Column {
  group: ColumnGroup;
}

/** Types offered in the picker, in teaching order (DEALER groups first, contras last). */
export const PICKER_TYPES: { type: AccountType; label: string }[] = [
  { type: 'asset', label: 'Asset' },
  { type: 'liability', label: 'Liability' },
  { type: 'equity', label: 'Equity' },
  { type: 'revenue', label: 'Revenue' },
  { type: 'expense', label: 'Expense' },
  { type: 'dividend', label: 'Dividends / Draws' },
  { type: 'contra-asset', label: 'Contra-asset' },
  { type: 'contra-liability', label: 'Contra-liability' },
  { type: 'contra-revenue', label: 'Contra-revenue' },
];

const CONTRA_TYPES = new Set<AccountType>([
  'contra-asset',
  'contra-liability',
  'contra-equity',
  'contra-revenue',
]);
export const isContraType = (t: AccountType) => CONTRA_TYPES.has(t);

/**
 * Filter accounts by a search query and rank the matches: exact name, then name prefix, then a word prefix,
 * then any substring. Ties keep the incoming (deterministic, alphabetical) order. An empty query keeps everything.
 */
export function rankAccounts<T extends { name: string }>(accounts: T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  if (q === '') return accounts;
  const score = (name: string): number => {
    const n = name.toLowerCase();
    if (n === q) return 0;
    if (n.startsWith(q)) return 1;
    if (n.split(/[^a-z0-9]+/).some((w) => w.startsWith(q))) return 2;
    return n.includes(q) ? 3 : -1;
  };
  return accounts
    .map((a, i) => ({ a, i, s: score(a.name) }))
    .filter((x) => x.s >= 0)
    .sort((x, y) => x.s - y.s || x.i - y.i)
    .map((x) => x.a);
}

const TYPE_LABEL: Record<AccountType, string> = {
  asset: 'Asset',
  'contra-asset': 'Contra-asset',
  liability: 'Liability',
  'contra-liability': 'Contra-liability',
  equity: 'Equity',
  'contra-equity': 'Contra-equity',
  revenue: 'Revenue',
  'contra-revenue': 'Contra-revenue',
  expense: 'Expense',
  dividend: 'Dividends',
};
export const typeLabel = (t: AccountType) => TYPE_LABEL[t];

export const GROUP_LABEL: Record<ColumnGroup, string> = {
  assets: 'Assets',
  liabilities: 'Liabilities',
  'equity-paid-in': 'Paid-in capital',
  'equity-retained': 'Retained earnings',
  revenue: 'Revenue',
  expenses: 'Expenses',
  dividends: 'Dividends',
};
export const isEquityGroup = (g: ColumnGroup) => g !== 'assets' && g !== 'liabilities';

/** "$1,234" (negative → "−$1,234"). Cents are shown as whole dollars (v1 content is whole dollars). */
export function formatDollars(cents: Money): string {
  const abs = Math.abs(cents) / 100;
  // Whole dollars as "$1,200"; anything with cents shows both digits ("$44.20", not "$44.2").
  const digits = cents % 100 === 0 ? 0 : 2;
  const s = `$${abs.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: 2 })}`;
  return cents < 0 ? `−${s}` : s;
}

/** Plain number for an input field: 10000 → "100"; 0 → "". */
export function centsToInput(cents: Money): string {
  return cents === 0 ? '' : String(cents / 100);
}

/**
 * Parse a whole-dollar input into cents. Accepts "1,000", "$100", " 25 ". Empty → 0.
 * Returns null for anything that isn't a whole number (so the input can reject the keystroke).
 */
export function parseDollars(
  input: string,
  opts: { allowNegative?: boolean; allowCents?: boolean } = {},
): Money | null {
  const s = input.replace(/[\s,$]/g, '');
  if (s === '' || (opts.allowNegative && s === '-')) return 0;
  // Whole dollars (problems), or up to two decimals (the sandbox): "44", "44.", "44.2", "44.24".
  const re = opts.allowCents
    ? opts.allowNegative
      ? /^-?(\d+\.?\d{0,2}|\.\d{1,2})$/
      : /^(\d+\.?\d{0,2}|\.\d{1,2})$/
    : opts.allowNegative
      ? /^-?\d+$/
      : /^\d+$/;
  if (!re.test(s)) return null;
  const neg = s.startsWith('-');
  const [whole = '', frac = ''] = s.replace('-', '').split('.');
  const cents = Number(whole || '0') * 100 + Number(frac.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents)) return null;
  return neg ? -cents : cents;
}

/** Sum of postings for one account/side in a row. */
export function cellAmount(row: TransactionRow, accountId: AccountId, side: Side): Money {
  let sum = 0;
  for (const p of row.postings) if (p.accountId === accountId && p.side === side) sum += p.amount;
  return sum;
}

/** Replace the account/side cell in a row with one posting of `amount` (0 removes it). */
export function setCell(
  row: TransactionRow,
  accountId: AccountId,
  side: Side,
  amount: Money,
  chosenType: AccountType,
): TransactionRow {
  const idx = row.postings.findIndex((p) => p.accountId === accountId && p.side === side);
  const rest = row.postings.filter((p) => !(p.accountId === accountId && p.side === side));
  if (amount <= 0) return { ...row, postings: rest };
  const posting = { accountId, side, amount, chosenType };
  // Keep the posting at its original position so journal order is stable while typing.
  const at = idx === -1 ? rest.length : idx;
  return { ...row, postings: [...rest.slice(0, at), posting, ...rest.slice(at)] };
}

/** A row id not already used. */
export function nextRowId(rows: TransactionRow[]): string {
  const used = new Set(rows.map((r) => r.id));
  let n = rows.length + 1;
  while (used.has(`r${n}`)) n++;
  return `r${n}`;
}

/** kebab-case id from a name, unique among `taken`. */
export function slugId(name: string, taken: Iterable<string>): string {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'account';
  const set = new Set(taken);
  let id = base;
  for (let i = 2; set.has(id); i++) id = `${base}-${i}`;
  return id;
}

/**
 * Columns in play: explicitly added columns (with their chosen type) first, then any account that appears
 * in the rows but isn't a column yet (type = the posting's chosenType, else the account's real type — only
 * prefilled/authored rows lack a chosen type).
 */
export function deriveColumns(
  cols: Column[],
  rows: TransactionRow[],
  accounts: Account[],
): Column[] {
  const out = new Map<AccountId, AccountType>(cols.map((c) => [c.accountId, c.type]));
  for (const r of rows)
    for (const p of r.postings) {
      if (out.has(p.accountId)) continue;
      const t = p.chosenType ?? accounts.find((a) => a.id === p.accountId)?.type ?? 'asset';
      out.set(p.accountId, t);
    }
  return [...out].map(([accountId, type]) => ({ accountId, type }));
}

/** Initial column state from the rows' chosen types. */
export function columnsFromRows(rows: TransactionRow[]): Column[] {
  const seen = new Map<AccountId, AccountType>();
  for (const r of rows)
    for (const p of r.postings)
      if (p.chosenType && !seen.has(p.accountId)) seen.set(p.accountId, p.chosenType);
  return [...seen].map(([accountId, type]) => ({ accountId, type }));
}

/** Canonical placement (VISION-2 §5) by the learner's chosen type. */
export function placeColumns(
  cols: Column[],
  accounts: Account[],
  coaOrder: AccountId[],
): PlacedColumn[] {
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const typeById = new Map(cols.map((c) => [c.accountId, c.type]));
  const canonical = engine
    .orderColumns(
      cols.map((c) => {
        const a = byId.get(c.accountId);
        return {
          accountId: c.accountId,
          type: c.type,
          contraOf: c.type.startsWith('contra-') ? a?.contraOf : undefined,
          equityGroup:
            c.type === 'equity' || c.type === 'contra-equity' ? a?.equityGroup : undefined,
        };
      }),
      coaOrder,
    )
    .map((o) => ({ ...o, type: typeById.get(o.accountId)! }));
  return canonical;
}

/** Index in `placed` where the `=` divider goes (first non-asset column), or -1 if the order isn't grouped. */
export function equalsIndex(placed: PlacedColumn[]): number {
  const i = placed.findIndex((c) => c.group !== 'assets');
  if (i === -1) return -1;
  if (placed.slice(i).some((c) => c.group === 'assets')) return -1;
  return i;
}

/** Consecutive runs of the same key — used for header bands. */
export function runs<T, K>(
  items: T[],
  key: (t: T) => K,
): { key: K; start: number; length: number }[] {
  const out: { key: K; start: number; length: number }[] = [];
  items.forEach((it, i) => {
    const k = key(it);
    const last = out[out.length - 1];
    if (last && last.key === k) last.length++;
    else out.push({ key: k, start: i, length: 1 });
  });
  return out;
}

// ---- feedback overlays ----

export function isCorrectCell(
  parts: CorrectPart[] | undefined,
  rowId: string,
  accountId: AccountId,
): boolean {
  return !!parts?.some((p) => p.rowId === rowId && p.accountId === accountId);
}
export function isCorrectColumn(parts: CorrectPart[] | undefined, accountId: AccountId): boolean {
  return !!parts?.some((p) => p.rowId === undefined && p.accountId === accountId);
}
export function isCorrectRow(parts: CorrectPart[] | undefined, rowId: string): boolean {
  return !!parts?.some((p) => p.rowId === rowId && p.accountId === undefined);
}

export type HighlightTarget = 'cell' | 'cell-filled' | 'column' | 'type' | 'row' | 'bs-line';

/**
 * Resolve a diagnostic location against what's actually on screen. An accountId that isn't a column
 * (e.g. a MISSING_ACCOUNT pointing at the solution's account) is dropped so highlighting never leaks it.
 */
export function resolveHighlight(
  loc: DiagnosticLocation,
  columnIds: Set<AccountId>,
): { rowId?: string; accountId?: AccountId; target: HighlightTarget } | null {
  const accountId = loc.accountId && columnIds.has(loc.accountId) ? loc.accountId : undefined;
  if (loc.field === 'bs-line')
    return loc.accountId ? { accountId: loc.accountId, target: 'bs-line' } : null;
  if (loc.field === 'type' && accountId) return { rowId: loc.rowId, accountId, target: 'type' };
  if (loc.rowId && accountId)
    return { rowId: loc.rowId, accountId, target: loc.field === 'amount' ? 'cell-filled' : 'cell' };
  if (accountId) return { accountId, target: 'column' };
  if (loc.rowId) return { rowId: loc.rowId, target: 'row' };
  return null;
}
