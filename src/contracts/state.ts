/**
 * URL-encoded state. FROZEN CONTRACT — only the manager changes this file.
 * Bump STATE_VERSION on any breaking change and keep a decoder for old versions.
 */
import type { Account, BalanceSheet, EntityId, TransactionRow, TrialBalanceLine } from './accounting';

export const STATE_VERSION = 1 as const;

export interface SandboxEntity {
  id: EntityId;
  name: string;
  accounts: Account[];
  rows: TransactionRow[];
  opening?: BalanceSheet;
  showBalanceSheets: boolean;
  /** Manual column order (account ids); omit for canonical order. */
  columnOrder?: string[];
}

export interface SandboxState {
  v: typeof STATE_VERSION;
  title?: string;
  /** Markdown scenario text. */
  scenario: string;
  entities: SandboxEntity[];
}

/** A learner's in-progress answer to a problem, shareable via `#/p/<id>?a=<encoded>`. */
export interface AttemptState {
  v: typeof STATE_VERSION;
  problemId: string;
  /** booking */
  rows?: TransactionRow[];
  /** booking with askAfterBalanceSheet, statement-fill */
  balanceSheet?: BalanceSheet;
  trialBalance?: TrialBalanceLine[];
  /** Non-booking kinds: per-item answers (shape depends on kind; validated by the question component). */
  items?: unknown[];
}
