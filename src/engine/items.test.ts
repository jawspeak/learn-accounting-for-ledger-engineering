import { describe, expect, it } from 'vitest';
import type {
  AttemptState,
  CheckResult,
  ClassifyProblem,
  CoaDesignProblem,
  DrCrPredictProblem,
  EquationFillProblem,
  MultipleChoiceProblem,
  ProblemBase,
  StatementFillProblem,
} from '@contracts';
import { checkProblem } from './checker';
import { equationBlank } from './items';
import { co, p, row, twoEvents, twoEventsCorrect } from './fixtures.test-helpers';

const base: Omit<ProblemBase, 'id'> = {
  sectionId: '01-equation',
  title: 't',
  role: 'practice',
  difficulty: 1,
  prompt: 'x',
  hints: [],
  explanation: 'x',
};
const entities = { co };
const attempt = (problemId: string, items?: unknown[], extra: Partial<AttemptState> = {}): AttemptState => ({ v: 1, problemId, items, ...extra });
const summary = (r: CheckResult) => ({
  wrong: r.diagnostics.map((d) => d.location.itemIndex),
  right: r.correctParts.map((c) => c.itemIndex),
  correct: r.correct,
});

describe('classify', () => {
  const prob: ClassifyProblem = {
    ...base,
    id: '01-classify',
    kind: 'classify',
    buckets: ['asset', 'liability', 'revenue'],
    items: [
      { label: 'Cash', answer: 'asset', explanation: 'E0' },
      { label: 'Loan', answer: 'liability', explanation: 'E1' },
      { label: 'Sales', answer: 'revenue', explanation: 'E2' },
    ],
  };
  it('all right', () => {
    expect(summary(checkProblem(prob, attempt(prob.id, ['asset', 'liability', 'revenue']), entities))).toEqual({ wrong: [], right: [0, 1, 2], correct: true });
  });
  it('wrong and unanswered items, with authored explanations', () => {
    const r = checkProblem(prob, attempt(prob.id, ['asset', 'asset']), entities);
    expect(summary(r)).toEqual({ wrong: [1, 2], right: [0], correct: false });
    expect(r.diagnostics[0]).toEqual({
      code: 'WRONG_ITEM',
      severity: 'error',
      location: { itemIndex: 1, field: 'item' },
      message: 'This item is in the wrong bucket.',
      explanation: 'E1',
    });
    expect(r.diagnostics[1]!.message).toBe("This one hasn't been answered yet.");
  });
  it('missing items array: everything unanswered', () => {
    expect(summary(checkProblem(prob, attempt(prob.id), entities)).wrong).toEqual([0, 1, 2]);
  });
});

describe('dr-cr-predict', () => {
  const prob: DrCrPredictProblem = {
    ...base,
    id: '02-drcr',
    kind: 'dr-cr-predict',
    items: [
      { accountName: 'Cash', accountType: 'asset', change: 'increase', answer: 'dr', explanation: 'A' },
      { accountName: 'Loan', accountType: 'liability', change: 'decrease', answer: 'dr', explanation: 'B' },
      { accountName: 'Sales', accountType: 'revenue', change: 'increase', answer: 'cr', explanation: 'C' },
    ],
  };
  it('checks each side; nulls and junk are unanswered', () => {
    const r = checkProblem(prob, attempt(prob.id, ['dr', 'cr', 'xx']), entities);
    expect(summary(r)).toEqual({ wrong: [1, 2], right: [0], correct: false });
    expect(r.diagnostics.map((d) => d.explanation)).toEqual(['B', 'C']);
  });
  it('all right', () => {
    expect(checkProblem(prob, attempt(prob.id, ['dr', 'dr', 'cr']), entities).correct).toBe(true);
  });
});

describe('equation-fill', () => {
  const prob: EquationFillProblem = {
    ...base,
    id: '01-eq',
    kind: 'equation-fill',
    items: [
      { assets: null, liabilities: 300, equity: 700, explanation: 'A' },
      { assets: 1000, liabilities: null, equity: 700, explanation: 'L' },
      { assets: 1000, liabilities: 300, equity: null, explanation: 'E' },
      { assets: 500, liabilities: 600, equity: null, explanation: 'negative equity' },
    ],
  };
  it('computes the blank', () => {
    expect(prob.items.map(equationBlank)).toEqual([1000, 300, 700, -100]);
    expect(equationBlank({ assets: null, liabilities: null, equity: 1, explanation: '' })).toBeUndefined();
  });
  it('accepts numbers and numeric strings', () => {
    expect(summary(checkProblem(prob, attempt(prob.id, [1000, '300', '$700', -100]), entities))).toEqual({ wrong: [], right: [0, 1, 2, 3], correct: true });
  });
  it('wrong and unanswered', () => {
    const r = checkProblem(prob, attempt(prob.id, [999, null, '', 100]), entities);
    expect(summary(r).wrong).toEqual([0, 1, 2, 3]);
    expect(r.diagnostics[0]!.message).toBe("That number doesn't make the equation balance.");
    expect(r.diagnostics[1]!.message).toBe("This one hasn't been answered yet.");
  });
});

