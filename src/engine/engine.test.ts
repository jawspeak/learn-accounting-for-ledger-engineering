import { describe, expect, it } from 'vitest';
import { engine } from '@engine';
import { entities, problems } from '@content';
import type { BookingProblem, SandboxState } from '@contracts';

const you = entities['you']!;
const p = problems['03-cash-to-checking'] as BookingProblem;
const typeOf = (id: string) => you.accounts.find((a) => a.id === id)?.type;

describe('engine (phase-0 baseline)', () => {
  it('normal sides', () => {
    expect(engine.normalSide('asset')).toBe('dr');
    expect(engine.normalSide('liability')).toBe('cr');
    expect(engine.normalSide('expense')).toBe('dr');
    expect(engine.normalSide('contra-asset')).toBe('cr');
  });

  it('computes after balance sheet and equation', () => {
    const after = engine.computeBalances(p.solution, typeOf, p.opening);
    expect(after.lines).toEqual(
      expect.arrayContaining([
        { accountId: 'cash', amount: 0 },
        { accountId: 'checking', amount: 10000 },
      ]),
    );
    expect(engine.checkEquation(after, typeOf).balanced).toBe(true);
  });

  it('flags wrong side and counterparty account', () => {
    const res = engine.checkBooking(p, you, {
      rows: [
        {
          id: 'r1',
          postings: [
            { accountId: 'cash', side: 'cr', amount: 10000, chosenType: 'asset' },
            { accountId: 'customer-deposits', side: 'dr', amount: 10000, chosenType: 'liability' },
          ],
        },
      ],
    });
    expect(res.correct).toBe(false);
    const codes = res.diagnostics.map((d) => d.code).sort();
    expect(codes).toEqual(['COUNTERPARTY_ACCOUNT', 'MISSING_ACCOUNT']);
    expect(res.correctParts).toEqual([{ rowId: 'r1', accountId: 'cash' }]);
  });

  it('orders columns A ‖ L │ E with contra after parent', () => {
    const order = engine.orderColumns(
      [
        { accountId: 'loan', type: 'liability' },
        { accountId: 'accum-dep', type: 'contra-asset', contraOf: 'equip' },
        { accountId: 'rev', type: 'revenue' },
        { accountId: 'equip', type: 'asset' },
        { accountId: 'cash', type: 'asset' },
      ],
      ['cash', 'equip', 'accum-dep', 'loan', 'rev'],
    );
    expect(order.map((c) => c.accountId)).toEqual(['cash', 'equip', 'accum-dep', 'loan', 'rev']);
  });

  it('URL state round-trips', () => {
    const s: SandboxState = {
      v: 1,
      scenario: 'hi',
      entities: [{ id: 'e', name: 'E', accounts: [], rows: [], showBalanceSheets: false }],
    };
    expect(engine.decodeSandbox(engine.encodeState(s))).toEqual(s);
    expect(engine.decodeSandbox('garbage')).toBeNull();
  });
});
