/**
 * Content contracts: sections and problems. FROZEN CONTRACT — only the manager changes this file.
 * See VISION-2.md §2, §4, §6. All prose fields are markdown.
 */
import type {
  Account,
  AccountType,
  BalanceSheet,
  EntityId,
  Side,
  TransactionRow,
  TrialBalanceLine,
} from './accounting';
import type { DiagnosticCode } from './diagnostics';

export type Markdown = string;

export type SectionId =
  | '00-start'
  | '01-equation'
  | '02-debits-credits'
  | '03-t-accounts'
  | '04-perspectives'
  | '05-journal-entries'
  | '06-loans'
  | '07-revenue-expenses'
  | '08-accruals'
  | '09-contra'
  | '10-processes'
  | '11-fintech'
  | '12-capstone'
  | 'review';

/** worked = full solution shown with walkthrough; faded = partially prefilled; practice; review = interleaved. */
export type ProblemRole = 'worked' | 'faded' | 'practice' | 'review';

export interface ProblemBase {
  /** Globally unique, stable (used in URLs). Format: `<section-number>-<slug>`, e.g. `03-cash-to-checking`. */
  id: string;
  sectionId: SectionId;
  title: string;
  role: ProblemRole;
  difficulty: 1 | 2 | 3;
  /** The scenario / question text. */
  prompt: Markdown;
  /** Socratic hints, in order. 2–4 for practice problems. */
  hints: Markdown[];
  /** Full explanation shown at reveal level 5 and in "Why does this work?". */
  explanation: Markdown;
  /** Step-by-step walkthrough for worked examples (and optional elsewhere). */
  walkthrough?: Markdown[];
  /** Overrides for generic diagnostic explanations (reveal level 4). */
  diagnosticExplanations?: Partial<Record<DiagnosticCode, Markdown>>;
  /** Id of the same event from the other party's perspective (contrasting cases). */
  perspectivePairId?: string;
  tags?: string[];
}

/** A plausible wrong account offered in the picker. Its id must not collide with the entity CoA. */
export interface TrapAccount extends Account {
  trap: {
    kind: 'counterparty' | 'near-synonym' | 'wrong-scope' | 'other';
    /** Shown when the learner uses this account (TRAP_ACCOUNT / COUNTERPARTY_ACCOUNT diagnostic). */
    explanation: Markdown;
  };
}

/** Book one or more transactions in the T-account builder. Also covers faded, find-the-error and rewrite. */
export interface BookingProblem extends ProblemBase {
  kind: 'booking';
  /** Whose books are we in. */
  entityId: EntityId;
  /** Opening balances (before BS). Omit for problems that don't show a BS. */
  opening?: BalanceSheet;
  /** Show before/after balance sheet panels. */
  showBalanceSheets: boolean;
  /** Learner must fill in the after-BS themselves (requires showBalanceSheets). */
  askAfterBalanceSheet?: boolean;
  /** Show the journal-entry view toggle (sections ≥ 05). */
  journalView?: boolean;
  /** Extra accounts offered in the picker beyond the entity CoA. */
  trapAccounts?: TrapAccount[];
  /**
   * Restrict the picker to these entity account ids (plus traps). Omit to offer the full entity CoA.
   * Used in early sections to keep the list manageable.
   */
  accountChoiceIds?: string[];
  /** Pre-filled rows. For faded examples (`locked`) and find-the-error (editable, deliberately wrong). */
  prefill?: { rows: TransactionRow[]; locked: boolean };
  /** Read-only entry shown alongside — e.g. the other party's books for rewrite problems. */
  reference?: { entityId: EntityId; rows: TransactionRow[]; caption: Markdown };
  /** Authored solution. Row ids are matched to learner rows by order. Each solution row = one business event. */
  solution: TransactionRow[];
}

export interface ClassifyProblem extends ProblemBase {
  kind: 'classify';
  /** Buckets to drag into. */
  buckets: AccountType[];
  items: { label: string; /** whose books, if perspective matters */ entityId?: EntityId; answer: AccountType; explanation: Markdown }[];
}

export interface DrCrPredictProblem extends ProblemBase {
  kind: 'dr-cr-predict';
  items: {
    accountName: string;
    accountType: AccountType;
    change: 'increase' | 'decrease';
    answer: Side;
    explanation: Markdown;
  }[];
}

/** Fill the blank in A = L + E (or expanded form). Exactly one field per item is null (the blank). */
export interface EquationFillProblem extends ProblemBase {
  kind: 'equation-fill';
  /**
   * Word problems: don't print the two known totals — the learner works them out from each item's `story`
   * (sorting and adding several accounts). The blank is still the one `null` field.
   */
  hideGiven?: boolean;
  items: {
    assets: number | null;
    liabilities: number | null;
    equity: number | null;
    /** Shown above the item's row (used with `hideGiven`). */
    story?: Markdown;
    explanation: Markdown;
  }[];
}

/** Fill in a statement (after-BS, trial balance, or income statement) from given transactions. */
export interface StatementFillProblem extends ProblemBase {
  kind: 'statement-fill';
  entityId: EntityId;
  statement: 'balance-sheet' | 'trial-balance' | 'income-statement';
  opening?: BalanceSheet;
  rows: TransactionRow[];
  /** Expected answer. For balance-sheet / income-statement: BalanceSheet lines; trial-balance: TB lines. */
  answer: { balanceSheet?: BalanceSheet; trialBalance?: TrialBalanceLine[] };
}

export interface MultipleChoiceProblem extends ProblemBase {
  kind: 'multiple-choice';
  /** Allow selecting multiple options. */
  multi: boolean;
  options: { text: Markdown; correct: boolean; explanation: Markdown }[];
}

/** Capstone: pick the accounts a business needs and assign each a type. */
export interface CoaDesignProblem extends ProblemBase {
  kind: 'coa-design';
  /** Business description is in `prompt`. */
  candidates: {
    name: string;
    answerType: AccountType;
    /** true = must be included, false = must NOT be included (irrelevant to this business). */
    required: boolean;
    explanation: Markdown;
  }[];
}

export type Problem =
  | BookingProblem
  | ClassifyProblem
  | DrCrPredictProblem
  | EquationFillProblem
  | StatementFillProblem
  | MultipleChoiceProblem
  | CoaDesignProblem;

export type ProblemKind = Problem['kind'];

export interface Section {
  id: SectionId;
  number: number;
  title: string;
  /** One-line summary for nav. */
  summary: string;
  /** Fits on one screen. */
  primer: Markdown;
  /** "Ledger-engineer's lens" sidebar. */
  lens?: Markdown;
  /** Callouts (e.g. "Where is the bank's money?", "What is an FBO account?"). */
  callouts?: { title: string; body: Markdown }[];
  /** Problem ids in display order: worked, faded, practice..., review. */
  problemIds: string[];
}

/** What each content module (`content/sections/<id>/index.ts`) default-exports. */
export interface SectionModule {
  section: Section;
  problems: Problem[];
}