describe('multiple-choice', () => {
  const options = [
    { text: 'a', correct: true, explanation: 'Ea' },
    { text: 'b', correct: false, explanation: 'Eb' },
    { text: 'c', correct: true, explanation: 'Ec' },
  ];
  const multi: MultipleChoiceProblem = { ...base, id: '01-mc', kind: 'multiple-choice', multi: true, options };
  const single: MultipleChoiceProblem = { ...base, id: '01-sc', kind: 'multiple-choice', multi: false, options: options.slice(0, 2) };

  it('multi: all correct options selected', () => {
    expect(summary(checkProblem(multi, attempt(multi.id, [[2, 0]]), entities))).toEqual({ wrong: [], right: [0, 2], correct: true });
  });
  it('multi: wrong pick and missed option', () => {
    const r = checkProblem(multi, attempt(multi.id, [[0, 1]]), entities);
    expect(summary(r)).toEqual({ wrong: [1, 2], right: [0], correct: false });
    expect(r.diagnostics.map((d) => d.explanation)).toEqual(['Eb', 'Ec']);
  });
  it('single: wrong pick marks the pick and the unselected correct option', () => {
    const r = checkProblem(single, attempt(single.id, [[1]]), entities);
    expect(summary(r)).toEqual({ wrong: [0, 1], right: [], correct: false });
    expect(r.diagnostics.map((d) => d.message)).toEqual(['There is another correct option you didn’t select.', "This option isn't correct."]);
    expect(checkProblem(single, attempt(single.id, [[0]]), entities).correct).toBe(true);
  });
  it('nothing selected (or malformed) → every correct option marked unanswered', () => {
    for (const items of [undefined, [[]], [null], [[7, -1]], ['x']]) {
      const r = checkProblem(multi, attempt(multi.id, items), entities);
      expect(summary(r)).toEqual({ wrong: [0, 2], right: [], correct: false });
      expect(r.diagnostics[0]!.message).toBe('Choose an answer first.');
    }
  });
});

describe('coa-design', () => {
  const prob: CoaDesignProblem = {
    ...base,
    id: '12-coa',
    kind: 'coa-design',
    candidates: [
      { name: 'Cash – FBO', answerType: 'asset', required: true, explanation: 'E0' },
      { name: 'Customer Balances Payable', answerType: 'liability', required: true, explanation: 'E1' },
      { name: 'Inventory', answerType: 'asset', required: false, explanation: 'E2' },
    ],
  };
  it('all right (excluded irrelevant account counts as correct)', () => {
    const r = checkProblem(prob, attempt(prob.id, [{ included: true, type: 'asset' }, { included: true, type: 'liability' }, { included: false, type: null }]), entities);
    expect(summary(r)).toEqual({ wrong: [], right: [0, 1, 2], correct: true });
  });
  it('wrong type, missing, not needed', () => {
    const r = checkProblem(prob, attempt(prob.id, [{ included: true, type: 'liability' }, { included: false, type: null }, { included: true, type: 'asset' }]), entities);
    expect(r.diagnostics.map((d) => [d.location.itemIndex, d.location.field, d.message])).toEqual([
      [0, 'type', 'Right account to include, but the type is wrong.'],
      [1, 'item', 'This business needs this account.'],
      [2, 'item', "This business doesn't need this account."],
    ]);
  });
  it('included without a type, and unanswered entries', () => {
    const r = checkProblem(prob, attempt(prob.id, [{ included: true, type: null }, null]), entities);
    expect(summary(r).wrong).toEqual([0, 1, 2]);
    expect(r.diagnostics.every((d) => d.message === "This one hasn't been answered yet.")).toBe(true);
  });
});

