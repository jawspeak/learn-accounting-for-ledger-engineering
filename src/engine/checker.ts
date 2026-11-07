import type { Account, EngineApi } from '@contracts';
import { checkBooking } from './booking';
import { checkClassify, checkCoaDesign, checkDrCr, checkEquationFill, checkMultipleChoice, checkStatementFill } from './items';

export { checkBooking };

/**
 * Dispatch on problem kind. Booking reads `attempt.rows` / `attempt.balanceSheet`; statement-fill reads
 * `attempt.balanceSheet` or `attempt.trialBalance`; all other kinds read `attempt.items` (shapes in
 * `src/contracts/items.ts`).
 */
export const checkProblem: EngineApi['checkProblem'] = (problem, attempt, entities) => {
  switch (problem.kind) {
    case 'booking': {
      const entity = entities[problem.entityId];
      if (!entity) throw new Error(`Unknown entity ${problem.entityId}`);
      return checkBooking(problem, entity, { rows: attempt.rows ?? [], balanceSheet: attempt.balanceSheet });
    }
    case 'classify':
      return checkClassify(problem, attempt);
    case 'dr-cr-predict':
      return checkDrCr(problem, attempt);
    case 'equation-fill':
      return checkEquationFill(problem, attempt);
    case 'multiple-choice':
      return checkMultipleChoice(problem, attempt);
    case 'coa-design':
      return checkCoaDesign(problem, attempt);
    case 'statement-fill':
      return checkStatementFill(problem, attempt, entities[problem.entityId]);
  }
};

/** Entity CoA (optionally restricted by `accountChoiceIds`) + traps, alphabetical by name, ties by id. */
export const pickerAccounts: EngineApi['pickerAccounts'] = (problem, entity) => {
  const allowed = problem.accountChoiceIds ? new Set(problem.accountChoiceIds) : null;
  const base = entity.accounts.filter((a) => !allowed || allowed.has(a.id));
  const all: Account[] = [...base, ...(problem.trapAccounts ?? [])];
  const seen = new Set<string>();
  return all
    .filter((a) => (seen.has(a.id) ? false : (seen.add(a.id), true)))
    .sort((x, y) => {
      const a = x.name.toLowerCase();
      const b = y.name.toLowerCase();
      if (a !== b) return a < b ? -1 : 1;
      return x.id < y.id ? -1 : x.id > y.id ? 1 : 0;
    });
};
