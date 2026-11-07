/**
 * Full diagnostic checker for booking problems (VISION-2 §6).
 *
 * Algorithm
 * 1. Drop fully empty learner rows (no posting with an account and a positive amount).
 * 2. Align learner rows to solution rows **in order** (monotone alignment, see `align`). Normally row i ↔ row i;
 *    the alignment additionally recognises split entries (several consecutive learner rows netting exactly to one
 *    solution row — only when the learner used more rows than the solution), extra learner rows and unbooked
 *    solution rows, whichever explains the answer with the fewest account-level differences.
 * 3. Compare **net per account per row** for each aligned pair → WRONG_SIDE / WRONG_AMOUNT / MISSING / EXTRA.
 * 4. Extras that exactly match (account + side + amount) a missing posting of another solution row become
 *    WRONG_ROW, and that MISSING is suppressed (one root cause, one diagnostic).
 * 5. Remaining extras that are authored traps become TRAP_ACCOUNT / COUNTERPARTY_ACCOUNT.
 * 6. WRONG_TYPE is independent: any learner account (except traps) whose chosen type ≠ its real type.
 * 7. UNBALANCED_ROW per learner row; BS_MISMATCH / EQUATION_BROKEN for an asked-for after-BS.
 */
import type {
  AccountId,
  AccountType,
  BalanceSheet,
  CheckResult,
  CorrectPart,
  Diagnostic,
  DiagnosticCode,
  EngineApi,
  Posting,
  TransactionRow,
  TrapAccount,
} from '@contracts';
import { checkEquation, computeBalances, orderColumns, rowTotals } from './core';
import { MESSAGES, explanationFor, formatMoney } from './explanations';

type Net = Map<AccountId, number>;

/** Fixed code rank for deterministic ordering within the same row + column. */
export const CODE_ORDER: DiagnosticCode[] = [
  'UNBALANCED_ROW',
  'SPLIT_ENTRY',
  'WRONG_ROW',
  'COUNTERPARTY_ACCOUNT',
  'TRAP_ACCOUNT',
  'EXTRA_ACCOUNT',
  'MISSING_ACCOUNT',
  'WRONG_SIDE',
  'WRONG_AMOUNT',
  'WRONG_TYPE',
  'BS_MISMATCH',
  'EQUATION_BROKEN',
  'WRONG_ITEM',
];

const signed = (p: Posting) => (p.side === 'dr' ? p.amount : -p.amount);

const isLive = (p: Posting) => !!p.accountId && Number.isFinite(p.amount) && p.amount > 0;

export function netOf(rows: TransactionRow[]): Net {
  const m: Net = new Map();
  for (const r of rows) for (const p of r.postings) if (isLive(p)) m.set(p.accountId, (m.get(p.accountId) ?? 0) + signed(p));
  for (const [k, v] of m) if (v === 0) m.delete(k);
  return m;
}

const netEqual = (a: Net, b: Net) => a.size === b.size && [...a].every(([k, v]) => b.get(k) === v);

const netMismatch = (a: Net, b: Net) => {
  let n = 0;
  for (const k of new Set([...a.keys(), ...b.keys()])) if (a.get(k) !== b.get(k)) n++;
  return n;
};

const weight = (n: Net) => Math.max(1, n.size);

export type AlignStep =
  | { kind: 'pair'; learner: number; sol: number }
  | { kind: 'split'; learner: number[]; sol: number }
  | { kind: 'extra'; learner: number }
  | { kind: 'missing'; sol: number };

const SPLIT_COST = 0.5;

/**
 * Minimum-cost monotone alignment. Costs: pair = number of accounts whose net differs; split = 0.5 (only allowed when
 * it nets exactly and the learner has more rows than the solution); extra/missing row = number of accounts in it.
 * Ties prefer pair > split > extra > missing, so with equal row counts the plain i ↔ i pairing wins unless skipping
 * rows is strictly better (e.g. the learner left out one event and booked the next).
 */
