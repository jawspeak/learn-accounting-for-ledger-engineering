import { describe, expect, it } from 'vitest';
import type { BookingProblem, CheckResult } from '@contracts';
import { checkBooking, align, netOf } from './booking';
import { GENERIC_EXPLANATIONS } from './explanations';
import { co, deposit, p, row, twoEvents, twoEventsCorrect } from './fixtures.test-helpers';

const codes = (r: CheckResult) => r.diagnostics.map((d) => `${d.code}@${d.location.rowId ?? '-'}/${d.location.accountId ?? '-'}`);

describe('checkBooking — correct answers', () => {
  it('exact answer: no diagnostics, every posting acknowledged', () => {
    const r = checkBooking(twoEvents, co, { rows: twoEventsCorrect() });
    expect(r).toEqual({
      correct: true,
      diagnostics: [],
      correctParts: [
        { rowId: 'r1', accountId: 'cash' },
        { rowId: 'r1', accountId: 'capital' },
        { rowId: 'r2', accountId: 'equipment' },
        { rowId: 'r2', accountId: 'ap' },
      ],
    });
  });

  it('compares net per account: two postings that sum to the solution are fine', () => {
    const r = checkBooking(deposit, co, { rows: [row('r1', p('bank', 'dr', 60), p('bank', 'dr', 40), p('cash', 'cr', 100))] });
    expect(r.diagnostics).toEqual([]);
  });

  it('ignores fully empty rows and zero/blank postings', () => {
    const r = checkBooking(deposit, co, {
      rows: [
        row('r0'),
        row('r1', p('bank', 'dr', 100), p('cash', 'cr', 100), { accountId: 'loan', side: 'cr', amount: 0, chosenType: 'liability' }),
        row('r2', { accountId: '', side: 'dr', amount: 500 }),
      ],
    });
    expect(r.diagnostics).toEqual([]);
    expect(r.correct).toBe(true);
  });

  it('posting order within a row does not change the result', () => {
    const a = checkBooking(deposit, co, { rows: [row('r1', p('cash', 'dr', 100), p('loan', 'cr', 100), p('bank', 'dr', 5))] });
    const b = checkBooking(deposit, co, { rows: [row('r1', p('bank', 'dr', 5), p('loan', 'cr', 100), p('cash', 'dr', 100))] });
    expect(b).toEqual(a);
  });
});

