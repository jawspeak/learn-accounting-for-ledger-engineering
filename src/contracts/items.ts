/**
 * Shapes of `AttemptState.items` per non-booking problem kind. FROZEN CONTRACT.
 * The question component (SHELL) writes these; engine.checkProblem (ENG) reads them.
 * Array index i always corresponds to problem item/option/candidate i. `null` = unanswered.
 */
import type { AccountType, Side } from './accounting';

/** classify: chosen bucket per item. */
export type ClassifyAnswer = (AccountType | null)[];

/** dr-cr-predict: chosen side per item. */
export type DrCrPredictAnswer = (Side | null)[];

/** equation-fill: the value typed into the single blank of each item (same units as the problem: whole dollars). */
export type EquationFillAnswer = (number | null)[];

/** multiple-choice: a single-element array holding the list of selected option indices. */
export type MultipleChoiceAnswer = [number[]];

/** coa-design: per candidate, whether it is included and (if included) the type assigned. */
export type CoaDesignAnswer = { included: boolean; type: AccountType | null }[];

/** statement-fill uses AttemptState.balanceSheet (balance-sheet, income-statement) or .trialBalance — not items. */
