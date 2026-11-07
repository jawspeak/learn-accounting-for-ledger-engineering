/**
 * Core accounting types. FROZEN CONTRACT — only the manager changes this file.
 * See VISION-2.md §5–§6.
 */

/** Integer minor units (cents). Never use floats for money. v1 content uses whole dollars (multiples of 100). */
export type Money = number;

export type Side = 'dr' | 'cr';

export type AccountType =
  | 'asset'
  | 'contra-asset'
  | 'liability'
  | 'contra-liability'
  | 'equity'
  | 'contra-equity'
  | 'revenue'
  | 'contra-revenue'
  | 'expense'
  | 'dividend';

/** Equity accounts are split into these sub-groups for column ordering and the cheat sheet. */
export type EquityGroup = 'paid-in' | 'retained';

export type EntityId = string;
export type AccountId = string;

export interface Account {
  /** Unique within an entity's CoA (and within a problem's choice list). kebab-case. */
  id: AccountId;
  name: string;
  type: AccountType;
  /** Required for contra-* types: the id of the account this one reduces. */
  contraOf?: AccountId;
  /** Only for type 'equity'. Defaults to 'paid-in'. */
  equityGroup?: EquityGroup;
  /** Short description shown on hover in the sandbox / CoA views. Never shown in the picker during problems. */
  description?: string;
}

export interface EntityCoA {
  id: EntityId;
  name: string;
  kind: 'person' | 'bank' | 'company' | 'fintech';
  basis: 'cash' | 'accrual';
  /** In CoA order (assets in liquidity order — cash first). This order is used within each column group. */
  accounts: Account[];
}

export interface Posting {
  accountId: AccountId;
  side: Side;
  amount: Money;
  /** The type the learner chose for this account. Required on learner answers; omitted on authored solutions. */
  chosenType?: AccountType;
}

/** One transaction = one row in the builder. Must balance: ΣDr = ΣCr. */
export interface TransactionRow {
  id: string;
  label?: string;
  postings: Posting[];
}

/** Balance per account, as a positive amount on the account's normal side (negative = abnormal balance). */
export interface BalanceLine {
  accountId: AccountId;
  amount: Money;
}

export interface BalanceSheet {
  lines: BalanceLine[];
}

/** Trial balance line: total balance shown on the Dr or Cr side. */
export interface TrialBalanceLine {
  accountId: AccountId;
  side: Side;
  amount: Money;
}