describe('checkBooking — single diagnostic codes', () => {
  it('WRONG_TYPE only, when account/side/amount are right', () => {
    const r = checkBooking(deposit, co, { rows: [row('r1', p('bank', 'dr', 100, 'liability'), p('cash', 'cr', 100))] });
    expect(r.diagnostics).toHaveLength(1);
    expect(r.diagnostics[0]).toMatchObject({
      code: 'WRONG_TYPE',
      severity: 'error',
      location: { rowId: 'r1', accountId: 'bank', field: 'type' },
      message: 'One account has the wrong type.',
      explanation: GENERIC_EXPLANATIONS.WRONG_TYPE,
    });
    expect(r.correct).toBe(false);
    expect(r.correctParts).toEqual([{ rowId: 'r1', accountId: 'cash' }]);
  });

  it('WRONG_SIDE when Dr/Cr are reversed (row still balanced)', () => {
    const r = checkBooking(deposit, co, { rows: [row('r1', p('bank', 'cr', 100), p('cash', 'dr', 100))] });
    expect(codes(r)).toEqual(['WRONG_SIDE@r1/cash', 'WRONG_SIDE@r1/bank']);
    expect(r.diagnostics.every((d) => d.location.field === 'side')).toBe(true);
  });

  it('WRONG_TYPE and WRONG_SIDE are reported independently', () => {
    const r = checkBooking(deposit, co, { rows: [row('r1', p('bank', 'cr', 100, 'expense'), p('cash', 'dr', 100))] });
    expect(codes(r)).toEqual(['WRONG_SIDE@r1/cash', 'WRONG_SIDE@r1/bank', 'WRONG_TYPE@r1/bank']);
  });

  it('WRONG_AMOUNT + UNBALANCED_ROW', () => {
    const r = checkBooking(deposit, co, { rows: [row('r1', p('bank', 'dr', 90), p('cash', 'cr', 100))] });
    expect(codes(r)).toEqual(['UNBALANCED_ROW@r1/-', 'WRONG_AMOUNT@r1/bank']);
    expect(r.diagnostics[0]!.message).toBe("This row doesn't balance: debits total $90 but credits total $100.");
    expect(r.correctParts).toEqual([{ rowId: 'r1', accountId: 'cash' }]);
  });

  it('MISSING_ACCOUNT + UNBALANCED_ROW for a one-sided entry', () => {
    const r = checkBooking(deposit, co, { rows: [row('r1', p('bank', 'dr', 100))] });
    expect(codes(r)).toEqual(['UNBALANCED_ROW@r1/-', 'MISSING_ACCOUNT@r1/cash']);
    expect(r.diagnostics[1]!.location.field).toBe('account');
  });

  it('EXTRA_ACCOUNT in a balanced compound row', () => {
    const r = checkBooking(deposit, co, { rows: [row('r1', p('bank', 'dr', 100), p('cash', 'cr', 60), p('loan', 'cr', 40))] });
    expect(codes(r)).toEqual(['WRONG_AMOUNT@r1/cash', 'EXTRA_ACCOUNT@r1/loan']);
  });

  it('unknown account id is EXTRA_ACCOUNT', () => {
    const r = checkBooking(deposit, co, { rows: [row('r1', p('bank', 'dr', 100), p('cash', 'cr', 100), p('mystery', 'dr', 5), p('mystery2', 'cr', 5))] });
    expect(r.diagnostics.map((d) => d.code)).toEqual(['EXTRA_ACCOUNT', 'EXTRA_ACCOUNT']);
  });

  it('COUNTERPARTY_ACCOUNT carries the trap explanation, no WRONG_TYPE on the trap', () => {
    const r = checkBooking(deposit, co, { rows: [row('r1', p('customer-deposits', 'dr', 100, 'asset'), p('cash', 'cr', 100))] });
    expect(codes(r)).toEqual(['MISSING_ACCOUNT@r1/bank', 'COUNTERPARTY_ACCOUNT@r1/customer-deposits']);
    const cp = r.diagnostics[1]!;
    expect(cp.explanation).toBe('COUNTERPARTY EXPL');
    expect(cp.message).toBe("This account belongs to the other party's books.");
  });

  it('TRAP_ACCOUNT for non-counterparty traps', () => {
    const r = checkBooking(deposit, co, { rows: [row('r1', p('bank', 'dr', 100), p('owner-cash', 'cr', 100, 'asset'))] });
    // Trap accounts sort after the entity's CoA accounts within their group.
    expect(codes(r)).toEqual(['MISSING_ACCOUNT@r1/cash', 'TRAP_ACCOUNT@r1/owner-cash']);
    expect(r.diagnostics[1]!.explanation).toBe('NEAR SYNONYM EXPL');
  });

  it('problem.diagnosticExplanations override generic explanations', () => {
    const prob: BookingProblem = { ...deposit, diagnosticExplanations: { WRONG_SIDE: 'CUSTOM' } };
    const r = checkBooking(prob, co, { rows: [row('r1', p('bank', 'cr', 100), p('cash', 'dr', 100))] });
    expect(r.diagnostics.map((d) => d.explanation)).toEqual(['CUSTOM', 'CUSTOM']);
  });

  it('every diagnostic has a message and explanation', () => {
    const r = checkBooking(twoEvents, co, {
      rows: [row('r1', p('cash', 'cr', 10, 'expense'), p('loan', 'dr', 3)), row('r2', p('customer-deposits', 'dr', 1))],
      balanceSheet: { lines: [{ accountId: 'cash', amount: 1 }] },
    });
    expect(r.diagnostics.length).toBeGreaterThan(3);
    for (const d of r.diagnostics) {
      expect(d.message.length).toBeGreaterThan(5);
      expect(d.explanation?.length).toBeGreaterThan(5);
    }
  });
});

