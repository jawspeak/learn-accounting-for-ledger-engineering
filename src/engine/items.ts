/**
 * Checkers for non-booking problem kinds. Answer shapes: `src/contracts/items.ts`.
 * Every item gets either a WRONG_ITEM diagnostic (location.itemIndex, the item's authored explanation) or a
 * CorrectPart { itemIndex }. Unanswered items count as wrong.
 */
import type {
  AccountId,
  AccountType,
  AttemptState,
  BalanceSheet,
  CheckResult,
  ClassifyProblem,
  CoaDesignProblem,
  CorrectPart,
  Diagnostic,
  DrCrPredictProblem,
  EntityCoA,
  EquationFillProblem,
  MultipleChoiceProblem,
  ProblemBase,
  StatementFillProblem,
  TrialBalanceLine,
} from '@contracts';
import { compareLines } from './booking';
import { checkEquation, computeBalances, trialBalance } from './core';
import { GENERIC_EXPLANATIONS, MESSAGES, explanationFor, formatMoney } from './explanations';

const result = (diagnostics: Diagnostic[], correctParts: CorrectPart[]): CheckResult => ({
  correct: !diagnostics.some((d) => d.severity === 'error'),
  diagnostics,
  correctParts,
});

const itemDiag = (problem: ProblemBase, itemIndex: number, message: string, explanation: string | undefined, field: Diagnostic['location']['field'] = 'item'): Diagnostic => ({
  code: 'WRONG_ITEM',
  severity: 'error',
  location: { itemIndex, field },
  message,
  explanation: explanation || explanationFor(problem, 'WRONG_ITEM'),
});

const at = (items: unknown[] | undefined, i: number): unknown => (Array.isArray(items) ? items[i] : undefined);
const isNil = (x: unknown) => x === null || x === undefined;

/** Generic "one answer per item, compare to expected" checker. */
function checkSimple<T>(
  problem: ProblemBase,
  items: { explanation: string }[],
  answers: unknown[] | undefined,
  expected: (i: number) => T | undefined,
  wrongMessage: string,
  normalise: (x: unknown) => T | undefined = (x) => x as T,
): CheckResult {
  const diagnostics: Diagnostic[] = [];
  const parts: CorrectPart[] = [];
  items.forEach((item, i) => {
    const want = expected(i);
    if (want === undefined) return; // malformed item — nothing to check
    const raw = at(answers, i);
    const got = isNil(raw) ? undefined : normalise(raw);
    if (got === undefined) diagnostics.push(itemDiag(problem, i, MESSAGES.ITEM_UNANSWERED, item.explanation));
    else if (got !== want) diagnostics.push(itemDiag(problem, i, wrongMessage, item.explanation));
    else parts.push({ itemIndex: i });
  });
  return result(diagnostics, parts);
}

export function checkClassify(problem: ClassifyProblem, attempt: AttemptState): CheckResult {
  return checkSimple<AccountType>(problem, problem.items, attempt.items, (i) => problem.items[i]!.answer, MESSAGES.CLASSIFY_WRONG, (x) =>
    typeof x === 'string' ? (x as AccountType) : undefined,
  );
}

export function checkDrCr(problem: DrCrPredictProblem, attempt: AttemptState): CheckResult {
  return checkSimple(problem, problem.items, attempt.items, (i) => problem.items[i]!.answer, MESSAGES.DRCR_WRONG, (x) =>
    x === 'dr' || x === 'cr' ? x : undefined,
  );
}

/** The blank's value: exactly one of assets/liabilities/equity is null. Returns undefined if malformed. */
export function equationBlank(item: EquationFillProblem['items'][number]): number | undefined {
  const { assets: a, liabilities: l, equity: e } = item;
  const nulls = [a, l, e].filter((x) => x === null).length;
  if (nulls !== 1) return undefined;
  if (a === null) return l! + e!;
  if (l === null) return a - e!;
  return a - l!;
}

export function checkEquationFill(problem: EquationFillProblem, attempt: AttemptState): CheckResult {
  return checkSimple(problem, problem.items, attempt.items, (i) => equationBlank(problem.items[i]!), MESSAGES.EQUATION_WRONG, (x) => {
    const n = typeof x === 'string' && x.trim() !== '' ? Number(x.replace(/[$,\s]/g, '')) : x;
    return typeof n === 'number' && Number.isFinite(n) ? n : undefined;
  });
}

export function checkMultipleChoice(problem: MultipleChoiceProblem, attempt: AttemptState): CheckResult {
  const raw = at(attempt.items, 0);
  const selected = new Set<number>(
    Array.isArray(raw) ? raw.filter((x): x is number => Number.isInteger(x) && x >= 0 && x < problem.options.length) : [],
  );
  const diagnostics: Diagnostic[] = [];
  const parts: CorrectPart[] = [];
  // itemIndex = option index. Wrongly selected and wrongly unselected options are both marked (manager convention).
  problem.options.forEach((opt, i) => {
    const picked = selected.has(i);
    if (picked && opt.correct) parts.push({ itemIndex: i });
    else if (picked && !opt.correct) diagnostics.push(itemDiag(problem, i, MESSAGES.MC_WRONG_PICK, opt.explanation));
    else if (!picked && opt.correct)
      diagnostics.push(itemDiag(problem, i, selected.size === 0 ? MESSAGES.MC_NO_ANSWER : MESSAGES.MC_MISSED, opt.explanation));
  });
  return result(diagnostics, parts);
}

