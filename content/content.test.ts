/**
 * CI gate for all content (manager-owned). Every entity/section/problem must validate, ids must be unique and
 * resolvable, and every booking solution must pass the checker with zero diagnostics.
 */
import { describe, expect, it } from 'vitest';
import { schemas, type BookingProblem } from '@contracts';
import { engine } from '@engine';
import { entities, problems, sections } from '@content';

describe('content', () => {
  it('entities validate', () => {
    for (const e of Object.values(entities)) {
      const r = schemas.entitySchema.safeParse(e);
      expect(r.success, `${e.id}: ${JSON.stringify(r.error?.issues)}`).toBe(true);
      const ids = e.accounts.map((a) => a.id);
      expect(new Set(ids).size, `${e.id} duplicate account ids`).toBe(ids.length);
    }
  });

  it('sections validate and reference existing problems', () => {
    for (const s of sections) {
      const r = schemas.sectionSchema.safeParse(s);
      expect(r.success, `${s.id}: ${JSON.stringify(r.error?.issues)}`).toBe(true);
      for (const pid of s.problemIds) expect(problems[pid], `${s.id} -> ${pid}`).toBeDefined();
    }
  });

  for (const p of Object.values(problems)) {
    describe(p.id, () => {
      it('validates', () => {
        const r = schemas.problemSchema.safeParse(p);
        expect(r.success, JSON.stringify(r.error?.issues)).toBe(true);
      });
      if (p.kind === 'booking') {
        const bp = p as BookingProblem;
        it('references known entity and accounts', () => {
          const entity = entities[bp.entityId];
          expect(entity, `entity ${bp.entityId}`).toBeDefined();
          const known = new Set([...entity!.accounts.map((a) => a.id), ...(bp.trapAccounts ?? []).map((t) => t.id)]);
          for (const row of bp.solution) for (const post of row.postings) expect(known.has(post.accountId), post.accountId).toBe(true);
          for (const t of bp.trapAccounts ?? []) expect(entity!.accounts.some((a) => a.id === t.id), `trap ${t.id} collides`).toBe(false);
        });
        it('solution passes the checker with zero diagnostics', () => {
          const entity = entities[bp.entityId]!;
          const typeOf = (id: string) => entity.accounts.find((a) => a.id === id)?.type;
          const rows = bp.solution.map((r) => ({
            ...r,
            postings: r.postings.map((x) => ({ ...x, chosenType: typeOf(x.accountId) })),
          }));
          const res = engine.checkBooking(bp, entity, { rows });
          expect(res.diagnostics).toEqual([]);
          for (const r of bp.solution) expect(engine.rowTotals(r).balanced, `row ${r.id} balanced`).toBe(true);
        });
        if (bp.opening) {
          it('opening and closing balance sheets satisfy A = L + E', () => {
            const entity = entities[bp.entityId]!;
            const typeOf = (id: string) => entity.accounts.find((a) => a.id === id)?.type;
            expect(engine.checkEquation(bp.opening!, typeOf).balanced).toBe(true);
            expect(engine.checkEquation(engine.computeBalances(bp.solution, typeOf, bp.opening), typeOf).balanced).toBe(true);
          });
        }
      }
    });
  }
});