describe('checkBooking — SPLIT_ENTRY', () => {
  it('one event split over two balanced rows via an intermediate account is a near-miss', () => {
    const r = checkBooking(deposit, co, {
      rows: [row('r1', p('clearing', 'dr', 100), p('cash', 'cr', 100)), row('r2', p('bank', 'dr', 100), p('clearing', 'cr', 100))],
    });
    expect(r.diagnostics).toHaveLength(1);
    expect(r.diagnostics[0]).toMatchObject({ code: 'SPLIT_ENTRY', severity: 'near-miss', location: { rowId: 'r1', field: 'row' } });
    expect(r.correct).toBe(true);
    expect(r.correctParts).toEqual([
      { rowId: 'r1', accountId: 'cash' },
      { rowId: 'r2', accountId: 'bank' },
    ]);
  });

  it('split into individually unbalanced rows also reports UNBALANCED_ROW (not correct)', () => {
    const r = checkBooking(deposit, co, { rows: [row('r1', p('bank', 'dr', 100)), row('r2', p('cash', 'cr', 100))] });
    expect(codes(r)).toEqual(['UNBALANCED_ROW@r1/-', 'SPLIT_ENTRY@r1/-', 'UNBALANCED_ROW@r2/-']);
    expect(r.correct).toBe(false);
  });

  it('compound event split into three rows', () => {
    const prob: BookingProblem = {
      ...deposit,
      solution: [
        {
          id: 's1',
          postings: [
            { accountId: 'bank', side: 'dr', amount: 10000 },
            { accountId: 'cash', side: 'cr', amount: 6000 },
            { accountId: 'loan', side: 'cr', amount: 4000 },
          ],
        },
      ],
    };
    const r = checkBooking(prob, co, {
      rows: [
        row('a', p('bank', 'dr', 60), p('cash', 'cr', 60)),
        row('b', p('bank', 'dr', 30), p('loan', 'cr', 30)),
        row('c', p('bank', 'dr', 10), p('loan', 'cr', 10)),
      ],
    });
    expect(codes(r)).toEqual(['SPLIT_ENTRY@a/-']);
    expect(r.correct).toBe(true);
  });

  it('split of the first event, second event still compared normally', () => {
    const r = checkBooking(twoEvents, co, {
      rows: [
        row('r1', p('cash', 'dr', 1000), p('clearing', 'cr', 1000)),
        row('r2', p('clearing', 'dr', 1000), p('capital', 'cr', 1000)),
        row('r3', p('equipment', 'dr', 400), p('ap', 'cr', 300), p('loan', 'cr', 100)),
      ],
    });
    expect(codes(r)).toEqual(['SPLIT_ENTRY@r1/-', 'WRONG_AMOUNT@r3/ap', 'EXTRA_ACCOUNT@r3/loan']);
  });

  it('split with a wrong chosen type also reports WRONG_TYPE', () => {
    const r = checkBooking(deposit, co, {
      rows: [row('r1', p('clearing', 'dr', 100), p('cash', 'cr', 100)), row('r2', p('bank', 'dr', 100, 'revenue'), p('clearing', 'cr', 100))],
    });
    expect(codes(r)).toEqual(['SPLIT_ENTRY@r1/-', 'WRONG_TYPE@r2/bank']);
    expect(r.correct).toBe(false);
  });

  it('not a split when the rows do not net exactly to a solution row', () => {
    const r = checkBooking(deposit, co, { rows: [row('r1', p('bank', 'dr', 50), p('cash', 'cr', 50)), row('r2', p('bank', 'dr', 40), p('cash', 'cr', 40))] });
    expect(r.diagnostics.some((d) => d.code === 'SPLIT_ENTRY')).toBe(false);
    expect(r.correct).toBe(false);
  });
});

