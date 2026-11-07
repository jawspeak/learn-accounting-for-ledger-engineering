/**
 * Engine API signatures. FROZEN CONTRACT — `src/engine/index.ts` must export functions matching these.
 * UI/SHELL code against this; ENG implements it.
 */
import type {
  Account,
  AccountId,
  AccountType,
  BalanceSheet,
  EntityCoA,
  Money,
  Side,
  TransactionRow,
  TrialBalanceLine,
} from './accounting';
import type { CheckResult } from './diagnostics';
import type { BookingProblem, Problem } from './problem';
import type { AttemptState, SandboxState } from './state';

export interface RowTotals {
  dr: Money;
  cr: Money;
  balanced: boolean;
}

export interface EquationCheck {
  assets: Money;
  liabilities: Money;
  equity: Money;
  balanced: boolean;
}

/** A column group in canonical order: assets ‖ = ‖ liabilities │ equity sub-groups. */
export type ColumnGroup =
  | 'assets'
  | 'liabilities'
  | 'equity-paid-in'
  | 'equity-retained'
  | 'revenue'
  | 'expenses'
  | 'dividends';

export interface OrderedColumn {
  accountId: AccountId;
  group: ColumnGroup;
}

export interface EngineApi {
  /** Normal balance side for a type (contra types are opposite of their parent group). */
  normalSide(type: AccountType): Side;
  /** Σ Dr and Σ Cr for one row. */
  rowTotals(row: TransactionRow): RowTotals;
  /**
   * Balances per account after applying rows to opening balances.
   * `typeOf` resolves an account's type (learner's chosen type in the builder, actual type elsewhere).
   */
  computeBalances(
    rows: TransactionRow[],
    typeOf: (accountId: AccountId) => AccountType | undefined,
    opening?: BalanceSheet,
  ): BalanceSheet;
  /** A = L + E check. Revenue/expense/dividend roll into equity; contras net against their group. */
  checkEquation(
    bs: BalanceSheet,
    typeOf: (accountId: AccountId) => AccountType | undefined,
  ): EquationCheck;
  trialBalance(
    rows: TransactionRow[],
    typeOf: (accountId: AccountId) => AccountType | undefined,
    opening?: BalanceSheet,
  ): TrialBalanceLine[];
  /**
   * Canonical column order (VISION-2 §5): groups as above; contra accounts immediately after their parent;
   * within a group, CoA order (`coaOrder`), unknown accounts appended alphabetically.
   */
  orderColumns(
    columns: {
      accountId: AccountId;
      type: AccountType;
      contraOf?: AccountId;
      equityGroup?: Account['equityGroup'];
    }[],
    coaOrder: AccountId[],
  ): OrderedColumn[];
  /** Full diagnostic check of a booking answer (VISION-2 §6). */
  checkBooking(
    problem: BookingProblem,
    entity: EntityCoA,
    answer: { rows: TransactionRow[]; balanceSheet?: BalanceSheet },
  ): CheckResult;
  /** Check any non-booking problem kind. `items` shape per kind (documented in engine). */
  checkProblem(
    problem: Problem,
    attempt: AttemptState,
    entities: Record<string, EntityCoA>,
  ): CheckResult;
  /** Accounts offered in a booking problem's picker, alphabetical by name, deterministic. */
  pickerAccounts(problem: BookingProblem, entity: EntityCoA): Account[];
  encodeState(state: SandboxState | AttemptState): string;
  decodeSandbox(encoded: string): SandboxState | null;
  decodeAttempt(encoded: string): AttemptState | null;
}
