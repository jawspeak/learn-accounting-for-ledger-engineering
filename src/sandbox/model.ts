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
  EventRow,
  SandboxEntity,
  SandboxEvent,
  SandboxScenario,
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
  return {
    v: 3,
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
    events: [],
    opening: {},
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
  if (!isManualOrder(e)) return e.sortByNumber ? byNumber(e, auto) : auto;
  const have = new Set(auto);
  const manual = e.columnOrder!.filter((id) => have.has(id));
  return [...manual, ...auto.filter((id) => !manual.includes(id))];
}

export function orderedAccounts(e: EntityBooks): Account[] {
  const byId = new Map(e.accounts.map((a) => [a.id, a]));
  return orderedIds(e).map((id) => byId.get(id)!);
}

/** Switch auto ↔ manual. Manual starts from the order you're looking at, so nothing jumps. */
/** Numbered accounts by GL number (numeric-aware: "2" before "10"), then unnumbered ones in `fallback` order. */
function byNumber(e: EntityBooks, fallback: AccountId[]): AccountId[] {
  const num = new Map(e.accounts.map((a) => [a.id, a.number?.trim() ?? '']));
  const numbered = fallback
    .filter((id) => num.get(id))
    .sort((a, b) => num.get(a)!.localeCompare(num.get(b)!, undefined, { numeric: true }));
  return [...numbered, ...fallback.filter((id) => !num.get(id))];
}

/** The account order: Auto (balance-sheet), By number (GL number), or Manual (your own). */
export type OrderMode = 'auto' | 'number' | 'manual';
export const orderMode = (e: EntityBooks): OrderMode =>
  isManualOrder(e) ? 'manual' : e.sortByNumber ? 'number' : 'auto';

