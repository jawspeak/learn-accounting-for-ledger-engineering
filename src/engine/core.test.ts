import { describe, expect, it } from 'vitest';
import type { AccountType, BookingProblem, SandboxState } from '@contracts';
import { checkEquation, computeBalances, normalSide, orderColumns, rowTotals, trialBalance } from './core';
import { pickerAccounts } from './checker';
import { decodeAttempt, decodeSandbox, encodeState } from './urlState';
import { co, deposit, p, row, typeOf, twoEventsCorrect } from './fixtures.test-helpers';

describe('normalSide / rowTotals', () => {
  it('DEALER + contras', () => {
    const dr: AccountType[] = ['asset', 'expense', 'dividend', 'contra-liability', 'contra-equity', 'contra-revenue'];
    const cr: AccountType[] = ['liability', 'equity', 'revenue', 'contra-asset'];
    for (const t of dr) expect(normalSide(t)).toBe('dr');
    for (const t of cr) expect(normalSide(t)).toBe('cr');
  });
  it('row totals; empty row is not balanced', () => {
    expect(rowTotals(row('a', p('cash', 'dr', 5), p('bank', 'cr', 5)))).toEqual({ dr: 500, cr: 500, balanced: true });
    expect(rowTotals(row('a', p('cash', 'dr', 5)))).toEqual({ dr: 500, cr: 0, balanced: false });
    expect(rowTotals(row('a')).balanced).toBe(false);
  });
});

describe('computeBalances / checkEquation / trialBalance', () => {
  it('applies rows to opening balances on the normal side', () => {
    const bs = computeBalances(twoEventsCorrect(), typeOf, { lines: [{ accountId: 'cash', amount: 500 }] });
    expect(bs.lines).toEqual([
      { accountId: 'cash', amount: 100500 },
      { accountId: 'capital', amount: 100000 },
      { accountId: 'equipment', amount: 40000 },
      { accountId: 'ap', amount: 40000 },
    ]);
  });
  it('abnormal balances are negative; duplicate opening lines are summed', () => {
    const bs = computeBalances([row('a', p('cash', 'cr', 10), p('ap', 'dr', 10))], typeOf, {
      lines: [
        { accountId: 'cash', amount: 300 },
        { accountId: 'cash', amount: 200 },
      ],
    });
    expect(bs.lines).toEqual([
      { accountId: 'cash', amount: -500 },
      { accountId: 'ap', amount: -1000 },
    ]);
  });
  it('contra accounts and income statement accounts in the equation', () => {
    const lines = [
      { accountId: 'cash', amount: 1000 },
      { accountId: 'equipment', amount: 500 },
      { accountId: 'accum-dep', amount: 100 },
      { accountId: 'ap', amount: 200 },
      { accountId: 'capital', amount: 1000 },
      { accountId: 'sales', amount: 400 },
      { accountId: 'rent', amount: 200 },
    ];
    expect(checkEquation({ lines }, typeOf)).toEqual({ assets: 1400, liabilities: 200, equity: 1200, balanced: true });
    expect(checkEquation({ lines: [...lines, { accountId: 'cash', amount: 1 }] }, typeOf).balanced).toBe(false);
  });
  it('dividends and contra-revenue reduce equity', () => {
    const types: Record<string, AccountType> = { c: 'asset', e: 'equity', d: 'dividend', r: 'revenue', cr: 'contra-revenue' };
    const lines = [
      { accountId: 'c', amount: 70 },
      { accountId: 'e', amount: 100 },
      { accountId: 'd', amount: 10 },
      { accountId: 'r', amount: 30 },
      { accountId: 'cr', amount: 50 },
    ];
    expect(checkEquation({ lines }, (id) => types[id]).balanced).toBe(true);
  });
  it('trial balance shows abnormal balances on the other side', () => {
    expect(trialBalance([row('a', p('cash', 'cr', 10), p('ap', 'dr', 10))], typeOf)).toEqual([
      { accountId: 'cash', side: 'cr', amount: 1000 },
      { accountId: 'ap', side: 'dr', amount: 1000 },
    ]);
  });
});

