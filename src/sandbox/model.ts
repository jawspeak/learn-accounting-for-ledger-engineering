/** Pure helpers for the Sandbox (Scenario Board). No React here — easy to unit test. */
import type {
  Account,
  AccountId,
  AccountType,
  BalanceSheet,
  EquationCheck,
  Money,
  Posting,
  SandboxEntity,
  SandboxState,
  Side,
  TransactionRow,
} from '@contracts';
import { engine } from '@engine';

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
    rows: [],
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
  // An entry nobody has typed an amount into isn't an error yet — it's waiting to be filled in.
  const unbalancedRows = e.rows.flatMap((r, i) => {
    const c = entryCheck(r);
    return !c.started || c.balanced ? [] : [i + 1];
  });
  const closing = engine.computeBalances(postedRows(e.rows), typeOf, e.opening);
  return {
    rowsBalanced: unbalancedRows.length === 0,
    unbalancedRows,
    opening: e.opening ? engine.checkEquation(e.opening, typeOf) : null,
    closing,
    equation: engine.checkEquation(closing, typeOf),
  };
}

/** Set one opening balance line, in cents (negative = abnormal). Blank (null) and 0 both mean "no opening
 *  balance" and remove the line — the same in every view. */
export function setOpening(
  e: SandboxEntity,
  accountId: AccountId,
  cents: number | null,
): SandboxEntity {
  const lines = (e.opening?.lines ?? []).filter((l) => l.accountId !== accountId);
  if (cents !== null && Number.isFinite(cents) && Math.round(cents) !== 0)
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

// ---- Accounts: one add / rename / remove for every view (Grid header, Journal "New account…", Accounts panel) ----

/** The non-contra type a contra type reduces. */
const CONTRA_BASE: Partial<Record<AccountType, AccountType>> = {
  'contra-asset': 'asset',
  'contra-liability': 'liability',
  'contra-equity': 'equity',
  'contra-revenue': 'revenue',
};
export const contraBase = (t: AccountType) => CONTRA_BASE[t];

/** Accounts a contra account of type `t` could reduce (same family, not contra, not itself). */
export function contraCandidates(accounts: Account[], t: AccountType, self?: AccountId): Account[] {
  const base = contraBase(t);
  return base ? accounts.filter((a) => a.type === base && a.id !== self) : [];
}

/** Add an account: a unique slug id; a contra type reduces `contraOf` if given and valid, else the first
 *  candidate. In manual order it goes at the end (auto order places it by type). */
export function addAccount(
  e: SandboxEntity,
  name: string,
  type: AccountType,
  contraOf?: AccountId,
): { entity: SandboxEntity; id: AccountId } {
  const id = uniqueId(
    name,
    e.accounts.map((a) => a.id),
  );
  const account: Account = { id, name, type };
  const candidates = contraCandidates(e.accounts, type);
  if (candidates.length)
    account.contraOf = candidates.some((c) => c.id === contraOf) ? contraOf! : candidates[0]!.id;
  const entity: SandboxEntity = { ...e, accounts: [...e.accounts, account] };
  if (e.columnOrder?.length) entity.columnOrder = [...e.columnOrder, id];
  return { entity, id };
}

/** Patch one account. A blank name is ignored (an account always has a name). Changing to a contra type picks
 *  a parent if none is valid; postings are re-typed to match. */
export function updateAccount(
  e: SandboxEntity,
  id: AccountId,
  patch: Partial<Omit<Account, 'id'>>,
): SandboxEntity {
  if (patch.name !== undefined && !patch.name.trim()) {
    patch = { ...patch };
    delete patch.name;
  }
  const accounts = e.accounts.map((a) => {
    if (a.id !== id) return a;
    const next: Account = { ...a, ...patch };
    for (const k of ['subtitle', 'description'] as const) if (next[k] === '') delete next[k];
    if (contraBase(next.type)) {
      const ok = contraCandidates(e.accounts, next.type, id).some((c) => c.id === next.contraOf);
      if (!ok) {
        const parent = contraCandidates(e.accounts, next.type, id)[0];
        if (parent) next.contraOf = parent.id;
        else delete next.contraOf;
      }
    } else delete next.contraOf;
    if (next.type !== 'equity') delete next.equityGroup;
    return next;
  });
  // Postings carry the type the learner chose; keep them in step with the account's type.
  const type = accounts.find((a) => a.id === id)?.type;
  const rows =
    patch.type && type
      ? e.rows.map((r) =>
          r.postings.some((p) => p.accountId === id)
            ? {
                ...r,
                postings: r.postings.map((p) =>
                  p.accountId === id ? { ...p, chosenType: type } : p,
                ),
              }
            : r,
        )
      : e.rows;
  return { ...e, accounts, rows };
}

/** True when a contra account still needs a parent to be valid (and so can't be saved in a link yet). */
export const needsParent = (a: Account) => !!contraBase(a.type) && !a.contraOf;

/** How many lines post to this account (what removing it would also remove). */
export const linesUsing = (e: SandboxEntity, id: AccountId) =>
  e.rows.reduce((n, r) => n + r.postings.filter((p) => p.accountId === id).length, 0);

/** Remove an account with its lines, opening balance and place in the order. Contras that reduced it fall back
 *  to their base type. (The views ask first when it has lines.) */
export function removeAccount(e: SandboxEntity, id: AccountId): SandboxEntity {
  const out: SandboxEntity = {
    ...e,
    accounts: e.accounts
      .filter((a) => a.id !== id)
      .map((a) => {
        if (a.contraOf !== id) return a;
        const next: Account = { ...a, type: contraBase(a.type) ?? a.type };
        delete next.contraOf;
        return next;
      }),
    rows: e.rows.map((r) => ({ ...r, postings: r.postings.filter((p) => p.accountId !== id) })),
  };
  const lines = e.opening?.lines.filter((l) => l.accountId !== id) ?? [];
  if (lines.length) out.opening = { lines };
  else delete out.opening;
  if (e.columnOrder) {
    const order = e.columnOrder.filter((x) => x !== id);
    if (order.length) out.columnOrder = order;
    else delete out.columnOrder;
  }
  return out;
}

// ---- Journal editing: an entry is a row; each line is one posting ----
// A line can be half-written (no account yet, or no amount yet). It lives in the state so the editor keeps it,
// but `persistable` drops it before the state goes into a link (the link format needs real ids, amounts > 0).

export const blankLine = (side: Side): Posting => ({ accountId: '', side, amount: 0 });

/** A new entry at the end. In the Journal it starts with one debit line and one credit line, ready to fill in;
 *  in the Grid with no lines (each cell typed into adds one). */
export function addEntry(e: SandboxEntity, { blankLines = true } = {}): SandboxEntity {
  const postings = blankLines ? [blankLine('dr'), blankLine('cr')] : [];
  return { ...e, rows: [...e.rows, { id: nextRowId(e.rows), postings }] };
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

/** Type a line's amount. A line is a debit line or a credit line (chosen when it's added), so its amount
 *  stays on that side; clearing it leaves an empty line (kept while editing, not saved in links). */
export function setLineAmount(
  e: SandboxEntity,
  ri: number,
  li: number,
  cents: Money,
): SandboxEntity {
  return updateLines(e, ri, (ps) =>
    ps.map((p, j) => (j === li ? { ...p, amount: Math.max(0, cents) } : p)),
  );
}

// ---- One definition of "what an entry posts", shared by every view ----
// A line counts once it has an account and an amount > 0 — exactly what `persistable` keeps in a link. A
// half-written line counts nowhere (totals, ✓, balances), so no view shows a ✓ that reloading would take away.

/** Is this line posted (it has an account and an amount)? */
export const isPosted = (p: Posting) => !!p.accountId && p.amount > 0;

/** The rows with only their posted lines — what balances and T-accounts are computed from. */
export const postedRows = (rows: TransactionRow[]): TransactionRow[] =>
  rows.map((r) => ({ ...r, postings: r.postings.filter(isPosted) }));

export interface EntryCheck {
  /** Some amount has been typed (before that an entry is just waiting: no ✓ or ✗ anywhere). */
  started: boolean;
  /** Totals of the posted lines. */
  dr: Money;
  cr: Money;
  /** Lines with an amount but no account yet. */
  missingAccount: number;
  /** Debits = credits > 0, and every line with an amount has an account. */
  balanced: boolean;
}

/** The one balance check every view shows (Journal status, Grid "Dr = Cr?", the summary line). */
export function entryCheck(r: TransactionRow): EntryCheck {
  let dr = 0;
  let cr = 0;
  let missingAccount = 0;
  for (const p of r.postings) {
    if (p.amount > 0 && !p.accountId) missingAccount++;
    if (!isPosted(p)) continue;
    if (p.side === 'dr') dr += p.amount;
    else cr += p.amount;
  }
  return {
    started: r.postings.some((p) => p.amount > 0),
    dr,
    cr,
    missingAccount,
    balanced: dr === cr && dr > 0 && missingAccount === 0,
  };
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
