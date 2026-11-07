import { describe, expect, it } from 'vitest';
import type { TransactionRow } from '@contracts';
import you from '../../../content/entities/you';
import bank from '../../../content/entities/bank';
import { animationDefs } from './definitions';
import { animations } from './index';
import { BANK, YOU } from './accounts';
import { balancesOf, equationOf, rowTotals, usd, type AnimLedger, type LedgerAnimationDef } from './model';

const ledger = (def: LedgerAnimationDef, id: string): AnimLedger => {
  const l = def.ledgers.find((x) => x.id === id);
  if (!l) throw new Error(`no ledger ${id} in ${def.id}`);
  return l;
};
const def = (id: string) => {
  const d = animationDefs.find((x) => x.id === id);
  if (!d) throw new Error(`no animation ${id}`);
  return d;
};
const balanceAt = (animId: string, stepIdx: number, ledgerId: string, accountId: string) => {
  const d = def(animId);
  const step = stepIdx < 0 ? d.steps[d.steps.length + stepIdx]! : d.steps[stepIdx]!;
  return balancesOf(ledger(d, ledgerId), step.posted[ledgerId] ?? []).get(accountId) ?? 0;
};

describe('animation registry', () => {
  it('exposes the five animations by id', () => {
    expect(Object.keys(animations).sort()).toEqual(
      ['bank-view-deposit', 'cash-to-checking', 'daily-accrual', 'fbo-gross-up', 'loan-creates-deposit'].sort(),
    );
    for (const a of Object.values(animations)) {
      expect(a.title).toBeTruthy();
      expect(typeof a.component).toBe('function');
    }
  });
});

describe.each(animationDefs.map((d) => [d.id, d] as const))('%s data', (_id, d) => {
  const hasAccount = (ledgerId: string, accountId: string) =>
    d.ledgers.some((l) => l.id === ledgerId && l.accounts.some((a) => a.id === accountId));
  const isDrawn = (ledgerId: string, accountId: string) =>
    d.ledgers.some((l) => l.id === ledgerId && l.tAccounts.includes(accountId));

  it('has steps with captions', () => {
    expect(d.steps.length).toBeGreaterThanOrEqual(3);
    for (const s of d.steps) expect(s.caption.trim().length).toBeGreaterThan(10);
  });

  it('references only accounts that exist in each ledger', () => {
    for (const l of d.ledgers) {
      for (const id of l.tAccounts) expect(hasAccount(l.id, id), `${l.id}:${id}`).toBe(true);
      for (const o of l.opening) expect(hasAccount(l.id, o.accountId), `${l.id}:${o.accountId}`).toBe(true);
    }
    for (const s of d.steps) {
      for (const [lid, rows] of Object.entries(s.posted))
        for (const r of rows) for (const p of r.postings) expect(hasAccount(lid, p.accountId), p.accountId).toBe(true);
      if (s.draft) for (const p of s.draft.row.postings) expect(hasAccount(s.draft.ledger, p.accountId)).toBe(true);
      for (const f of s.flows ?? []) {
        expect(isDrawn(f.from.ledger, f.from.account), `flow from ${f.from.account}`).toBe(true);
        expect(isDrawn(f.to.ledger, f.to.account), `flow to ${f.to.account}`).toBe(true);
      }
      for (const h of s.highlight ?? []) expect(isDrawn(h.ledger, h.account), `highlight ${h.account}`).toBe(true);
    }
  });

  it('every posted row on every step balances, with positive whole-dollar amounts', () => {
    for (const s of d.steps) {
      for (const rows of Object.values(s.posted)) {
        for (const r of rows) {
          expect(rowTotals(r).balanced, `${d.id} row ${r.id}`).toBe(true);
          for (const p of r.postings) {
            expect(p.amount).toBeGreaterThan(0);
            expect(p.amount % 100).toBe(0);
          }
        }
      }
    }
  });

  it('every balance sheet shown (before and now, every step) satisfies A = L + E', () => {
    for (const [i, s] of d.steps.entries()) {
      for (const l of d.ledgers) {
        expect(equationOf(l, []).balanced, `${l.id} opening`).toBe(true);
        const eq = equationOf(l, s.posted[l.id] ?? []);
        expect(eq.balanced, `${d.id} step ${i + 1} ${l.id}: ${JSON.stringify(eq)}`).toBe(true);
      }
    }
  });

  it('posted rows only accumulate, and drafts are a prefix of the row eventually posted', () => {
    for (let i = 1; i < d.steps.length; i++) {
      for (const l of d.ledgers) {
        const prev = d.steps[i - 1]!.posted[l.id] ?? [];
        const cur = d.steps[i]!.posted[l.id] ?? [];
        expect(cur.slice(0, prev.length)).toEqual(prev);
      }
    }
    for (const [i, s] of d.steps.entries()) {
      if (!s.draft) continue;
      const { ledger: lid, row } = s.draft;
      expect(s.posted[lid]?.some((r) => r.id === row.id), 'draft already posted').toBeFalsy();
      const final: TransactionRow | undefined = d.steps
        .slice(i + 1)
        .flatMap((x) => x.posted[lid] ?? [])
        .find((r) => r.id === row.id);
      expect(final, `draft ${row.id} is posted later`).toBeDefined();
      for (const p of row.postings) expect(final!.postings).toContainEqual(p);
    }
  });
});