export function align(learner: Net[], sol: Net[]): AlignStep[] {
  const m = learner.length;
  const n = sol.length;
  const allowSplit = m > n;
  const best: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  const choice: (AlignStep | null)[][] = Array.from({ length: m + 1 }, () => new Array<AlignStep | null>(n + 1).fill(null));
  for (let i = m; i >= 0; i--) {
    for (let j = n; j >= 0; j--) {
      if (i === m && j === n) continue;
      let bestCost = Infinity;
      let bestStep: AlignStep | null = null;
      const consider = (cost: number, step: AlignStep) => {
        if (cost < bestCost) {
          bestCost = cost;
          bestStep = step;
        }
      };
      if (i < m && j < n) {
        consider(netMismatch(learner[i]!, sol[j]!) + best[i + 1]![j + 1]!, { kind: 'pair', learner: i, sol: j });
        if (allowSplit) {
          const acc: Net = new Map(learner[i]!);
          for (let k = i + 1; k < m; k++) {
            for (const [a, v] of learner[k]!) {
              const nv = (acc.get(a) ?? 0) + v;
              if (nv === 0) acc.delete(a);
              else acc.set(a, nv);
            }
            if (netEqual(acc, sol[j]!)) {
              const idx = Array.from({ length: k - i + 1 }, (_, t) => i + t);
              consider(SPLIT_COST + best[k + 1]![j + 1]!, { kind: 'split', learner: idx, sol: j });
            }
          }
        }
      }
      if (i < m) consider(weight(learner[i]!) + best[i + 1]![j]!, { kind: 'extra', learner: i });
      if (j < n) consider(weight(sol[j]!) + best[i]![j + 1]!, { kind: 'missing', sol: j });
      best[i]![j] = bestCost;
      choice[i]![j] = bestStep;
    }
  }
  const steps: AlignStep[] = [];
  let i = 0;
  let j = 0;
  while (i < m || j < n) {
    const s = choice[i]![j]!;
    steps.push(s);
    if (s.kind === 'pair') (i++, j++);
    else if (s.kind === 'split') ((i = s.learner[s.learner.length - 1]! + 1), j++);
    else if (s.kind === 'extra') i++;
    else j++;
  }
  return steps;
}

interface Pending {
  d: Diagnostic;
  slot: number;
}