/** Switch the account order. Manual starts from the order you're looking at, so nothing jumps. */
export function setOrderMode(e: EntityBooks, mode: OrderMode): EntityBooks {
  const current = orderedIds(e);
  const next = withColumnOrder(
    { ...e },
    mode === 'manual' && e.accounts.length ? current : undefined,
  );
  if (mode === 'number') next.sortByNumber = true;
  else delete next.sortByNumber;
  return next;
}

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
  number?: string,
): { entity: EntityBooks; id: AccountId } {
  const id = uniqueId(
    name,
    e.accounts.map((a) => a.id),
  );
  const account: Account = { id, name, type };
  if (number?.trim()) account.number = number.trim();
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
    for (const k of ['subtitle', 'description', 'number'] as const)
      if (next[k] !== undefined && !next[k]!.trim()) delete next[k];
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

/** Type a line's amount in its Dr or Cr cell. A line is one posting, so typing in the other column moves it
 *  there (debit ↔ credit); clearing the side it's on leaves an empty line (kept while editing, not saved in
 *  links). With no `side`, the amount stays where the line is. */
export function setLineAmount(
  e: EntityBooks,
  ri: number,
  li: number,
  cents: Money,
  side?: Side,
): EntityBooks {
  return updateLines(e, ri, (ps) =>
    ps.map((p, j) => {
      if (j !== li) return p;
      const s = side ?? p.side;
      if (cents > 0) return { ...p, side: s, amount: cents };
      return s === p.side ? { ...p, amount: 0 } : p;
    }),
  );
}

/** A new line on the side that's short, so it reads as the next step: a credit when debits are ahead, else a
 *  debit. (Typing in the other column switches it.) */
export function nextLineSide(r: TransactionRow): Side {
  let dr = 0;
  let cr = 0;
  for (const p of r.postings)
    if (p.side === 'dr') dr += p.amount;
    else cr += p.amount;
  return dr > cr ? 'cr' : 'dr';
}

/** Journal convention: an entry's debits first, then its credits (each in the order written). Unchanged
 *  (the same object) when already in order. */
export function debitsFirst(e: EntityBooks, ri: number): EntityBooks {
  const ps = e.rows[ri]?.postings ?? [];
  const sorted = [...ps.filter((p) => p.side === 'dr'), ...ps.filter((p) => p.side === 'cr')];
  return sorted.every((p, i) => p === ps[i]) ? e : updateLines(e, ri, () => sorted);
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
 * a line's `chosenType` is dropped when its account exists (the account says the type), and an entity's empty
 * entry is left out (empty and missing both mean "not filled in yet") — shorter links.
 */
export function persistable(s: SandboxState): SandboxState {
  const known = new Map(s.entities.map((e) => [e.id, new Set(e.accounts.map((a) => a.id))]));
  return {
    ...s,
    scenarios: s.scenarios.map((sc) => ({
      ...sc,
      events: sc.events.map((ev) => {
        const lines: Record<string, Posting[]> = {};
        for (const [id, ps] of Object.entries(ev.lines)) {
          const kept = ps.filter(isPosted).map((p) => {
            if (!known.get(id)?.has(p.accountId)) return p;
            const out: Posting = { ...p };
            delete out.chosenType;
            return out;
          });
          if (kept.length) lines[id] = kept;
        }
        return { ...ev, lines };
      }),
    })),
  };
}

/**
 * Scenarios written as each entity's books (accounts + rows) → a state. Rows line up by position: row i of every
 * entity is event Ei (its label from the first entity that names it); a row marked `none`, or a missing one, means
 * that entity has no entry for the event. An entity's accounts are the union, by id, of its accounts in every
 * scenario (first definition wins), in first-seen order.
 */
export function stateFromBooks(
  title: string,
  scenarios: { id: string; title: string; text: string; books: EntityBooks[] }[],
): SandboxState {
  const entities: SandboxEntity[] = [];
  for (const sc of scenarios)
    for (const b of sc.books) {
      const def: SandboxEntity = {
        id: b.id,
        name: b.name,
        accounts: [...b.accounts],
        showBalanceSheets: b.showBalanceSheets,
      };
      if (b.columnOrder) def.columnOrder = b.columnOrder;
      if (b.code) def.code = b.code;
      if (b.sortByNumber) def.sortByNumber = true;
      const have = entities.find((e) => e.id === b.id);
      if (!have) entities.push(def);
      else
        for (const a of def.accounts)
          if (!have.accounts.some((x) => x.id === a.id)) have.accounts.push(a);
    }
  return {
    v: 3,
    title,
    entities,
    scenarios: scenarios.map((sc) => {
      const n = Math.max(0, ...sc.books.map((b) => b.rows.length));
      const events: SandboxEvent[] = Array.from({ length: n }, (_, i) => {
        const ev: SandboxEvent = { id: `e${i + 1}`, lines: {} };
        const none: string[] = [];
        // Every entity: one with no books in this scenario (or no row i) has no entry for the event.
        for (const entity of entities) {
          const r = sc.books.find((b) => b.id === entity.id)?.rows[i];
          if (!r || r.none) none.push(entity.id);
          else ev.lines[entity.id] = r.postings;
          if (r?.label && !ev.label) ev.label = r.label;
        }
        if (none.length) ev.none = none;
        return ev;
      });
      const opening: Record<string, BalanceSheet> = {};
      for (const b of sc.books) if (b.opening) opening[b.id] = b.opening;
      return { id: sc.id, title: sc.title, text: sc.text, events, opening };
    }),
  };
}

// ---- Entities × scenarios × events: the views edit one entity's books in one scenario (`EntityBooks`) ----
// Accounts, account order and the balance-sheet toggle belong to the entity (shared by every scenario). A scenario
// has its events (E1, E2…, shared by every entity) and each entity's opening balances. An entity's journal in a
// scenario is one row per event: its entry for that event, or `none` when the event doesn't touch its books.
// Adding, removing, moving or naming a row does it to the event — for every entity.

/** One event, as one entity's journal row. */
function rowOf(ev: SandboxEvent, entityId: string): EventRow {
  const r: EventRow = { id: ev.id, postings: ev.lines[entityId] ?? [] };
  if (ev.label) r.label = ev.label;
  if (ev.none?.includes(entityId)) r.none = true;
  return r;
}

/** Entity `ei`'s chart of accounts with its books in scenario `si`. */
export function booksOf(s: SandboxState, si: number, ei: number): EntityBooks {
  const e = s.entities[ei]!;
  const sc = s.scenarios[si];
  const out: EntityBooks = { ...e, rows: (sc?.events ?? []).map((ev) => rowOf(ev, e.id)) };
  const opening = sc?.opening[e.id];
  if (opening) out.opening = opening;
  return out;
}

/** Every entity's books in scenario `si` (the T-accounts view). */
export const allBooks = (s: SandboxState, si: number) =>
  s.entities.map((_, ei) => booksOf(s, si, ei));

/**
 * Write back an edit of entity `ei` in scenario `si`. Its rows are the scenario's events, in order: their order,
 * labels and existence apply to every entity; their lines and `none` to this one. The entity part is shared, so
 * when an account was removed its lines and opening balance go from every other scenario too.
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
        const byId = new Map(sc.events.map((ev) => [ev.id, ev]));
        const events = rows.map((r) => {
          const old = byId.get(r.id);
          const lines = { ...(old?.lines ?? {}) };
          if (r.none || !r.postings.length) delete lines[id];
          else lines[id] = r.postings;
          const none = new Set(old?.none ?? []);
          if (r.none) none.add(id);
          else none.delete(id);
          const ev: SandboxEvent = { id: r.id, lines };
          if (r.label) ev.label = r.label;
          if (none.size) ev.none = [...none];
          return ev;
        });
        const nextOpening = { ...sc.opening };
        if (opening) nextOpening[id] = opening;
        else delete nextOpening[id];
        return { ...sc, events, opening: nextOpening };
      }
      if (!removed) return sc;
      const nextOpening = { ...sc.opening };
      const lines = sc.opening[id]?.lines.filter((l) => keep(l.accountId)) ?? [];
      if (lines.length) nextOpening[id] = { lines };
      else delete nextOpening[id];
      return {
        ...sc,
        opening: nextOpening,
        events: sc.events.map((ev) =>
          ev.lines[id]
            ? {
                ...ev,
                lines: { ...ev.lines, [id]: ev.lines[id]!.filter((p) => keep(p.accountId)) },
              }
            : ev,
        ),
      };
    }),
  };
}

/** How many lines post to an account in each scenario (for "remove" confirmations and the chart of accounts). */
export function usageByScenario(s: SandboxState, entityId: string, accountId: AccountId): number[] {
  return s.scenarios.map((sc) => {
    const lines = sc.events.reduce(
      (n, ev) =>
        n +
        (ev.lines[entityId] ?? []).filter((p) => p.accountId === accountId && isPosted(p)).length,
      0,
    );
    const opening = sc.opening[entityId]?.lines.some(
      (l) => l.accountId === accountId && l.amount !== 0,
    )
      ? 1
      : 0;
    return lines + opening;
  });
}

/** One entity's part in one event: its lines are posted, it has explicitly no entry, or it's still to do. */
export type EventPart = 'posted' | 'none' | 'todo';
export function eventPart(ev: SandboxEvent, entityId: string): EventPart {
  if (ev.none?.includes(entityId)) return 'none';
  return (ev.lines[entityId] ?? []).some(isPosted) ? 'posted' : 'todo';
}

/** For each event of a scenario: every entity's part in it (name, index, part) — "Zap ✓ · Bank: no entry". */
export function eventParts(
  s: SandboxState,
  si: number,
): { entity: string; index: number; part: EventPart }[][] {
  return (s.scenarios[si]?.events ?? []).map((ev) =>
    s.entities.map((e, index) => ({ entity: e.name, index, part: eventPart(ev, e.id) })),
  );
}

export function addEntityTo(s: SandboxState, name: string): { state: SandboxState; index: number } {
  const e = newEntity(s.entities, name);
  return { state: { ...s, entities: [...s.entities, e] }, index: s.entities.length };
}

/** Duplicate an entity right after it: its accounts, and its entries and opening balances in every scenario. */
export function duplicateEntityIn(s: SandboxState, ei: number): SandboxState {
  const src = s.entities[ei]!;
  const copy = duplicateEntity(s.entities, src);
  return {
    ...s,
    entities: [...s.entities.slice(0, ei + 1), copy, ...s.entities.slice(ei + 1)],
    scenarios: s.scenarios.map((sc) => {
      const opening = { ...sc.opening };
      if (sc.opening[src.id]) opening[copy.id] = structuredClone(sc.opening[src.id]!);
      return {
        ...sc,
        opening,
        events: sc.events.map((ev) => {
          const out: SandboxEvent = { ...ev, lines: { ...ev.lines } };
          if (ev.lines[src.id]) out.lines[copy.id] = structuredClone(ev.lines[src.id]!);
          if (ev.none?.includes(src.id)) out.none = [...ev.none, copy.id];
          return out;
        }),
      };
    }),
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
      const opening = { ...sc.opening };
      delete opening[id];
      return {
        ...sc,
        opening,
        events: sc.events.map((ev) => {
          const lines = { ...ev.lines };
          delete lines[id];
          const out: SandboxEvent = { ...ev, lines };
          const none = ev.none?.filter((x) => x !== id);
          if (none?.length) out.none = none;
          else delete out.none;
          return out;
        }),
      };
    }),
  };
}

