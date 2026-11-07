import type {
  Account,
  BookingProblem,
  CheckResult,
  CorrectPart,
  Diagnostic,
  EngineApi,
  EntityCoA,
  TransactionRow,
} from '@contracts';
import { rowTotals } from './core';

/**
 * PHASE-0 STUB checker: per-row net-per-account comparison with basic codes.
 * ENG workstream replaces this with the full diagnostic engine (SPLIT_ENTRY, WRONG_ROW, BS_MISMATCH, ...).
 */
export const checkBooking: EngineApi['checkBooking'] = (problem, entity, answer) => {
  const diagnostics: Diagnostic[] = [];
  const correctParts: CorrectPart[] = [];
  const actual = new Map<string, Account>(entity.accounts.map((a) => [a.id, a]));
  const traps = new Map((problem.trapAccounts ?? []).map((t) => [t.id, t]));

  const net = (row: TransactionRow | undefined) => {
    const m = new Map<string, number>();
    for (const p of row?.postings ?? []) m.set(p.accountId, (m.get(p.accountId) ?? 0) + (p.side === 'dr' ? p.amount : -p.amount));
    return m;
  };

  const n = Math.max(problem.solution.length, answer.rows.length);
  for (let i = 0; i < n; i++) {
    const sol = problem.solution[i];
    const ans = answer.rows[i];
    const rowId = ans?.id ?? sol?.id ?? String(i);
    if (ans && ans.postings.length > 0 && !rowTotals(ans).balanced) {
      diagnostics.push({ code: 'UNBALANCED_ROW', severity: 'error', location: { rowId, field: 'row' }, message: 'Debits do not equal credits in this row.' });
    }
    const s = net(sol);
    const a = net(ans);
    for (const [accountId, sv] of s) {
      const av = a.get(accountId);
      const loc = { rowId, accountId };
      if (av === undefined || av === 0) {
        diagnostics.push({ code: 'MISSING_ACCOUNT', severity: 'error', location: { ...loc, field: 'account' }, message: 'An account that should change is missing.' });
        continue;
      }
      let ok = true;
      if (Math.sign(av) !== Math.sign(sv)) {
        ok = false;
        diagnostics.push({ code: 'WRONG_SIDE', severity: 'error', location: { ...loc, field: 'side' }, message: 'An account is on the wrong side (Dr vs Cr).' });
      } else if (Math.abs(av) !== Math.abs(sv)) {
        ok = false;
        diagnostics.push({ code: 'WRONG_AMOUNT', severity: 'error', location: { ...loc, field: 'amount' }, message: 'An amount is wrong.' });
      }
      const chosen = ans?.postings.find((p) => p.accountId === accountId)?.chosenType;
      const real = actual.get(accountId)?.type;
      if (chosen && real && chosen !== real) {
        ok = false;
        diagnostics.push({ code: 'WRONG_TYPE', severity: 'error', location: { ...loc, field: 'type' }, message: 'An account has the wrong type.' });
      }
      if (ok) correctParts.push(loc);
    }
    for (const [accountId, av] of a) {
      if (s.has(accountId) || av === 0) continue;
      const trap = traps.get(accountId);
      const loc = { rowId, accountId, field: 'account' as const };
      if (trap) {
        diagnostics.push({
          code: trap.trap.kind === 'counterparty' ? 'COUNTERPARTY_ACCOUNT' : 'TRAP_ACCOUNT',
          severity: 'error',
          location: loc,
          message: trap.trap.kind === 'counterparty' ? "An account belongs to the other party's books." : 'One account is a common mix-up.',
          explanation: trap.trap.explanation,
        });
      } else {
        diagnostics.push({ code: 'EXTRA_ACCOUNT', severity: 'error', location: loc, message: "An account shouldn't be in this transaction." });
      }
    }
  }
  const authored = problem.diagnosticExplanations ?? {};
  for (const d of diagnostics) d.explanation ??= authored[d.code];
  return { correct: !diagnostics.some((d) => d.severity === 'error'), diagnostics, correctParts };
};

/** PHASE-0 STUB: non-booking kinds not yet checked. */
export const checkProblem: EngineApi['checkProblem'] = (problem, attempt, entities) => {
  if (problem.kind === 'booking') {
    const entity: EntityCoA | undefined = entities[problem.entityId];
    if (!entity) throw new Error(`Unknown entity ${problem.entityId}`);
    return checkBooking(problem as BookingProblem, entity, { rows: attempt.rows ?? [], balanceSheet: attempt.balanceSheet });
  }
  const result: CheckResult = { correct: false, diagnostics: [], correctParts: [] };
  return result;
};

export const pickerAccounts: EngineApi['pickerAccounts'] = (problem, entity) => {
  const allowed = problem.accountChoiceIds ? new Set(problem.accountChoiceIds) : null;
  const base = entity.accounts.filter((a) => !allowed || allowed.has(a.id));
  const all: Account[] = [...base, ...(problem.trapAccounts ?? [])];
  return all.sort((x, y) => x.name.localeCompare(y.name, 'en'));
};