export const checkBooking: EngineApi['checkBooking'] = (problem, entity, answer) => {
  const traps = new Map<AccountId, TrapAccount>((problem.trapAccounts ?? []).map((t) => [t.id, t]));
  const coa = new Map(entity.accounts.map((a) => [a.id, a]));
  const realTypeOf = (id: AccountId): AccountType | undefined => coa.get(id)?.type ?? traps.get(id)?.type;

  const learnerRows = answer.rows.filter((r) => r.postings.some(isLive));
  const solRows = problem.solution;
  const lNets = learnerRows.map((r) => netOf([r]));
  const sNets = solRows.map((r) => netOf([r]));
  const steps = align(lNets, sNets);

  // Column order for deterministic sorting (mirrors the builder: learner's chosen type, else real type).
  const chosenTypeOf = new Map<AccountId, AccountType>();
  for (const r of learnerRows) for (const p of r.postings) if (isLive(p) && p.chosenType && !chosenTypeOf.has(p.accountId)) chosenTypeOf.set(p.accountId, p.chosenType);
  const allIds = new Set<AccountId>();
  for (const n of [...lNets, ...sNets]) for (const k of n.keys()) allIds.add(k);
  for (const l of answer.balanceSheet?.lines ?? []) allIds.add(l.accountId);
  const coaOrder = [...entity.accounts.map((a) => a.id), ...traps.keys()];
  const colRank = new Map(
    orderColumns(
      [...allIds].map((id) => {
        const acct = coa.get(id) ?? traps.get(id);
        return { accountId: id, type: chosenTypeOf.get(id) ?? realTypeOf(id) ?? 'asset', contraOf: acct?.contraOf, equityGroup: acct?.equityGroup };
      }),
      coaOrder,
    ).map((c, i) => [c.accountId, i]),
  );

  const pending: Pending[] = [];
  const correctParts: { part: CorrectPart; slot: number }[] = [];
  const emit = (slot: number, code: DiagnosticCode, location: Diagnostic['location'], message: string, explanation?: string, severity: Diagnostic['severity'] = 'error') =>
    pending.push({ d: { code, severity, location, message, explanation: explanation ?? explanationFor(problem, code) }, slot });

  // Per-row type check (independent of side/amount). Returns accounts whose type is wrong in that row.
  const typeErrors = (slot: number, row: TransactionRow): Set<AccountId> => {
    const bad = new Set<AccountId>();
    for (const p of row.postings) {
      if (!isLive(p) || traps.has(p.accountId) || !p.chosenType) continue;
      const real = coa.get(p.accountId)?.type;
      if (real && p.chosenType !== real) bad.add(p.accountId);
    }
    for (const a of bad) emit(slot, 'WRONG_TYPE', { rowId: row.id, accountId: a, field: 'type' }, MESSAGES.WRONG_TYPE);
    return bad;
  };

  interface Extra { slot: number; rowId: string; accountId: AccountId; value: number; wholeRow: boolean }
  interface Missing { slot: number; rowId?: string; accountId: AccountId; value: number; solIdx: number; wholeRow: boolean }
  const extras: Extra[] = [];
  const missings: Missing[] = [];

  steps.forEach((step, slot) => {
    const rowsOf = step.kind === 'pair' || step.kind === 'extra' ? [learnerRows[step.learner]!] : step.kind === 'split' ? step.learner.map((i) => learnerRows[i]!) : [];
    // Position within a slot: split rows keep their own order.
    const at = (sub: number) => slot * 1000 + sub;
    rowsOf.forEach((r, sub) => {
      const t = rowTotals(r);
      if (!t.balanced) emit(at(sub), 'UNBALANCED_ROW', { rowId: r.id, field: 'row' }, MESSAGES.UNBALANCED_ROW(formatMoney(t.dr), formatMoney(t.cr)));
    });

    if (step.kind === 'missing') {
      for (const [a, v] of sNets[step.sol]!) missings.push({ slot: at(0), accountId: a, value: v, solIdx: step.sol, wholeRow: true });
      return;
    }
    if (step.kind === 'extra') {
      const r = rowsOf[0]!;
      typeErrors(at(0), r);
      for (const [a, v] of lNets[step.learner]!) extras.push({ slot: at(0), rowId: r.id, accountId: a, value: v, wholeRow: true });
      return;
    }
    if (step.kind === 'split') {
      const first = rowsOf[0]!;
      emit(at(0), 'SPLIT_ENTRY', { rowId: first.id, field: 'row' }, MESSAGES.SPLIT_ENTRY, undefined, 'near-miss');
      const sol = sNets[step.sol]!;
      rowsOf.forEach((r, sub) => {
        const bad = typeErrors(at(sub), r);
        for (const a of netOf([r]).keys()) if (sol.has(a) && !bad.has(a)) correctParts.push({ part: { rowId: r.id, accountId: a }, slot: at(sub) });
      });
      return;
    }
    // pair
    const r = rowsOf[0]!;
    const l = lNets[step.learner]!;
    const s = sNets[step.sol]!;
    const bad = typeErrors(at(0), r);
    for (const [a, sv] of s) {
      const lv = l.get(a);
      const loc = { rowId: r.id, accountId: a };
      if (lv === undefined) {
        missings.push({ slot: at(0), rowId: r.id, accountId: a, value: sv, solIdx: step.sol, wholeRow: false });
      } else if (Math.sign(lv) !== Math.sign(sv)) {
        emit(at(0), 'WRONG_SIDE', { ...loc, field: 'side' }, MESSAGES.WRONG_SIDE);
      } else if (lv !== sv) {
        emit(at(0), 'WRONG_AMOUNT', { ...loc, field: 'amount' }, MESSAGES.WRONG_AMOUNT);
      } else if (!bad.has(a)) {
        correctParts.push({ part: loc, slot: at(0) });
      }
    }
    for (const [a, lv] of l) if (!s.has(a)) extras.push({ slot: at(0), rowId: r.id, accountId: a, value: lv, wholeRow: false });
  });

  // WRONG_ROW: an extra that exactly matches a missing posting elsewhere. Deterministic: extras in order, earliest missing.
  const claimed = new Set<Missing>();
  for (const e of extras) {
    const m = missings.find((x) => !claimed.has(x) && x.accountId === e.accountId && x.value === e.value);
    const loc = { rowId: e.rowId, accountId: e.accountId, field: 'account' as const };
    if (m) {
      claimed.add(m);
      emit(e.slot, 'WRONG_ROW', { ...loc, field: 'row' }, MESSAGES.WRONG_ROW);
      continue;
    }
    const trap = traps.get(e.accountId);
    if (trap && !coa.has(e.accountId)) {
      const counterparty = trap.trap.kind === 'counterparty';
      emit(
        e.slot,
        counterparty ? 'COUNTERPARTY_ACCOUNT' : 'TRAP_ACCOUNT',
        loc,
        counterparty ? MESSAGES.COUNTERPARTY_ACCOUNT : MESSAGES.TRAP_ACCOUNT,
        trap.trap.explanation,
      );
    } else {
      emit(e.slot, 'EXTRA_ACCOUNT', loc, e.wholeRow ? MESSAGES.EXTRA_ROW_ACCOUNT : MESSAGES.EXTRA_ACCOUNT);
    }
  }
  for (const m of missings) {
    if (claimed.has(m)) continue;
    const location: Diagnostic['location'] = m.rowId ? { rowId: m.rowId, accountId: m.accountId, field: 'account' } : { accountId: m.accountId, field: 'account' };
    emit(m.slot, 'MISSING_ACCOUNT', location, m.wholeRow ? MESSAGES.MISSING_ROW : MESSAGES.MISSING_ACCOUNT);
  }

  // After balance sheet.
  const bsSlot = steps.length * 1000;
  if (problem.askAfterBalanceSheet && answer.balanceSheet) {
    const expected = computeBalances(solRows, realTypeOf, problem.opening);
    const bsTypeOf = (id: AccountId) => realTypeOf(id) ?? chosenTypeOf.get(id);
    for (const r of compareLines(expected, answer.balanceSheet)) {
      if (r.ok) {
        if (r.expected !== 0) correctParts.push({ part: { accountId: r.accountId }, slot: bsSlot });
      } else emit(bsSlot, 'BS_MISMATCH', { accountId: r.accountId, field: 'bs-line' }, MESSAGES.BS_MISMATCH);
    }
    const eq = checkEquation(answer.balanceSheet, bsTypeOf);
    if (!eq.balanced) {
      emit(bsSlot + 1, 'EQUATION_BROKEN', { field: 'bs-line' }, MESSAGES.EQUATION_BROKEN(formatMoney(eq.assets), formatMoney(eq.liabilities), formatMoney(eq.equity)));
    }
  }

  const diagnostics = sortDiagnostics(pending, colRank);
  const parts = correctParts
    .sort((a, b) => a.slot - b.slot || (colRank.get(a.part.accountId!) ?? 0) - (colRank.get(b.part.accountId!) ?? 0))
    .map((c) => c.part);
  return { correct: !diagnostics.some((d) => d.severity === 'error'), diagnostics, correctParts: dedupeParts(parts) } satisfies CheckResult;
};