export function addScenarioTo(s: SandboxState): { state: SandboxState; index: number } {
  const sc = newScenario(s.scenarios, `Scenario ${s.scenarios.length + 1}`);
  return { state: { ...s, scenarios: [...s.scenarios, sc] }, index: s.scenarios.length };
}

/** Duplicate a scenario right after it (its text, events and opening balances). */
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

/**
 * A scenario's check, like a test result: "ok" when every entity's entries balance, A = L + E holds (opening
 * balances too), and every event that's been started has every entity's part filled in — an entry, or "no entry";
 * "bad" when any of that fails; "empty" before anything is posted.
 */
export type ScenarioStatus = 'empty' | 'ok' | 'bad';
export function scenarioStatus(s: SandboxState, si: number): ScenarioStatus {
  let posted = false;
  for (let ei = 0; ei < s.entities.length; ei++) {
    const b = booksOf(s, si, ei);
    const hasOpening = !!b.opening?.lines.some((l) => l.amount !== 0);
    if (!hasOpening && !b.rows.some((r) => entryCheck(r).started)) continue;
    posted = true;
    const sum = summarize(b);
    if (!sum.rowsBalanced || !sum.equation.balanced || (sum.opening && !sum.opening.balanced))
      return 'bad';
  }
  // An event someone has posted to, with another entity's part still blank: the other side is missing.
  for (const parts of eventParts(s, si))
    if (parts.some((p) => p.part === 'posted') && parts.some((p) => p.part === 'todo'))
      return 'bad';
  return posted ? 'ok' : 'empty';
}

/** "E1", "E2", … — an event's number, the same in every entity's books. */
export const eventNumber = (i: number) => `E${i + 1}`;

/** "S1", "S2", … — a scenario's short name in tabs and the chart of accounts. */
export const scenarioNumber = (si: number) => `S${si + 1}`;

/** The first line of a scenario's story as plain text (markdown marks stripped), for its one-line summary. */
export function storyLine(text: string): string {
  const first = text.split('\n').find((l) => l.trim()) ?? '';
  return first
    .replace(/^\s*(#+|[-*]|\d+\.)\s+/, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`]/g, '')
    .trim();
}