describe('statement-fill', () => {
  const rows = twoEventsCorrect();
  const bsProb: StatementFillProblem = {
    ...base,
    id: '10-bs',
    kind: 'statement-fill',
    entityId: 'co',
    statement: 'balance-sheet',
    rows,
    answer: { balanceSheet: { lines: [{ accountId: 'cash', amount: 100000 }, { accountId: 'equipment', amount: 40000 }, { accountId: 'ap', amount: 40000 }, { accountId: 'capital', amount: 100000 }] } },
  };

  it('balance-sheet: correct, and derived answer when omitted', () => {
    const bs = bsProb.answer.balanceSheet!;
    expect(checkProblem(bsProb, attempt(bsProb.id, undefined, { balanceSheet: bs }), entities).diagnostics).toEqual([]);
    const derived: StatementFillProblem = { ...bsProb, answer: {} };
    const r = checkProblem(derived, attempt(bsProb.id, undefined, { balanceSheet: bs }), entities);
    expect(r.diagnostics).toEqual([]);
    expect(r.correctParts).toHaveLength(4);
  });

  it('balance-sheet: BS_MISMATCH per line + EQUATION_BROKEN', () => {
    const r = checkProblem(bsProb, attempt(bsProb.id, undefined, { balanceSheet: { lines: [{ accountId: 'cash', amount: 100000 }, { accountId: 'equipment', amount: 40000 }, { accountId: 'capital', amount: 100000 }] } }), entities);
    expect(r.diagnostics.map((d) => [d.code, d.location.accountId])).toEqual([
      ['BS_MISMATCH', 'ap'],
      ['EQUATION_BROKEN', undefined],
    ]);
  });

  it('itemIndex = position in problem.answer lines; blanks omitted; zero lines may be blank; learner-only lines', () => {
    const prob: StatementFillProblem = {
      ...bsProb,
      answer: { balanceSheet: { lines: [...bsProb.answer.balanceSheet!.lines, { accountId: 'bank', amount: 0 }] } },
    };
    const r = checkProblem(
      prob,
      attempt(prob.id, undefined, {
        balanceSheet: {
          lines: [
            { accountId: 'capital', amount: 100000 },
            { accountId: 'cash', amount: 100000 },
            { accountId: 'equipment', amount: 4000 },
            { accountId: 'loan', amount: 1 },
          ],
        },
      }),
      entities,
    );
    expect(r.diagnostics.filter((d) => d.code === 'BS_MISMATCH').map((d) => d.location)).toEqual([
      { accountId: 'equipment', itemIndex: 1, field: 'bs-line' },
      { accountId: 'ap', itemIndex: 2, field: 'bs-line' },
      { accountId: 'loan', field: 'bs-line' },
    ]);
    expect(r.correctParts).toEqual([
      { accountId: 'cash', itemIndex: 0 },
      { accountId: 'capital', itemIndex: 3 },
      { accountId: 'bank', itemIndex: 4 },
    ]);
  });

  it('balance-sheet: empty attempt flags every non-zero line, no equation noise', () => {
    const r = checkProblem(bsProb, attempt(bsProb.id), entities);
    expect(r.diagnostics.map((d) => d.code)).toEqual(Array(4).fill('BS_MISMATCH'));
  });

  it('income-statement: only revenue/expense lines when derived', () => {
    const isProb: StatementFillProblem = {
      ...bsProb,
      id: '07-is',
      statement: 'income-statement',
      rows: [row('a', p('cash', 'dr', 500), p('sales', 'cr', 500)), row('b', p('rent', 'dr', 200), p('cash', 'cr', 200))],
      answer: {},
    };
    const ok = checkProblem(isProb, attempt(isProb.id, undefined, { balanceSheet: { lines: [{ accountId: 'sales', amount: 50000 }, { accountId: 'rent', amount: 20000 }] } }), entities);
    expect(ok.diagnostics).toEqual([]);
    const bad = checkProblem(isProb, attempt(isProb.id, undefined, { balanceSheet: { lines: [{ accountId: 'sales', amount: 50000 }, { accountId: 'rent', amount: -20000 }] } }), entities);
    expect(bad.diagnostics.map((d) => [d.code, d.location.accountId])).toEqual([['BS_MISMATCH', 'rent']]);
  });

  it('trial-balance: compares by side and amount', () => {
    const tbProb: StatementFillProblem = { ...bsProb, id: '10-tb', statement: 'trial-balance', answer: {} };
    const good = [
      { accountId: 'cash', side: 'dr' as const, amount: 100000 },
      { accountId: 'capital', side: 'cr' as const, amount: 100000 },
      { accountId: 'equipment', side: 'dr' as const, amount: 40000 },
      { accountId: 'ap', side: 'cr' as const, amount: 40000 },
    ];
    expect(checkProblem(tbProb, attempt(tbProb.id, undefined, { trialBalance: good }), entities).diagnostics).toEqual([]);
    const bad = good.map((l) => (l.accountId === 'ap' ? { ...l, side: 'dr' as const } : l));
    const r = checkProblem(tbProb, attempt(tbProb.id, undefined, { trialBalance: bad }), entities);
    expect(r.diagnostics.map((d) => [d.code, d.location.accountId, d.message])).toEqual([['BS_MISMATCH', 'ap', "This trial-balance line doesn't match the transactions."]]);
  });
});

describe('checkProblem dispatch for booking', () => {
  it('delegates to checkBooking using attempt.rows / balanceSheet', () => {
    const r = checkProblem(twoEvents, attempt(twoEvents.id, undefined, { rows: twoEventsCorrect() }), entities);
    expect(r.correct).toBe(true);
    expect(() => checkProblem(twoEvents, attempt(twoEvents.id), {})).toThrow(/Unknown entity/);
  });
});
