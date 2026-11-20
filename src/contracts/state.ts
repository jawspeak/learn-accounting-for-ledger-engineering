/**
 * URL-encoded state. FROZEN CONTRACT — only the manager changes this file.
 * Bump the version on any breaking change. (Sandbox v1 links were dropped on purpose with v2: no one used them.)
 */
import type {
  Account,
  BalanceSheet,
  EntityId,
  TransactionRow,
  TrialBalanceLine,
} from './accounting';

/** Attempt links (problem answers). */
export const STATE_VERSION = 1 as const;
/** Sandbox links: v2 = entities with shared charts of accounts, and many scenarios. */
export const SANDBOX_VERSION = 2 as const;

/** An entity being modelled (a bank, a payments company, you): its chart of accounts, shared by every scenario. */
export interface SandboxEntity {
  id: EntityId;
  name: string;
  accounts: Account[];
  showBalanceSheets: boolean;
  /** Manual column order (account ids); omit for canonical order. */
  columnOrder?: string[];
}

/** One entity's books in one scenario. */
export interface ScenarioBooks {
  rows: TransactionRow[];
  opening?: BalanceSheet;
}

/** A scenario: a story, and what it posts in each entity's books (each with its own opening balances). */
export interface SandboxScenario {
  id: string;
  title: string;
  /** Markdown. */
  text: string;
  /** By entity id; an entity with no books here has no entries in this scenario. */
  books: Record<EntityId, ScenarioBooks>;
}

export interface SandboxState {
  v: typeof SANDBOX_VERSION;
  title?: string;
  entities: SandboxEntity[];
  scenarios: SandboxScenario[];
}

/** One entity's chart of accounts plus its books in one scenario — what the Journal, T-accounts and Grid edit. */
export type EntityBooks = SandboxEntity & ScenarioBooks;

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
