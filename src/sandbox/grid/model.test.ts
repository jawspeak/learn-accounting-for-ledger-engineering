import { describe, expect, it } from 'vitest';
import type { EntityBooks } from '@contracts';
import { engine } from '@engine';
import { EXAMPLES } from '../../../content/sandbox-examples';
import { parseDollars, formatDollars } from '../../components/builder/model';
import {
  addAccount,
  addEntry,
  isManualOrder,
  moveAccountInOrder,
  moveRow,
  orderedAccounts,
  orderedIds,
  removeAccount,
  removeRow,
  setManualOrder,
  setOpening,
  updateAccount,
} from '../model';
import { equalsAt, setAmount, sheetBalance } from './model';

/** Three accounts and two empty entries, as "+ Add entry" makes them in the Grid. */
const base = (): EntityBooks =>
  addEntry(
    addEntry(
      {
        id: 'x',
        name: 'X',
        accounts: [
          { id: 'cash', name: 'Cash', type: 'asset' },
          { id: 'revenue', name: 'Revenue', type: 'revenue' },
          { id: 'payable', name: 'Payable', type: 'liability' },
        ],
        rows: [],
        showBalanceSheets: false,
      },
      { blankLines: false },
    ),
    { blankLines: false },
  );
const balanceOf = (bs: { lines: { accountId: string; amount: number }[] }, id: string) =>
  bs.lines.find((l) => l.accountId === id)?.amount ?? 0;

describe('grid entries', () => {
  it('the Grid has exactly the stored entries; "+ Add entry" adds one with no lines', () => {
    const e = base();
    expect(e.rows).toEqual([
      { id: 'r1', postings: [] },
      { id: 'r2', postings: [] },
    ]);
    expect(setAmount(e, 1, 'cash', 'dr', 500).rows[1]!.postings).toEqual([
      { accountId: 'cash', side: 'dr', amount: 500, chosenType: 'asset' },
    ]);
    // There are no blank padding rows, so nothing past the last entry gets created.
    expect(setAmount(e, 5, 'cash', 'dr', 500).rows).toHaveLength(2);
  });
});

describe('balances', () => {
  it('every row counts (there is no pending state), on each account’s normal side', () => {
    let e = setAmount(base(), 0, 'cash', 'dr', 2000);
    e = setAmount(e, 0, 'payable', 'cr', 2000);
    e = setAmount(e, 1, 'payable', 'dr', 1200);
    e = setAmount(e, 1, 'cash', 'cr', 1200);
    const bal = sheetBalance(e);
    expect(balanceOf(bal, 'cash')).toBe(800);
    expect(balanceOf(bal, 'payable')).toBe(800);
  });

  it('opening balances feed the balance, and a 0 removes the line', () => {
    let e = setOpening(base(), 'cash', 10000);
    expect(balanceOf(sheetBalance(e), 'cash')).toBe(10000);
    e = setOpening(e, 'cash', 0);
    expect(e.opening).toBeUndefined();
  });
});

describe('accounts', () => {
  it('adds with a unique slug id; contra types get a parent', () => {
    const { entity, id } = addAccount(base(), 'Cash', 'asset');
    expect(id).toBe('cash-2');
    const contra = addAccount(entity, 'Allowance', 'contra-asset');
    expect(contra.entity.accounts.at(-1)!.contraOf).toBe('cash');
  });

  it('changing type re-types postings and clears contraOf when no longer contra', () => {
    let e = setAmount(base(), 0, 'revenue', 'cr', 100);
    e = updateAccount(e, 'revenue', { type: 'liability' });
    expect(e.rows[0]!.postings[0]!.chosenType).toBe('liability');
    e = updateAccount(e, 'payable', { type: 'contra-liability' });
    expect(e.accounts.find((a) => a.id === 'payable')!.contraOf).toBe('revenue');
    e = updateAccount(e, 'payable', { type: 'liability' });
    expect(e.accounts.find((a) => a.id === 'payable')!.contraOf).toBeUndefined();
  });

  it('a blank subtitle is dropped rather than stored', () => {
    const e = updateAccount(updateAccount(base(), 'cash', { subtitle: 'Bank' }), 'cash', {
      subtitle: '',
    });
    expect('subtitle' in e.accounts[0]!).toBe(false);
  });

  it('removes an account with its postings and opening line', () => {
    let e = setAmount(base(), 0, 'cash', 'dr', 100);
    e = setOpening(e, 'cash', 500);
    e = removeAccount(e, 'cash');
    expect(e.accounts.map((a) => a.id)).toEqual(['revenue', 'payable']);
    expect(e.rows[0]!.postings).toEqual([]);
    expect(e.opening).toBeUndefined();
  });
});