export function checkCoaDesign(problem: CoaDesignProblem, attempt: AttemptState): CheckResult {
  const diagnostics: Diagnostic[] = [];
  const parts: CorrectPart[] = [];
  problem.candidates.forEach((c, i) => {
    const raw = at(attempt.items, i);
    // An untouched row means "not included" — a real answer (leaving out irrelevant accounts is correct).
    const given = raw && typeof raw === 'object' ? (raw as { included?: unknown; type?: unknown }) : undefined;
    const ans = {
      included: typeof given?.included === 'boolean' ? given.included : false,
      type: given?.type ?? null,
    };
    if (c.required && !ans.included) {
      diagnostics.push(itemDiag(problem, i, MESSAGES.COA_MISSING, c.explanation));
    } else if (!c.required && ans.included) {
      diagnostics.push(itemDiag(problem, i, MESSAGES.COA_NOT_NEEDED, c.explanation));
    } else if (c.required && ans.type !== c.answerType) {
      diagnostics.push(itemDiag(problem, i, isNil(ans.type) ? MESSAGES.ITEM_UNANSWERED : MESSAGES.COA_WRONG_TYPE, c.explanation, 'type'));
    } else {
      parts.push({ itemIndex: i });
    }
  });
  return result(diagnostics, parts);
}

const INCOME_TYPES: AccountType[] = ['revenue', 'contra-revenue', 'expense'];

/**
 * statement-fill. balance-sheet / income-statement compare `attempt.balanceSheet` line by line (cents on the
 * account's normal side; a blank input is omitted, which counts as wrong unless the expected amount is 0);
 * trial-balance compares `attempt.trialBalance` by signed (Dr+) amount. Mismatches are BS_MISMATCH with accountId and
 * itemIndex = position of the line in the expected answer (`problem.answer.balanceSheet.lines` /
 * `problem.answer.trialBalance`); correct parts likewise. A learner line for an account not in the answer gets
 * BS_MISMATCH with accountId only. A balance-sheet answer additionally gets EQUATION_BROKEN when A ≠ L + E.
 * If the problem omits its expected answer it is derived from `rows` + `opening` (itemIndex = derived order).
 */
export function checkStatementFill(problem: StatementFillProblem, attempt: AttemptState, entity: EntityCoA | undefined): CheckResult {
  const typeOf = (id: AccountId) => entity?.accounts.find((a) => a.id === id)?.type;
  const diagnostics: Diagnostic[] = [];
  const parts: CorrectPart[] = [];
  const bsExpl = explanationFor(problem, 'BS_MISMATCH');
  /** itemIndex = first position of the account in the expected lines; learner-only accounts get no itemIndex. */
  const compareStatement = (expected: BalanceSheet, actual: BalanceSheet, message: string) => {
    const indexOf = new Map<AccountId, number>();
    expected.lines.forEach((l, i) => {
      if (!indexOf.has(l.accountId)) indexOf.set(l.accountId, i);
    });
    for (const r of compareLines(expected, actual)) {
      const itemIndex = indexOf.get(r.accountId);
      const loc = itemIndex === undefined ? { accountId: r.accountId } : { accountId: r.accountId, itemIndex };
      if (r.ok) {
        if (itemIndex !== undefined) parts.push(loc);
      } else diagnostics.push({ code: 'BS_MISMATCH', severity: 'error', location: { ...loc, field: 'bs-line' }, message, explanation: bsExpl });
    }
  };

  if (problem.statement === 'trial-balance') {
    const expected = problem.answer.trialBalance ?? trialBalance(problem.rows, typeOf, problem.opening);
    const toBs = (tb: TrialBalanceLine[]) => ({
      lines: tb.map((l) => ({ accountId: l.accountId, amount: l.side === 'dr' ? l.amount : -l.amount })),
    });
    compareStatement(toBs(expected), toBs(attempt.trialBalance ?? []), MESSAGES.TB_MISMATCH);
    return result(diagnostics, parts);
  }

  let expected = problem.answer.balanceSheet;
  if (!expected) {
    const all = computeBalances(problem.rows, typeOf, problem.opening);
    expected =
      problem.statement === 'income-statement'
        ? { lines: all.lines.filter((l) => INCOME_TYPES.includes(typeOf(l.accountId) as AccountType)) }
        : all;
  }
  const actual = attempt.balanceSheet ?? { lines: [] };
  compareStatement(expected, actual, MESSAGES.BS_MISMATCH);
  if (problem.statement === 'balance-sheet' && entity && actual.lines.length > 0) {
    const eq = checkEquation(actual, typeOf);
    if (!eq.balanced) {
      diagnostics.push({
        code: 'EQUATION_BROKEN',
        severity: 'error',
        location: { field: 'bs-line' },
        message: MESSAGES.EQUATION_BROKEN(formatMoney(eq.assets), formatMoney(eq.liabilities), formatMoney(eq.equity)),
        explanation: problem.diagnosticExplanations?.EQUATION_BROKEN ?? GENERIC_EXPLANATIONS.EQUATION_BROKEN,
      });
    }
  }
  return result(diagnostics, parts);
}