describe('specific accounting outcomes', () => {
  it('cash-to-checking: cash 0, checking 100, net worth unchanged', () => {
    expect(balanceAt('cash-to-checking', -1, 'you', 'cash')).toBe(0);
    expect(balanceAt('cash-to-checking', -1, 'you', 'checking')).toBe(usd(100));
    expect(equationOf(ledger(def('cash-to-checking'), 'you'), def('cash-to-checking').steps.at(-1)!.posted.you!).assets).toBe(usd(100));
  });

  it('bank-view-deposit: vault cash 100, deposits 100, both sides grow', () => {
    const d = def('bank-view-deposit');
    const eq = equationOf(ledger(d, 'bank'), d.steps.at(-1)!.posted.bank!);
    expect(eq).toEqual({ assets: usd(1100), liabilities: usd(100), equity: usd(1000), balanced: true });
    expect(balanceAt('bank-view-deposit', -1, 'you', 'checking')).toBe(usd(100));
  });

  it('loan-creates-deposit: reserves never move; interest shifts $50 of equity', () => {
    const d = def('loan-creates-deposit');
    for (let i = 0; i < d.steps.length; i++) expect(balanceAt(d.id, i, 'bank', 'reserves-fed')).toBe(usd(1000));
    const afterLoan = d.steps.findIndex((s) => (s.posted.you ?? []).length === 1);
    expect(balanceAt(d.id, afterLoan, 'bank', 'deposits-checking')).toBe(usd(1100));
    expect(balanceAt(d.id, afterLoan, 'you', 'checking')).toBe(usd(1100));
    expect(balanceAt(d.id, -1, 'bank', 'loans-receivable')).toBe(0);
    expect(balanceAt(d.id, -1, 'you', 'loan-payable')).toBe(0);
    expect(balanceAt(d.id, -1, 'you', 'checking')).toBe(usd(50));
    expect(balanceAt(d.id, -1, 'bank', 'deposits-checking')).toBe(usd(50));
    expect(equationOf(ledger(d, 'you'), d.steps.at(-1)!.posted.you!).equity).toBe(usd(50));
    expect(equationOf(ledger(d, 'bank'), d.steps.at(-1)!.posted.bank!).equity).toBe(usd(950));
  });

  it('daily-accrual: receivable stacks to 30, then month-end clears it into savings', () => {
    const d = def('daily-accrual');
    const day30 = d.steps.findIndex((s) => (s.posted.coffee ?? []).some((r) => r.id === 'day-30'));
    expect(d.steps[day30]!.posted.coffee!.filter((r) => r.id.startsWith('day-'))).toHaveLength(30);
    expect(balanceAt(d.id, day30, 'coffee', 'interest-receivable')).toBe(usd(30));
    expect(balanceAt(d.id, -1, 'coffee', 'interest-receivable')).toBe(0);
    expect(balanceAt(d.id, -1, 'coffee', 'savings')).toBe(usd(3680));
    expect(balanceAt(d.id, -1, 'coffee', 'interest-income')).toBe(usd(30));
  });

  it('fbo-gross-up: P2P moves liabilities only; the bank sees nothing', () => {
    const d = def('fbo-gross-up');
    const bankRowsAtEnd = d.steps.at(-1)!.posted.bank!;
    const beforeP2p = d.steps.findIndex((s) => s.draft?.row.id === 'p2p');
    expect(d.steps[beforeP2p]!.posted.bank).toEqual(bankRowsAtEnd);
    expect(balanceAt(d.id, -1, 'zap', 'cash-fbo')).toBe(usd(100));
    expect(balanceAt(d.id, -1, 'zap', 'customer-balances-alice')).toBe(usd(80));
    expect(balanceAt(d.id, -1, 'zap', 'customer-balances-bob')).toBe(usd(20));
    expect(balanceAt(d.id, -1, 'bank', 'deposits-fbo')).toBe(usd(100));
    expect(balanceAt(d.id, -1, 'bank', 'reserves-fed')).toBe(usd(1100));
  });
});

describe('consistency with content CoAs', () => {
  it('shared You / Bank account ids have the same type as in content/entities', () => {
    for (const [coa, local] of [
      [you, YOU],
      [bank, BANK],
    ] as const) {
      for (const a of Object.values(local)) {
        const c = coa.accounts.find((x) => x.id === a.id);
        if (c) expect(c.type, `${coa.id}:${a.id}`).toBe(a.type);
      }
    }
  });
});