describe('one account order (both views)', () => {
  it('auto is the balance-sheet order, whatever order accounts were added in', () => {
    expect(isManualOrder(base())).toBe(false);
    expect(orderedIds(base())).toEqual(['cash', 'payable', 'revenue']);
    expect(equalsAt(orderedAccounts(base()))).toBe(1);
    // ◀ ▶ do nothing in auto mode.
    expect(moveAccountInOrder(base(), 'cash', 1)).toEqual(base());
  });

  it('manual starts from what you see, moves edit it, new accounts go at the end, auto clears it', () => {
    let e = setManualOrder(base(), true);
    expect(e.columnOrder).toEqual(['cash', 'payable', 'revenue']);
    e = moveAccountInOrder(e, 'cash', 1);
    expect(orderedIds(e)).toEqual(['payable', 'cash', 'revenue']);
    expect(equalsAt(orderedAccounts(e))).toBe(-1); // not in A ‖ L/E order: no = divider
    e = addAccount(e, 'Savings', 'asset').entity;
    expect(orderedIds(e)).toEqual(['payable', 'cash', 'revenue', 'savings']);
    expect(orderedIds(setManualOrder(e, false))).toEqual(['cash', 'savings', 'payable', 'revenue']);
    expect('columnOrder' in setManualOrder(e, false)).toBe(false);
  });
});

describe('rows (both views)', () => {
  it('move up / down and remove', () => {
    let e = setAmount(base(), 0, 'cash', 'dr', 100);
    e = setAmount(e, 1, 'cash', 'dr', 200);
    e = moveRow(e, 1, -1);
    expect(e.rows.map((r) => r.postings[0]!.amount)).toEqual([200, 100]);
    expect(moveRow(e, 0, -1)).toBe(e); // already at the top
    expect(removeRow(e, 0).rows.map((r) => r.postings[0]!.amount)).toEqual([100]);
  });
});

describe('money', () => {
  it('the sandbox takes dollars and cents; problems stay whole dollars', () => {
    expect(parseDollars('44.24', { allowCents: true })).toBe(4424);
    expect(parseDollars('44.2', { allowCents: true })).toBe(4420);
    expect(parseDollars('44.', { allowCents: true })).toBe(4400);
    expect(parseDollars('.5', { allowCents: true })).toBe(50);
    expect(parseDollars('$1,200.05', { allowCents: true })).toBe(120005);
    expect(parseDollars('-3.10', { allowCents: true, allowNegative: true })).toBe(-310);
    expect(parseDollars('44.245', { allowCents: true })).toBeNull();
    expect(parseDollars('44.24')).toBeNull();
    expect(parseDollars('44')).toBe(4400);
    expect(formatDollars(4420)).toBe('$44.20');
    expect(formatDollars(120000)).toBe('$1,200');
  });
});

describe('URL state', () => {
  it('round-trips subtitles through the sandbox codec', () => {
    const s = EXAMPLES.find((x) => x.id === 'payroll')!.build();
    const back = engine.decodeSandbox(engine.encodeState(s));
    expect(back).toEqual(s);
    expect(back!.entities[0]!.accounts[0]!.subtitle).toBe('Bank account');
  });
});