describe('orderColumns', () => {
  const coaOrder = co.accounts.map((a) => a.id);
  const col = (id: string, type?: AccountType) => {
    const a = co.accounts.find((x) => x.id === id);
    return { accountId: id, type: type ?? a?.type ?? 'asset', contraOf: a?.contraOf, equityGroup: a?.equityGroup };
  };
  const ids = (cols: ReturnType<typeof col>[]) => orderColumns(cols, coaOrder).map((c) => c.accountId);

  it('A ‖ L │ PIC │ RE │ revenue │ expenses │ dividends, CoA order within groups', () => {
    const out = orderColumns(
      [col('rent'), col('sales'), col('re'), col('capital'), col('loan'), col('ap'), col('bank'), col('cash'), { accountId: 'div', type: 'dividend' }],
      coaOrder,
    );
    expect(out.map((c) => c.accountId)).toEqual(['cash', 'bank', 'ap', 'loan', 'capital', 're', 'sales', 'rent', 'div']);
    expect(out.map((c) => c.group)).toEqual([
      'assets',
      'assets',
      'liabilities',
      'liabilities',
      'equity-paid-in',
      'equity-retained',
      'revenue',
      'expenses',
      'dividends',
    ]);
  });
  it('contra directly after its parent even if the CoA lists it elsewhere', () => {
    const out = orderColumns([col('ar'), col('accum-dep'), col('equipment'), col('cash')], ['cash', 'accum-dep', 'ar', 'equipment']);
    expect(out.map((c) => c.accountId)).toEqual(['cash', 'ar', 'equipment', 'accum-dep']);
  });
  it('contra without its parent column sits by its own CoA order', () => {
    expect(ids([col('ar'), col('accum-dep'), col('cash')])).toEqual(['cash', 'ar', 'accum-dep']);
    const out = orderColumns([col('ar'), col('accum-dep'), col('cash')], ['accum-dep', 'cash', 'ar']);
    expect(out.map((c) => c.accountId)).toEqual(['accum-dep', 'cash', 'ar']);
  });
  it('two contras of one parent keep CoA order after it', () => {
    const cols = [
      { accountId: 'b', type: 'contra-asset' as const, contraOf: 'p' },
      { accountId: 'a', type: 'contra-asset' as const, contraOf: 'p' },
      { accountId: 'p', type: 'asset' as const },
      { accountId: 'z', type: 'asset' as const },
    ];
    expect(orderColumns(cols, ['p', 'z', 'b', 'a']).map((c) => c.accountId)).toEqual(['p', 'b', 'a', 'z']);
  });
  it('learner-chosen type decides the group (a mistyped contra is not pulled to the parent)', () => {
    expect(ids([col('equipment'), col('accum-dep', 'expense'), col('ap'), col('cash')])).toEqual(['cash', 'equipment', 'ap', 'accum-dep']);
  });
  it('unknown accounts are appended alphabetically within their group', () => {
    expect(ids([col('zeta'), col('alpha'), col('cash'), col('ap')])).toEqual([
      'cash',
      'alpha',
      'zeta',
      'ap',
    ]);
  });
  it('is independent of input order', () => {
    const cols = [col('rent'), col('accum-dep'), col('cash'), col('equipment'), col('ap')];
    expect(ids([...cols].reverse())).toEqual(ids(cols));
  });
});

describe('pickerAccounts', () => {
  it('alphabetical by name incl. traps, deterministic', () => {
    const names = pickerAccounts(deposit, co).map((a) => a.name);
    expect(names).toEqual([...names].sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : 1)));
    expect(names).toContain('Customer Deposits');
    expect(names).toHaveLength(co.accounts.length + 2);
  });
  it('respects accountChoiceIds (traps still offered)', () => {
    const prob: BookingProblem = { ...deposit, accountChoiceIds: ['cash', 'bank'] };
    expect(pickerAccounts(prob, co).map((a) => a.id)).toEqual(['bank', 'cash', 'customer-deposits', 'owner-cash']);
  });
});

describe('URL codec', () => {
  const sandbox: SandboxState = {
    v: 1,
    title: 'Deposit',
    scenario: '# Hi\nYou deposit **$100**.',
    entities: [
      {
        id: 'you',
        name: 'You',
        accounts: [{ id: 'cash', name: 'Cash', type: 'asset' }],
        rows: [row('r1', p('cash', 'dr', 100))],
        opening: { lines: [{ accountId: 'cash', amount: 100 }] },
        showBalanceSheets: true,
        columnOrder: ['cash'],
      },
    ],
  };
  it('sandbox round-trips and is URL safe', () => {
    const enc = encodeState(sandbox);
    expect(enc).toMatch(/^[A-Za-z0-9+\-$]*$/);
    expect(decodeSandbox(enc)).toEqual(sandbox);
  });
  it('attempt round-trips (rows, BS, TB, items)', () => {
    const a = {
      v: 1 as const,
      problemId: '03-cash-to-checking',
      rows: twoEventsCorrect(),
      balanceSheet: { lines: [{ accountId: 'cash', amount: 0 }] },
      trialBalance: [{ accountId: 'cash', side: 'dr' as const, amount: 5 }],
      items: ['asset', null, { included: true, type: 'asset' }, [[0, 2]]],
    };
    expect(decodeAttempt(encodeState(a))).toEqual(a);
  });
  it('tolerates "+" turned into a space by query-string decoding', () => {
    const enc = encodeState(sandbox);
    expect(decodeSandbox(enc.replace(/\+/g, ' '))).toEqual(sandbox);
  });
  it('rejects bad input', () => {
    expect(decodeSandbox('')).toBeNull();
    expect(decodeSandbox('garbage')).toBeNull();
    expect(decodeSandbox('%%%')).toBeNull();
    expect(decodeAttempt(encodeState(sandbox))).toBeNull();
    expect(decodeSandbox(encodeState({ v: 1, problemId: 'x' }))).toBeNull();
    expect(decodeSandbox(encodeState({ ...sandbox, v: 2 } as unknown as SandboxState))).toBeNull();
    const fractional = { v: 1 as const, problemId: 'x', rows: [{ id: 'r', postings: [{ accountId: 'cash', side: 'dr' as const, amount: 1.5 }] }] };
    expect(decodeAttempt(encodeState(fractional))).toBeNull();
  });
});
