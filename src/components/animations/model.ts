/**
 * Plain-data model for ledger step-through animations.
 * Every step is a full snapshot (no hidden state), so the data can be verified in tests:
 * every posted row balances and every balance sheet shown satisfies A = L + E.
 */
import type { Account, AccountId, AccountType, BalanceLine, Money, Posting, TransactionRow } from '@contracts';
import { computeBalances, checkEquation, rowTotals } from '@engine';

export type LedgerId = string;

/** One set of books shown in the animation (e.g. "Your books", "First Example Bank's books"). */
export interface AnimLedger {
  id: LedgerId;
  title: string;
  /** Every account that can appear in this ledger (rows, opening balances, balance sheet). */
  accounts: Account[];
  /** Accounts drawn as T-accounts, in display order. */
  tAccounts: AccountId[];
  /** Opening balances (positive = on the account's normal side). */
  opening: BalanceLine[];
  showBalanceSheet: boolean;
}

export interface AccountRef {
  ledger: LedgerId;
  account: AccountId;
}

/** A money token that slides from one T-account to another on this step. */
export interface Flow {
  from: AccountRef;
  to: AccountRef;
  amount: Money;
}

export interface Highlight extends AccountRef {
  /** Short badge text, e.g. "no change". */
  note?: string;
}

/** A row being built up on screen. May be incomplete (unbalanced) — it is not posted and not in any balance. */
export interface DraftRow {
  ledger: LedgerId;
  row: TransactionRow;
}

export interface AnimStep {
  /** Markdown (trusted, authored). */
  caption: string;
  /** Posted rows so far, per ledger (cumulative snapshot). Every posted row must balance. */
  posted: Record<LedgerId, TransactionRow[]>;
  draft?: DraftRow;
  flows?: Flow[];
  highlight?: Highlight[];
}

export interface LedgerAnimationDef {
  id: string;
  title: string;
  ledgers: AnimLedger[];
  steps: AnimStep[];
}

/** Whole dollars → integer cents (the contracts' Money unit). */
export const usd = (dollars: number): Money => Math.round(dollars * 100);

export const formatMoney = (cents: Money): string => {
  const sign = cents < 0 ? '−' : '';
  return `${sign}$${(Math.abs(cents) / 100).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
};

export const dr = (accountId: AccountId, dollars: number): Posting => ({ accountId, side: 'dr', amount: usd(dollars) });
export const cr = (accountId: AccountId, dollars: number): Posting => ({ accountId, side: 'cr', amount: usd(dollars) });

export const typeLookup = (ledger: AnimLedger) => {
  const byId = new Map(ledger.accounts.map((a) => [a.id, a.type]));
  return (id: AccountId): AccountType | undefined => byId.get(id);
};

export const accountOf = (ledger: AnimLedger, id: AccountId): Account | undefined =>
  ledger.accounts.find((a) => a.id === id);

/** Balances (opening + rows) for a ledger, as a Map. */
export function balancesOf(ledger: AnimLedger, rows: TransactionRow[]): Map<AccountId, Money> {
  const bs = computeBalances(rows, typeLookup(ledger), { lines: ledger.opening });
  return new Map(bs.lines.map((l) => [l.accountId, l.amount]));
}

export function equationOf(ledger: AnimLedger, rows: TransactionRow[]) {
  const bs = computeBalances(rows, typeLookup(ledger), { lines: ledger.opening });
  return checkEquation(bs, typeLookup(ledger));
}

export { rowTotals };

// ---------------------------------------------------------------------------
// Authoring helper: build cumulative snapshots from incremental instructions.
// The output is plain data (AnimStep[]); the builder only exists to avoid repetition.
// ---------------------------------------------------------------------------

export interface StepInput {
  caption: string;
  /** Rows to post on this step (appended to the cumulative snapshot). */
  post?: { ledger: LedgerId; row: TransactionRow }[];
  draft?: DraftRow;
  flows?: Flow[];
  highlight?: Highlight[];
}

export function buildSteps(ledgers: AnimLedger[], inputs: StepInput[]): AnimStep[] {
  const posted: Record<LedgerId, TransactionRow[]> = Object.fromEntries(ledgers.map((l) => [l.id, []]));
  return inputs.map((input) => {
    for (const p of input.post ?? []) {
      const list = posted[p.ledger];
      if (!list) throw new Error(`Unknown ledger ${p.ledger}`);
      list.push(p.row);
    }
    const step: AnimStep = {
      caption: input.caption,
      posted: Object.fromEntries(Object.entries(posted).map(([k, rows]) => [k, [...rows]])),
    };
    if (input.draft) step.draft = input.draft;
    if (input.flows) step.flows = input.flows;
    if (input.highlight) step.highlight = input.highlight;
    return step;
  });
}
