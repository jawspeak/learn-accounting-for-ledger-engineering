/** Pure helpers for the Grid view. No React — easy to unit test. Accounts, opening balances and the entry checks
 *  are shared with the other views (../model). */
import type {
  Account,
  AccountId,
  AccountType,
  BalanceSheet,
  Money,
  EntityBooks,
  Side,
  TransactionRow,
} from '@contracts';
import { engine } from '@engine';
import { setCell } from '../../components/builder/model';
import { postedRows, typeResolver } from '../model';

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

export function updateRow(
  e: EntityBooks,
  i: number,
  f: (r: TransactionRow) => TransactionRow,
): EntityBooks {
  return { ...e, rows: e.rows.map((r, j) => (j === i ? f(r) : r)) };
}

/** Type into an account's debit or credit cell of entry `i` (one posting per account and side; 0 removes it). */
export function setAmount(
  e: EntityBooks,
  i: number,
  accountId: AccountId,
  side: Side,
  cents: Money,
): EntityBooks {
  const type = e.accounts.find((a) => a.id === accountId)?.type ?? 'asset';
  return updateRow(e, i, (r) => setCell(r, accountId, side, cents, type));
}

export function setLabel(e: EntityBooks, i: number, label: string): EntityBooks {
  return updateRow(e, i, (r) => {
    const next = { ...r };
    if (label) next.label = label;
    else delete next.label;
    return next;
  });
}

/** Balance per account on its normal side (opening + every posted line) — the same numbers the T-accounts show. */
export function sheetBalance(e: EntityBooks): BalanceSheet {
  return engine.computeBalances(postedRows(e.rows), typeResolver(e), e.opening);
}

/** Index of the first right-hand (liability/equity) account, when the columns are in A ‖ L/E order; else -1. */
export function equalsAt(accounts: Account[]): number {
  const left = (t: AccountType) => toneOf(t) === 'asset';
  const first = accounts.findIndex((a) => !left(a.type));
  if (first <= 0) return -1;
  return accounts.slice(first).every((a) => !left(a.type)) ? first : -1;
}