/** Compare balance lines per account (zero lines may be omitted; duplicate lines are summed). Sorted by account id order of first appearance (expected first). */
export function compareLines(expected: BalanceSheet, actual: BalanceSheet) {
  const sum = (bs: BalanceSheet) => {
    const m = new Map<AccountId, number>();
    for (const l of bs.lines) m.set(l.accountId, (m.get(l.accountId) ?? 0) + (Number.isFinite(l.amount) ? l.amount : NaN));
    return m;
  };
  const e = sum(expected);
  const a = sum(actual);
  const ids = [...new Set([...e.keys(), ...a.keys()])];
  return ids.map((accountId) => {
    const ev = e.get(accountId) ?? 0;
    const av = a.get(accountId) ?? 0;
    return { accountId, expected: ev, actual: av, ok: ev === av };
  });
}

function sortDiagnostics(pending: Pending[], colRank: Map<AccountId, number>): Diagnostic[] {
  const col = (d: Diagnostic) => (d.location.accountId === undefined ? -1 : (colRank.get(d.location.accountId) ?? Number.MAX_SAFE_INTEGER));
  const seen = new Set<string>();
  return pending
    .map((p, i) => ({ ...p, i }))
    .sort(
      (a, b) =>
        a.slot - b.slot ||
        col(a.d) - col(b.d) ||
        CODE_ORDER.indexOf(a.d.code) - CODE_ORDER.indexOf(b.d.code) ||
        (a.d.location.rowId ?? '').localeCompare(b.d.location.rowId ?? '') ||
        a.i - b.i,
    )
    .map((p) => p.d)
    .filter((d) => {
      const key = `${d.code}|${d.location.rowId ?? ''}|${d.location.accountId ?? ''}|${d.location.field ?? ''}|${d.location.itemIndex ?? ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function dedupeParts(parts: CorrectPart[]): CorrectPart[] {
  const seen = new Set<string>();
  return parts.filter((p) => {
    const k = `${p.rowId ?? ''}|${p.accountId ?? ''}|${p.itemIndex ?? ''}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

