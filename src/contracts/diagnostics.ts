/**
 * Checker output. FROZEN CONTRACT — only the manager changes this file.
 * See VISION-2.md §6.
 */
import type { AccountId } from './accounting';

export type DiagnosticCode =
  | 'UNBALANCED_ROW'
  | 'WRONG_TYPE'
  | 'WRONG_SIDE'
  | 'WRONG_AMOUNT'
  | 'MISSING_ACCOUNT'
  | 'EXTRA_ACCOUNT'
  | 'COUNTERPARTY_ACCOUNT'
  | 'TRAP_ACCOUNT'
  | 'SPLIT_ENTRY'
  | 'WRONG_ROW'
  | 'BS_MISMATCH'
  | 'EQUATION_BROKEN'
  /** Non-booking question kinds: a specific item is wrong. */
  | 'WRONG_ITEM';

export type DiagnosticSeverity = 'error' | 'near-miss';

/** Which part of the answer a diagnostic points at — drives highlighting at reveal level 2. */
export interface DiagnosticLocation {
  rowId?: string;
  accountId?: AccountId;
  field?: 'type' | 'side' | 'amount' | 'account' | 'row' | 'bs-line' | 'item';
  /** For non-booking kinds: the index of the item. */
  itemIndex?: number;
}

export interface Diagnostic {
  code: DiagnosticCode;
  severity: DiagnosticSeverity;
  location: DiagnosticLocation;
  /** Short category message, shown at reveal level 3. Plain text. */
  message: string;
  /** Longer explanation (markdown), shown at reveal level 4. Authored override if the problem provides one. */
  explanation?: string;
}

/** A part of the answer that is correct — gets a ✓ at reveal level 1. */
export interface CorrectPart {
  rowId?: string;
  accountId?: AccountId;
  itemIndex?: number;
}

export interface CheckResult {
  /** True when there are no 'error' diagnostics (near-misses allowed). */
  correct: boolean;
  diagnostics: Diagnostic[];
  correctParts: CorrectPart[];
}

/**
 * Progressive reveal (VISION-2 §6):
 * 0 = not checked, 1 = count + correct parts, 2 = location, 3 = category, 4 = explanation, 5 = full solution.
 */
export type RevealLevel = 0 | 1 | 2 | 3 | 4 | 5;
