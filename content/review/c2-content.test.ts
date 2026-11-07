/**
 * Extra consistency checks for C2-owned content (sections 07–12 + Mixed Review), on top of the CI gate.
 * Catches things the gate would silently ignore (unknown ids in opening balances, statement answers that
 * don't match their rows, prefills that don't match the solution, inconsistent equation items...).
 */
import { describe, expect, it } from 'vitest';
import type { BalanceSheet, BookingProblem, EntityCoA, Problem, TransactionRow } from '@contracts';
import { engine } from '@engine';
import { entities, problems, sections } from '@content';

const MINE = new Set(['07-revenue-expenses', '08-accruals', '09-contra', '10-processes', '11-fintech', '12-capstone', 'review']);
const mine = Object.values(problems).filter((p) => MINE.has(p.sectionId));

const known = (e: EntityCoA, p?: BookingProblem) => new Set([...e.accounts.map((a) => a.id), ...(p?.trapAccounts ?? []).map((t) => t.id)]);
const typeOf = (e: EntityCoA) => (id: string) => e.accounts.find((a) => a.id === id)?.type;
const nonZero = (bs: BalanceSheet) => bs.lines.filter((l) => l.amount !== 0);
const sortLines = <T extends { accountId: string }>(xs: T[]) => [...xs].sort((a, b) => a.accountId.localeCompare(b.accountId));
const rowIdsOk = (rows: TransactionRow[]) => new Set(rows.map((r) => r.id)).size === rows.length;

describe('C2 sections', () => {
  it('every C2 section has primer, lens and ≥7 problems (review: 10–15)', () => {
    for (const s of sections.filter((x) => MINE.has(x.id))) {
      expect(s.primer.length, s.id).toBeGreaterThan(200);
      expect(s.lens, s.id).toBeTruthy();
      if (s.id === 'review') {
        expect(s.problemIds.length).toBeGreaterThanOrEqual(10);
        expect(s.problemIds.length).toBeLessThanOrEqual(15);
      } else {
        expect(s.problemIds.length, s.id).toBeGreaterThanOrEqual(7);
        const roles = s.problemIds.map((id) => problems[id]!.role);
        expect(roles[0], `${s.id} starts with worked`).toBe('worked');
        expect(roles[1], `${s.id} second is faded`).toBe('faded');
        expect(roles.filter((r) => r === 'review').length, `${s.id} review count`).toBeGreaterThanOrEqual(1);
      }
      for (const id of s.problemIds) expect(problems[id]!.sectionId, id).toBe(s.id);
    }
  });
});

describe('C2 problems', () => {
  for (const p of mine as Problem[]) {
    it(`${p.id} is internally consistent`, () => {
      if (p.role === 'worked') expect(p.walkthrough?.length, 'walkthrough').toBeGreaterThan(0);
      if (p.perspectivePairId) expect(problems[p.perspectivePairId], 'pair exists').toBeDefined();
      if (p.kind === 'booking') {
        const e = entities[p.entityId]!;
        const k = known(e, p);
        expect(p.hints.length).toBeGreaterThanOrEqual(2);
        expect(p.hints.length).toBeLessThanOrEqual(4);
        expect(p.trapAccounts?.length ?? 0).toBeGreaterThanOrEqual(2);
        expect(p.trapAccounts?.length ?? 0).toBeLessThanOrEqual(4);
        expect(p.accountChoiceIds).toBeUndefined();
        for (const t of p.trapAccounts ?? []) {
          expect(e.accounts.some((a) => a.name.toLowerCase() === t.name.toLowerCase()), `trap name ${t.name} duplicates CoA`).toBe(false);
          for (const row of p.solution) for (const x of row.postings) expect(x.accountId, 'solution uses trap').not.toBe(t.id);
        }
        for (const l of p.opening?.lines ?? []) expect(k.has(l.accountId), `opening ${l.accountId}`).toBe(true);
        for (const l of p.opening?.lines ?? []) expect(l.amount % 100, 'whole dollars').toBe(0);
        for (const r of p.solution) for (const x of r.postings) expect(x.amount % 100, 'whole dollars').toBe(0);
        expect(rowIdsOk(p.solution)).toBe(true);
        if (p.showBalanceSheets) expect(p.opening, 'BS problems need opening').toBeDefined();
        if (p.role === 'faded') expect(p.prefill?.locked, 'faded is locked').toBe(true);
        if (p.prefill) {
          for (const r of p.prefill.rows) for (const x of r.postings) expect(k.has(x.accountId), `prefill ${x.accountId}`).toBe(true);
          if (p.prefill.locked) {
            expect(p.prefill.rows.length).toBeLessThan(p.solution.length);
            p.prefill.rows.forEach((r, i) => expect(r).toEqual(p.solution[i]));
          } else {
            expect(p.prefill.rows).not.toEqual(p.solution);
          }
        }
        // Closing balances: no account goes abnormal (negative), except where explicitly allowed.
        const after = engine.computeBalances(p.solution, typeOf(e), p.opening);
        if (p.opening) for (const l of after.lines) expect(l.amount, `${l.accountId} closing balance negative`).toBeGreaterThanOrEqual(0);
      }
      if (p.kind === 'statement-fill') {
        const e = entities[p.entityId]!;
        const k = known(e);
        for (const r of p.rows) {
          expect(engine.rowTotals(r).balanced, `row ${r.id}`).toBe(true);
          for (const x of r.postings) expect(k.has(x.accountId), x.accountId).toBe(true);
        }
        if (p.opening) expect(engine.checkEquation(p.opening, typeOf(e)).balanced, 'opening A=L+E').toBe(true);
        const after = engine.computeBalances(p.rows, typeOf(e), p.opening);
        if (p.statement === 'balance-sheet') {
          expect(sortLines(p.answer.balanceSheet!.lines)).toEqual(sortLines(nonZero(after)));
        } else if (p.statement === 'income-statement') {
          const isTypes = new Set(['revenue', 'contra-revenue', 'expense']);
          const expected = nonZero(after).filter((l) => isTypes.has(typeOf(e)(l.accountId)!));
          expect(sortLines(p.answer.balanceSheet!.lines)).toEqual(sortLines(expected));
        } else {
          const tb = engine.trialBalance(p.rows, typeOf(e), p.opening).filter((l) => l.amount !== 0);
          expect(sortLines(p.answer.trialBalance!)).toEqual(sortLines(tb));
          const dr = tb.filter((l) => l.side === 'dr').reduce((s, l) => s + l.amount, 0);
          const cr = tb.filter((l) => l.side === 'cr').reduce((s, l) => s + l.amount, 0);
          expect(dr).toBe(cr);
        }
      }
      if (p.kind === 'multiple-choice') {
        const n = p.options.filter((o) => o.correct).length;
        expect(n).toBeGreaterThanOrEqual(1);
        if (!p.multi) expect(n).toBe(1);
      }
      if (p.kind === 'equation-fill') {
        for (const it of p.items) {
          const blanks = [it.assets, it.liabilities, it.equity].filter((x) => x === null).length;
          expect(blanks).toBe(1);
        }
      }
    });
  }
});
