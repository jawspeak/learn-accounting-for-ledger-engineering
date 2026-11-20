/**
 * URL-encoded state. FROZEN CONTRACT — only the manager changes this file.
 * Bump the version on any breaking change. (Old Sandbox links are dropped on purpose: no one relies on them.)
 */
import type {
  Account,
  BalanceSheet,
  EntityId,
  Posting,
  TransactionRow,
  TrialBalanceLine,
} from './accounting';

/** Attempt links (problem answers). */
export const STATE_VERSION = 1 as const;
/** Sandbox links: v3 = entities, scenarios, and events shared across entities (E1, E2… mean the same thing in
 *  every entity's books). */
export const SANDBOX_VERSION = 3 as const;

/** An entity being modelled (a bank, a payments company, you): its chart of accounts, shared by every scenario. */
export interface SandboxEntity {
  id: EntityId;
  name: string;
  /** An optional short code for the entity (e.g. "1000"), for organising — shown with the GL numbers. */
  code?: string;
  accounts: Account[];
  showBalanceSheets: boolean;
  /** Manual column order (account ids); omit for canonical order. */
  columnOrder?: string[];
  /** Order accounts by their GL number (when there's no manual order). */
  sortByNumber?: boolean;
}

/**
 * An event: something that happens (E1, E2… in its scenario). Each entity either books an entry for it (its lines
 * here), has explicitly no entry (`none`), or hasn't been filled in yet — which the scenario's check flags, so
 * the other side of an event isn't forgotten.
 */
export interface SandboxEvent {
  id: string;
  label?: string;
  /** Each entity's entry for this event: its lines (debits and credits), by entity id. */
  lines: Record<EntityId, Posting[]>;
  /** Entities this event doesn't touch (no entry in their books). */
  none?: EntityId[];
}

/** A scenario: a story, its events in order, and each entity's opening balances. */
export interface SandboxScenario {
  id: string;
  title: string;
  /** Markdown. */
  text: string;
  events: SandboxEvent[];
  /** By entity id. */
  opening: Record<EntityId, BalanceSheet>;
}

export interface SandboxState {
  v: typeof SANDBOX_VERSION;
  title?: string;
  /** Show entity codes and GL account numbers in every view. */
  showCodes?: boolean;
  entities: SandboxEntity[];
  scenarios: SandboxScenario[];
}

/** A row of one entity's journal: one event's entry (`none` when the event has no entry in these books). */
export type EventRow = TransactionRow & { none?: boolean };

/** One entity's books in one scenario, as the views edit them: one row per event, in order, and its opening. */
export interface ScenarioBooks {
  rows: EventRow[];
  opening?: BalanceSheet;
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
