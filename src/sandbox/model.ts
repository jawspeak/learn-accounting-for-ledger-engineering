/** Pure helpers for the Sandbox (Scenario Board). No React here — easy to unit test. */
import type {
  Account,
  AccountId,
  AccountType,
  BalanceSheet,
  EquationCheck,
  Money,
  Posting,
  EntityBooks,
  SandboxEntity,
  SandboxScenario,
  SandboxState,
  ScenarioBooks,
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
  return {
    v: 2,
    title: '',
    entities: [newEntity([], 'You')],
    scenarios: [newScenario([], 'Scenario 1')],
  };
}

export function newScenario(existing: SandboxScenario[], title: string): SandboxScenario {
  return {
    id: uniqueId(
      title,
      existing.map((s) => s.id),
      'scenario',
    ),
    title,
    text: '',
    books: {},
  };
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
export function applyAccounts(e: EntityBooks, next: Account[]): EntityBooks {
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
  const out: EntityBooks = {
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

export function typeResolver(e: EntityBooks): (id: AccountId) => AccountType | undefined {
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

export function summarize(e: EntityBooks): EntitySummary {
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
  e: EntityBooks,
  accountId: AccountId,
  cents: number | null,
): EntityBooks {
  const lines = (e.opening?.lines ?? []).filter((l) => l.accountId !== accountId);
  if (cents !== null && Number.isFinite(cents) && Math.round(cents) !== 0)
    lines.push({ accountId, amount: Math.round(cents) });
  const order = new Map(e.accounts.map((a, i) => [a.id, i]));
  lines.sort((a, b) => (order.get(a.accountId) ?? 1e9) - (order.get(b.accountId) ?? 1e9));
  return { ...e, opening: lines.length ? { lines } : undefined };
}

/** Canonical order for all of an entity's accounts (used to seed manual ordering). */
export function canonicalOrder(e: EntityBooks): AccountId[] {
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

export function accountUsed(e: EntityBooks, id: AccountId): boolean {
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
export function withColumnOrder(e: EntityBooks, order: AccountId[] | undefined): EntityBooks {
  const next = { ...e };
  if (order && order.length) next.columnOrder = order;
  else delete next.columnOrder;
  return next;
}

// ---- One account order for the whole Sandbox (both views, the Accounts panel, opening balances) ----
// Auto (no `columnOrder`): the conventional balance-sheet order, A ‖ L │ E, contras after their parent.
// Manual (`columnOrder` set): the learner's order; moving an account in either view edits it.

export const isManualOrder = (e: EntityBooks) => !!e.columnOrder?.length;

/** Every account id in display order. In manual mode, accounts the order doesn't list yet go at the end. */
export function orderedIds(e: EntityBooks): AccountId[] {
  const auto = canonicalOrder(e);
  if (!isManualOrder(e)) return auto;
  const have = new Set(auto);
  const manual = e.columnOrder!.filter((id) => have.has(id));
  return [...manual, ...auto.filter((id) => !manual.includes(id))];
}

export function orderedAccounts(e: EntityBooks): Account[] {
  const byId = new Map(e.accounts.map((a) => [a.id, a]));
  return orderedIds(e).map((id) => byId.get(id)!);
}

/** Switch auto ↔ manual. Manual starts from the order you're looking at, so nothing jumps. */
export function setManualOrder(e: EntityBooks, manual: boolean): EntityBooks {
  return withColumnOrder(e, manual && e.accounts.length ? orderedIds(e) : undefined);
}

/** Move one account left/right in the manual order (a no-op in auto mode). */
export function moveAccountInOrder(e: EntityBooks, id: AccountId, delta: -1 | 1): EntityBooks {
  return isManualOrder(e) ? withColumnOrder(e, moveInOrder(orderedIds(e), id, delta)) : e;
}

/** Move a transaction row up/down — the same rows in both views. */
export function moveRow(e: EntityBooks, i: number, delta: -1 | 1): EntityBooks {
  const j = i + delta;
  if (i < 0 || j < 0 || i >= e.rows.length || j >= e.rows.length) return e;
  const rows = [...e.rows];
  [rows[i], rows[j]] = [rows[j]!, rows[i]!];
  return { ...e, rows };
}

export function removeRow(e: EntityBooks, i: number): EntityBooks {
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
  e: EntityBooks,
  name: string,
  type: AccountType,
  contraOf?: AccountId,
): { entity: EntityBooks; id: AccountId } {
  const id = uniqueId(
    name,
    e.accounts.map((a) => a.id),
  );
  const account: Account = { id, name, type };
  const candidates = contraCandidates(e.accounts, type);
  if (candidates.length)
    account.contraOf = candidates.some((c) => c.id === contraOf) ? contraOf! : candidates[0]!.id;
  const entity: EntityBooks = { ...e, accounts: [...e.accounts, account] };
  if (e.columnOrder?.length) entity.columnOrder = [...e.columnOrder, id];
  return { entity, id };
}

/** Patch one account. A blank name is ignored (an account always has a name). Changing to a contra type picks
 *  a parent if none is valid; postings are re-typed to match. */
export function updateAccount(
  e: EntityBooks,
  id: AccountId,
  patch: Partial<Omit<Account, 'id'>>,
): EntityBooks {
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
export const linesUsing = (e: EntityBooks, id: AccountId) =>
  e.rows.reduce((n, r) => n + r.postings.filter((p) => p.accountId === id).length, 0);

/** Remove an account with its lines, opening balance and place in the order. Contras that reduced it fall back
 *  to their base type. (The views ask first when it has lines.) */
export function removeAccount(e: EntityBooks, id: AccountId): EntityBooks {
  const out: EntityBooks = {
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
export function addEntry(e: EntityBooks, { blankLines = true } = {}): EntityBooks {
  const postings = blankLines ? [blankLine('dr'), blankLine('cr')] : [];
  return { ...e, rows: [...e.rows, { id: nextRowId(e.rows), postings }] };
}

function updateLines(e: EntityBooks, ri: number, f: (ps: Posting[]) => Posting[]): EntityBooks {
  return { ...e, rows: e.rows.map((r, i) => (i === ri ? { ...r, postings: f(r.postings) } : r)) };
}

export const addLine = (e: EntityBooks, ri: number, side: Side) =>
  updateLines(e, ri, (ps) => [...ps, blankLine(side)]);

export const removeLine = (e: EntityBooks, ri: number, li: number) =>
  updateLines(e, ri, (ps) => ps.filter((_, j) => j !== li));

/** Choose a line's account; the posting carries the account's type (as everywhere in the sandbox). */
export function setLineAccount(
  e: EntityBooks,
  ri: number,
  li: number,
  accountId: AccountId,
): EntityBooks {
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
export function setLineAmount(e: EntityBooks, ri: number, li: number, cents: Money): EntityBooks {
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

/**
 * The state as it can be saved in a link or a file: half-written lines (no account, or no amount) are left out,
 * and a line's `chosenType` is dropped when its account exists (the account says the type) — shorter links.
 */
export function persistable(s: SandboxState): SandboxState {
  return {
    ...s,
    scenarios: s.scenarios.map((sc) => ({
      ...sc,
      books: Object.fromEntries(
        Object.entries(sc.books).map(([id, b]) => {
          const known = new Set(s.entities.find((e) => e.id === id)?.accounts.map((a) => a.id));
          const out: ScenarioBooks = {
            ...b,
            rows: b.rows.map((r) => ({
              ...r,
              postings: r.postings.filter(isPosted).map((p) => {
                if (!known.has(p.accountId)) return p;
                const out: Posting = { ...p };
                delete out.chosenType;
                return out;
              }),
            })),
          };
          return [id, out];
        }),
      ),
    })),
  };
}

/** Scenarios written as each entity's books (accounts + rows) → a state. An entity's accounts are the union, by
 *  id, of its accounts in every scenario (first definition wins), in first-seen order. */
export function stateFromBooks(
  title: string,
  scenarios: { id: string; title: string; text: string; books: EntityBooks[] }[],
): SandboxState {
  const entities: SandboxEntity[] = [];
  for (const sc of scenarios)
    for (const b of sc.books) {
      const { rows: _r, opening: _o, ...def } = b;
      void _r;
      void _o;
      const have = entities.find((e) => e.id === b.id);
      if (!have) entities.push({ ...def, accounts: [...def.accounts] });
      else
        for (const a of def.accounts)
          if (!have.accounts.some((x) => x.id === a.id)) have.accounts.push(a);
    }
  return {
    v: 2,
    title,
    entities,
    scenarios: scenarios.map((sc) => ({
      id: sc.id,
      title: sc.title,
      text: sc.text,
      books: Object.fromEntries(
        sc.books.map((b) => {
          const books: ScenarioBooks = { rows: b.rows };
          if (b.opening) books.opening = b.opening;
          return [b.id, books];
        }),
      ),
    })),
  };
}

// ---- Entities × scenarios: the views edit one entity's books in one scenario (`EntityBooks`) ----
// Accounts, account order and the balance-sheet toggle belong to the entity (shared by every scenario); entries
// and opening balances belong to the scenario.

const NO_BOOKS: ScenarioBooks = { rows: [] };

/** Entity `ei`'s chart of accounts with its books in scenario `si`. */
export function booksOf(s: SandboxState, si: number, ei: number): EntityBooks {
  const e = s.entities[ei]!;
  const b = s.scenarios[si]?.books[e.id] ?? NO_BOOKS;
  const out: EntityBooks = { ...e, rows: b.rows };
  if (b.opening) out.opening = b.opening;
  return out;
}

/** Every entity's books in scenario `si` (the T-accounts view). */
export const allBooks = (s: SandboxState, si: number) =>
  s.entities.map((_, ei) => booksOf(s, si, ei));

/**
 * Write back an edit of entity `ei` in scenario `si`. The entity part is shared, so when an account was removed
 * its lines and opening balance go from every other scenario too (an id that no longer exists can't be posted to).
 */
export function withBooks(s: SandboxState, si: number, ei: number, b: EntityBooks): SandboxState {
  const { rows, opening, ...entity } = b;
  const id = s.entities[ei]!.id;
  const ids = new Set(entity.accounts.map((a) => a.id));
  const removed = s.entities[ei]!.accounts.some((a) => !ids.has(a.id));
  const keep = (accountId: AccountId) => !accountId || ids.has(accountId);
  return {
    ...s,
    entities: s.entities.map((x, j) => (j === ei ? entity : x)),
    scenarios: s.scenarios.map((sc, j) => {
      if (j === si) {
        const books: ScenarioBooks = { rows };
        if (opening) books.opening = opening;
        return { ...sc, books: { ...sc.books, [id]: books } };
      }
      const other = sc.books[id];
      if (!removed || !other) return sc;
      const pruned: ScenarioBooks = {
        rows: other.rows.map((r) => ({
          ...r,
          postings: r.postings.filter((p) => keep(p.accountId)),
        })),
      };
      const lines = other.opening?.lines.filter((l) => keep(l.accountId)) ?? [];
      if (lines.length) pruned.opening = { lines };
      return { ...sc, books: { ...sc.books, [id]: pruned } };
    }),
  };
}

/** How many lines post to an account in each scenario (for "remove" confirmations and the chart of accounts). */
export function usageByScenario(s: SandboxState, entityId: string, accountId: AccountId): number[] {
  return s.scenarios.map((sc) => {
    const b = sc.books[entityId];
    if (!b) return 0;
    const lines = b.rows.reduce(
      (n, r) => n + r.postings.filter((p) => p.accountId === accountId && isPosted(p)).length,
      0,
    );
    const opening = b.opening?.lines.some((l) => l.accountId === accountId && l.amount !== 0)
      ? 1
      : 0;
    return lines + opening;
  });
}

export function addEntityTo(s: SandboxState, name: string): { state: SandboxState; index: number } {
  const e = newEntity(s.entities, name);
  return { state: { ...s, entities: [...s.entities, e] }, index: s.entities.length };
}

/** Duplicate an entity right after it: its accounts, and its books in every scenario. */
export function duplicateEntityIn(s: SandboxState, ei: number): SandboxState {
  const src = s.entities[ei]!;
  const copy = duplicateEntity(s.entities, src);
  return {
    ...s,
    entities: [...s.entities.slice(0, ei + 1), copy, ...s.entities.slice(ei + 1)],
    scenarios: s.scenarios.map((sc) =>
      sc.books[src.id]
        ? { ...sc, books: { ...sc.books, [copy.id]: structuredClone(sc.books[src.id]!) } }
        : sc,
    ),
  };
}

/** Remove an entity and its books in every scenario (at least one entity always remains). */
export function removeEntityFrom(s: SandboxState, ei: number): SandboxState {
  const id = s.entities[ei]!.id;
  const rest = s.entities.filter((_, j) => j !== ei);
  return {
    ...s,
    entities: rest.length ? rest : [newEntity([], 'You')],
    scenarios: s.scenarios.map((sc) => {
      const books = { ...sc.books };
      delete books[id];
      return { ...sc, books };
    }),
  };
}

export function addScenarioTo(s: SandboxState): { state: SandboxState; index: number } {
  const sc = newScenario(s.scenarios, `Scenario ${s.scenarios.length + 1}`);
  return { state: { ...s, scenarios: [...s.scenarios, sc] }, index: s.scenarios.length };
}

/** Duplicate a scenario right after it (its text, entries and opening balances). */
export function duplicateScenarioIn(s: SandboxState, si: number): SandboxState {
  const src = s.scenarios[si]!;
  const title = `${src.title} (copy)`;
  const copy: SandboxScenario = {
    ...structuredClone(src),
    id: uniqueId(
      title,
      s.scenarios.map((x) => x.id),
      'scenario',
    ),
    title,
  };
  return { ...s, scenarios: [...s.scenarios.slice(0, si + 1), copy, ...s.scenarios.slice(si + 1)] };
}

/** Remove a scenario (at least one always remains). */
export function removeScenarioFrom(s: SandboxState, si: number): SandboxState {
  const rest = s.scenarios.filter((_, j) => j !== si);
  return { ...s, scenarios: rest.length ? rest : [newScenario([], 'Scenario 1')] };
}

export function moveScenario(s: SandboxState, si: number, delta: -1 | 1): SandboxState {
  const j = si + delta;
  if (j < 0 || j >= s.scenarios.length) return s;
  const scenarios = [...s.scenarios];
  [scenarios[si], scenarios[j]] = [scenarios[j]!, scenarios[si]!];
  return { ...s, scenarios };
}

export const updateScenario = (
  s: SandboxState,
  si: number,
  patch: Partial<Pick<SandboxScenario, 'title' | 'text'>>,
): SandboxState => ({
  ...s,
  scenarios: s.scenarios.map((sc, j) => (j === si ? { ...sc, ...patch } : sc)),
});
