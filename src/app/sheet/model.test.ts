import { describe, expect, it } from 'vitest';
import type { SandboxEntity } from '@contracts';
import { engine } from '@engine';
import { EXAMPLES } from '../sandbox/examples';
import { parseHash, href } from '../router';
import {
  addAccount,
  ensureRows,
  equalsAt,
  metadataError,
  MIN_ROWS,
  moveAccount,
  removeAccount,
  setAmount,
  setOpening,
  setPending,
  sheetBalances,
  sortCanonical,
  updateAccount,
  visibleRowCount,
} from './model';

const base = (): SandboxEntity => ({
  id: 'x',
  name: 'X',
  accounts: [
    { id: 'cash', name: 'Cash', type: 'asset' },
    { id: 'revenue', name: 'Revenue', type: 'revenue' },
    { id: 'payable', name: 'Payable', type: 'liability' },
  ],
  rows: [],
  showBalanceSheets: false,
});
const balanceOf = (bs: { lines: { accountId: string; amount: number }[] }, id: string) =>
  bs.lines.find((l) => l.accountId === id)?.amount ?? 0;

describe('sheet rows', () => {
  it('shows at least MIN_ROWS and a few spare rows past the last used one', () => {
    expect(visibleRowCount([])).toBe(MIN_ROWS);
    const rows = ensureRows([], 14).map((r, i) => (i === 14 ? { ...r, label: 'late' } : r));
    expect(visibleRowCount(rows)).toBe(18);
  });

  it('typing into a blank row materialises it and the blanks above, with unique ids', () => {
    const e = setAmount(base(), 3, 'cash', 'dr', 500);
    expect(e.rows.map((r) => r.id)).toEqual(['r1', 'r2', 'r3', 'r4']);
    expect(e.rows[3]!.postings).toEqual([
      { accountId: 'cash', side: 'dr', amount: 500, chosenType: 'asset' },
    ]);
  });
});

describe('posted vs pending balances', () => {
  it('posted excludes pending rows; pending includes everything', () => {
    let e = setAmount(base(), 0, 'cash', 'dr', 2000);
    e = setAmount(e, 0, 'payable', 'cr', 2000);
    e = setAmount(e, 1, 'payable', 'dr', 1200);
    e = setAmount(e, 1, 'cash', 'cr', 1200);
    e = setPending(e, 1, true);
    const { posted, pending, hasPending } = sheetBalances(e);
    expect(hasPending).toBe(true);
    expect(balanceOf(posted, 'cash')).toBe(2000);
    expect(balanceOf(pending, 'cash')).toBe(800);
    expect(setPending(e, 1, false).rows[1]!.pending).toBeUndefined();
  });

  it('opening balances feed both, and a 0 removes the line', () => {
    let e = setOpening(base(), 'cash', 10000);
    expect(balanceOf(sheetBalances(e).posted, 'cash')).toBe(10000);
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

  it('blank subtitle/metadata are dropped rather than stored', () => {
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

  it('moves and sorts columns; the = divider sits before the first right-hand account', () => {
    const e = moveAccount(base(), 'cash', 1);
    expect(e.accounts.map((a) => a.id)).toEqual(['revenue', 'cash', 'payable']);
    expect(equalsAt(e.accounts)).toBe(-1); // not in A ‖ L/E order
    const sorted = sortCanonical(e);
    expect(sorted.accounts.map((a) => a.id)).toEqual(['cash', 'payable', 'revenue']);
    expect(equalsAt(sorted.accounts)).toBe(1);
  });
});

describe('metadata JSON', () => {
  it('accepts empty or valid JSON and reports invalid JSON', () => {
    expect(metadataError(undefined)).toBeNull();
    expect(metadataError('  ')).toBeNull();
    expect(metadataError('{ "type": "cash" }')).toBeNull();
    expect(metadataError('{ "type": ')).not.toBeNull();
  });
});

describe('URL state', () => {
  it('round-trips subtitle, metadata and pending through the sandbox codec', () => {
    const s = EXAMPLES.find((x) => x.id === 'payroll')!.build();
    const back = engine.decodeSandbox(engine.encodeState(s));
    expect(back).toEqual(s);
    expect(back!.entities[0]!.accounts[0]!.metadata).toBe('{ "type": "cash" }');
    expect(back!.entities[0]!.rows[2]!.pending).toBe(true);
  });

  it('routes #/sheet with data and entity index', () => {
    expect(parseHash(href.sheet('abc', 1))).toEqual({ name: 'sheet', data: 'abc', entity: 1 });
    expect(parseHash('#/sheet')).toEqual({ name: 'sheet', data: undefined, entity: 0 });
    expect(parseHash('#/sheet?e=-3')).toEqual({ name: 'sheet', data: undefined, entity: 0 });
  });
});