describe('checkBooking — WRONG_ROW and row alignment', () => {
  it('two events merged into one row: WRONG_ROW, not EXTRA + MISSING', () => {
    const r = checkBooking(twoEvents, co, {
      rows: [row('r1', p('cash', 'dr', 1000), p('capital', 'cr', 1000), p('equipment', 'dr', 400), p('ap', 'cr', 400)), row('r2')],
    });
    expect(codes(r)).toEqual(['WRONG_ROW@r1/equipment', 'WRONG_ROW@r1/ap']);
    expect(r.correctParts).toEqual([
      { rowId: 'r1', accountId: 'cash' },
      { rowId: 'r1', accountId: 'capital' },
    ]);
  });

  it('a posting moved to the other row', () => {
    const r = checkBooking(twoEvents, co, {
      rows: [row('r1', p('cash', 'dr', 1000), p('ap', 'cr', 400)), row('r2', p('equipment', 'dr', 400), p('capital', 'cr', 1000))],
    });
    expect(codes(r)).toEqual(['UNBALANCED_ROW@r1/-', 'WRONG_ROW@r1/ap', 'UNBALANCED_ROW@r2/-', 'WRONG_ROW@r2/capital']);
  });

  it('rows booked in swapped order', () => {
    const [a, b] = twoEventsCorrect();
    const r = checkBooking(twoEvents, co, { rows: [{ ...b!, id: 'x' }, { ...a!, id: 'y' }] });
    expect(r.diagnostics.map((d) => d.code)).toEqual(['WRONG_ROW', 'WRONG_ROW']);
    expect(r.diagnostics.every((d) => d.location.field === 'row')).toBe(true);
  });

  it('first event skipped, second booked: second is correct, first reported missing (no rowId)', () => {
    const r = checkBooking(twoEvents, co, { rows: [row('r1', p('equipment', 'dr', 400), p('ap', 'cr', 400))] });
    expect(codes(r)).toEqual(['MISSING_ACCOUNT@-/cash', 'MISSING_ACCOUNT@-/capital']);
    expect(r.diagnostics[0]!.message).toBe("A transaction from the problem hasn't been booked yet.");
    expect(r.correctParts).toEqual([
      { rowId: 'r1', accountId: 'equipment' },
      { rowId: 'r1', accountId: 'ap' },
    ]);
  });

  it('empty answer: every solution posting is missing', () => {
    const r = checkBooking(twoEvents, co, { rows: [] });
    expect(r.diagnostics.map((d) => d.code)).toEqual(Array(4).fill('MISSING_ACCOUNT'));
    expect(r.correct).toBe(false);
  });

  it('an extra, unrelated row is EXTRA_ACCOUNT with a whole-row message', () => {
    const r = checkBooking(deposit, co, { rows: [row('r1', p('bank', 'dr', 100), p('cash', 'cr', 100)), row('r2', p('rent', 'dr', 5), p('cash', 'cr', 5))] });
    expect(codes(r)).toEqual(['EXTRA_ACCOUNT@r2/cash', 'EXTRA_ACCOUNT@r2/rent']);
    expect(r.diagnostics[0]!.message).toMatch(/doesn't match any event/);
  });

  it('booking the same event twice: the duplicate is extra', () => {
    const r = checkBooking(deposit, co, { rows: [row('r1', p('bank', 'dr', 100), p('cash', 'cr', 100)), row('r2', p('bank', 'dr', 100), p('cash', 'cr', 100))] });
    expect(codes(r)).toEqual(['EXTRA_ACCOUNT@r2/cash', 'EXTRA_ACCOUNT@r2/bank']);
  });

  it('align(): equal row counts pair in order even when wrong', () => {
    const l = [netOf([row('a', p('rent', 'dr', 1), p('cash', 'cr', 1))]), netOf([row('b', p('sales', 'cr', 1), p('ar', 'dr', 1))])];
    const s = [netOf([row('x', p('bank', 'dr', 1), p('loan', 'cr', 1))]), netOf([row('y', p('ap', 'cr', 1), p('equipment', 'dr', 1))])];
    expect(align(l, s).map((x) => x.kind)).toEqual(['pair', 'pair']);
  });
});

describe('checkBooking — after balance sheet', () => {
  const correctBs = { lines: [{ accountId: 'cash', amount: 100000 }, { accountId: 'equipment', amount: 40000 }, { accountId: 'ap', amount: 40000 }, { accountId: 'capital', amount: 100000 }] };

  it('correct after-BS: no diagnostics, BS lines acknowledged', () => {
    const r = checkBooking(twoEvents, co, { rows: twoEventsCorrect(), balanceSheet: correctBs });
    expect(r.diagnostics).toEqual([]);
    expect(r.correctParts.filter((c) => !c.rowId)).toHaveLength(4);
  });

  it('zero-balance lines may be omitted or included as 0', () => {
    const prob: BookingProblem = { ...deposit, askAfterBalanceSheet: true };
    const rows = [row('r1', p('bank', 'dr', 100), p('cash', 'cr', 100))];
    const omitted = checkBooking(prob, co, { rows, balanceSheet: { lines: [{ accountId: 'bank', amount: 10000 }, { accountId: 'capital', amount: 10000 }] } });
    const zero = checkBooking(prob, co, {
      rows,
      balanceSheet: { lines: [{ accountId: 'cash', amount: 0 }, { accountId: 'bank', amount: 10000 }, { accountId: 'capital', amount: 10000 }] },
    });
    expect(omitted.diagnostics).toEqual([]);
    expect(zero.diagnostics).toEqual([]);
  });

  it('BS_MISMATCH per wrong line + EQUATION_BROKEN', () => {
    const r = checkBooking(twoEvents, co, {
      rows: twoEventsCorrect(),
      balanceSheet: { lines: [{ accountId: 'cash', amount: 90000 }, { accountId: 'equipment', amount: 40000 }, { accountId: 'ap', amount: 40000 }, { accountId: 'capital', amount: 100000 }] },
    });
    expect(codes(r)).toEqual(['BS_MISMATCH@-/cash', 'EQUATION_BROKEN@-/-']);
    expect(r.diagnostics[0]!.location.field).toBe('bs-line');
    expect(r.diagnostics[1]!.message).toBe("Your balance sheet doesn't balance: Assets $1,300 ≠ Liabilities $400 + Equity $1,000.");
  });

  it('BS_MISMATCH without EQUATION_BROKEN when wrong lines still balance; extra BS line flagged', () => {
    const r = checkBooking(twoEvents, co, {
      rows: twoEventsCorrect(),
      balanceSheet: { lines: [...correctBs.lines, { accountId: 'bank', amount: 500 }, { accountId: 'loan', amount: 500 }] },
    });
    expect(codes(r)).toEqual(['BS_MISMATCH@-/bank', 'BS_MISMATCH@-/loan']);
  });

  it('BS is compared to the solution even when the rows are wrong', () => {
    const r = checkBooking(twoEvents, co, { rows: [row('r1', p('cash', 'dr', 1000), p('capital', 'cr', 1000))], balanceSheet: correctBs });
    expect(r.diagnostics.map((d) => d.code)).toEqual(['MISSING_ACCOUNT', 'MISSING_ACCOUNT']);
  });

  it('BS not checked when the problem does not ask for it, or none was given', () => {
    expect(checkBooking(deposit, co, { rows: [row('r1', p('bank', 'dr', 100), p('cash', 'cr', 100))], balanceSheet: { lines: [] } }).diagnostics).toEqual([]);
    expect(checkBooking(twoEvents, co, { rows: twoEventsCorrect() }).diagnostics).toEqual([]);
  });
});

describe('checkBooking — ordering', () => {
  it('orders by row, then canonical column order (A ‖ L │ E), then code', () => {
    const r = checkBooking(twoEvents, co, {
      rows: [
        row('r1', p('capital', 'dr', 1000), p('cash', 'cr', 1000, 'liability')),
        row('r2', p('ap', 'cr', 300), p('equipment', 'dr', 400)),
      ],
    });
    expect(codes(r)).toEqual([
      'WRONG_SIDE@r1/cash',
      'WRONG_TYPE@r1/cash',
      'WRONG_SIDE@r1/capital',
      'UNBALANCED_ROW@r2/-',
      'WRONG_AMOUNT@r2/ap',
    ]);
  });

  it('is deterministic', () => {
    const ans = { rows: [row('r1', p('ap', 'dr', 3), p('rent', 'cr', 9), p('customer-deposits', 'dr', 1)), row('r2', p('accum-dep', 'cr', 2))] };
    expect(checkBooking(twoEvents, co, ans)).toEqual(checkBooking(twoEvents, co, ans));
  });
});
