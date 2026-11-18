/**
 * Props contracts between SHELL (pages) and UI (builder/feedback components). FROZEN CONTRACT.
 */
import type { Account, AccountId, AccountType, BalanceSheet, TransactionRow } from './accounting';
import type { CheckResult, CorrectPart, DiagnosticLocation, RevealLevel } from './diagnostics';
import type { Markdown } from './problem';

export interface TAccountBuilderProps {
  /** 'problem': pick from `accounts` only. 'sandbox': learner may also create accounts (name + type). */
  mode: 'problem' | 'sandbox';
  /** Picker choices (already alphabetical/deterministic for problems — see engine.pickerAccounts). */
  accounts: Account[];
  /** Entity CoA order, for canonical column ordering within groups. */
  coaOrder: AccountId[];
  rows: TransactionRow[];
  onRowsChange(rows: TransactionRow[]): void;
  /** Sandbox only: account list edits (create/rename). */
  onAccountsChange?(accounts: Account[]): void;
  /** First N rows are read-only (faded examples). */
  lockedRowCount?: number;
  showBalanceSheets: boolean;
  opening?: BalanceSheet;
  /** When provided, the after-BS is learner-editable (askAfterBalanceSheet); otherwise it's computed. */
  afterBalanceSheet?: BalanceSheet;
  onAfterBalanceSheetChange?(bs: BalanceSheet): void;
  journalView?: boolean;
  /** Account types offered in the picker and the column type menus (default: all). Early sections hide contra types. */
  pickerTypes?: AccountType[];
  /** Feedback overlays (reveal level ≥1 marks correct parts, ≥2 highlights locations). */
  correctParts?: CorrectPart[];
  highlights?: DiagnosticLocation[];
  /** Sandbox: manual column order override. */
  columnOrder?: AccountId[];
  onColumnOrderChange?(order: AccountId[]): void;
}

export interface FeedbackPanelProps {
  result: CheckResult | null;
  level: RevealLevel;
  /** Move to the next reveal level ("Tell me more"). */
  onEscalate(): void;
  /** Authored Socratic hints, revealed one at a time independently of checking. */
  hints: Markdown[];
  /** Shown at level 5 or via "Why does this work?" when correct. */
  explanation: Markdown;
  walkthrough?: Markdown[];
  /** Optional context so locations read "Row 1 · Checking Account" (picker names, row order). */
  accounts?: Account[];
  rows?: TransactionRow[];
  /** When given, each located diagnostic gets a "Show me" button that calls this (e.g. scroll to the cell). */
  onLocate?(location: DiagnosticLocation): void;
  /** Shown as a "Next problem" link once the answer is correct. */
  next?: { href: string; title: string };
}
