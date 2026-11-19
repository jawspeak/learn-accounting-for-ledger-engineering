/** Pure helpers for the spreadsheet view (#/sheet). No React — easy to unit test. */
import type {
  Account,
  AccountId,
  AccountType,
  BalanceSheet,
  Money,
  SandboxEntity,
  Side,
  TransactionRow,
} from '@contracts';
import { engine } from '@engine';
import { nextRowId, setCell } from '../../components/builder/model';
import { typeResolver, uniqueId } from '../sandbox/model';

/** The sheet always shows at least this many event rows, so there's room to type. */
export const MIN_ROWS = 12;
/** …and this many blank rows below the last used one. */
export const SPARE_ROWS = 3;

/** Colour family for a type's header badge (contras share their parent's family). */
export type Tone = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense' | 'dividend';
export function toneOf(t: AccountType): Tone {
  switch (t) {
    case 'asset':
    case 'contra-asset':
      return 'asset';
    case 'liability':
    case 'contra-liability':
      return 'liability';
    case 'equity':
    case 'contra-equity':
      return 'equity';
    case 'revenue':
    case 'contra-revenue':
      return 'revenue';
    case 'expense':
      return 'expense';
    case 'dividend':
      return 'dividend';
  }
}

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

/** Rows shown: the stored rows plus blank ones, at least MIN_ROWS and SPARE_ROWS past the last used row. */
export function visibleRowCount(rows: TransactionRow[]): number {
  let lastUsed = -1;
  rows.forEach((r, i) => {
    if (r.postings.length || r.label) lastUsed = i;
  });
  return Math.max(MIN_ROWS, rows.length, lastUsed + 1 + SPARE_ROWS);
}

/** Make sure rows exist up to index `i` (typing into a blank row materialises it and any blanks above). */
export function ensureRows(rows: TransactionRow[], i: number): TransactionRow[] {
  const out = [...rows];
  while (out.length <= i) out.push({ id: nextRowId(out), postings: [] });
  return out;
}

export function updateRow(
  e: SandboxEntity,
  i: number,
  f: (r: TransactionRow) => TransactionRow,
): SandboxEntity {
  const rows = ensureRows(e.rows, i);
  return { ...e, rows: rows.map((r, j) => (j === i ? f(r) : r)) };
}

export function setAmount(
  e: SandboxEntity,
  i: number,
  accountId: AccountId,
  side: Side,
  cents: Money,
): SandboxEntity {
  const type = e.accounts.find((a) => a.id === accountId)?.type ?? 'asset';
  return updateRow(e, i, (r) => setCell(r, accountId, side, cents, type));
}

export function setLabel(e: SandboxEntity, i: number, label: string): SandboxEntity {
  return updateRow(e, i, (r) => {
    const next = { ...r };
    if (label) next.label = label;
    else delete next.label;
    return next;
  });
}

/** Opening balance for one account, on its normal side (negative = abnormal). 0 removes the line. */
export function setOpening(e: SandboxEntity, accountId: AccountId, cents: Money): SandboxEntity {
  const lines = (e.opening?.lines ?? []).filter((l) => l.accountId !== accountId);
  if (cents !== 0) {
    // Keep lines in column order so the sandbox's balance sheet lists them the same way.
    const order = new Map(e.accounts.map((a, i) => [a.id, i]));
    lines.push({ accountId, amount: cents });
    lines.sort((a, b) => (order.get(a.accountId) ?? 0) - (order.get(b.accountId) ?? 0));
  }
  const out: SandboxEntity = { ...e, opening: { lines } };
  if (lines.length === 0) delete out.opening;
  return out;
}

/** Balance per account on its normal side (opening + every row) — the same numbers the T-accounts view shows. */
export function sheetBalance(e: SandboxEntity): BalanceSheet {
  return engine.computeBalances(e.rows, typeResolver(e), e.opening);
}

export function addAccount(
  e: SandboxEntity,
  name: string,
  type: AccountType,
): { entity: SandboxEntity; id: AccountId } {
  const id = uniqueId(
    name,
    e.accounts.map((a) => a.id),
  );
  const account: Account = { id, name, type };
  if (contraBase(type)) {
    const parent = contraCandidates(e.accounts, type)[0];
    if (parent) account.contraOf = parent.id;
  }
  return { entity: { ...e, accounts: [...e.accounts, account] }, id };
}

/** Patch one account. Changing to a contra type picks a parent if none is set (the URL schema requires one). */
export function updateAccount(
  e: SandboxEntity,
  id: AccountId,
  patch: Partial<Omit<Account, 'id'>>,
): SandboxEntity {
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
  // Postings carry the type the learner chose; keep them in step with the column's type.
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

export function removeAccount(e: SandboxEntity, id: AccountId): SandboxEntity {
  const out: SandboxEntity = {
    ...e,
    // Contras that pointed at the removed account lose their parent; drop them back to the base type.
    accounts: e.accounts
      .filter((a) => a.id !== id)
      .map((a) =>
        a.contraOf === id ? { ...a, type: contraBase(a.type) ?? a.type, contraOf: undefined } : a,
      )
      .map((a) => {
        const c = { ...a };
        if (c.contraOf === undefined) delete c.contraOf;
        return c;
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

export function moveAccount(e: SandboxEntity, id: AccountId, delta: -1 | 1): SandboxEntity {
  const i = e.accounts.findIndex((a) => a.id === id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= e.accounts.length) return e;
  const accounts = [...e.accounts];
  [accounts[i], accounts[j]] = [accounts[j]!, accounts[i]!];
  return { ...e, accounts };
}

/** Reorder accounts into the canonical A ‖ L │ E order (contras right after their parent). */
export function sortCanonical(e: SandboxEntity): SandboxEntity {
  const ordered = engine.orderColumns(
    e.accounts.map((a) => ({
      accountId: a.id,
      type: a.type,
      contraOf: a.contraOf,
      equityGroup: a.equityGroup,
    })),
    e.accounts.map((a) => a.id),
  );
  const byId = new Map(e.accounts.map((a) => [a.id, a]));
  return { ...e, accounts: ordered.map((c) => byId.get(c.accountId)!).filter(Boolean) };
}

/** Index of the first right-hand (liability/equity) account, when the columns are in A ‖ L/E order; else -1. */
export function equalsAt(accounts: Account[]): number {
  const left = (t: AccountType) => toneOf(t) === 'asset';
  const first = accounts.findIndex((a) => !left(a.type));
  if (first <= 0) return -1;
  return accounts.slice(first).every((a) => !left(a.type)) ? first : -1;
}
