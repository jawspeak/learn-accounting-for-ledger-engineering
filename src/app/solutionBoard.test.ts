import { describe, expect, it } from 'vitest';
import type { BookingProblem } from '@contracts';
import { engine } from '@engine';
import { entities, problems } from '@content';
import { boardFor, solvedRows } from './solutionBoard';

const bookings = Object.values(problems).filter((p): p is BookingProblem => p.kind === 'booking');

describe('solution boards (Open solution in Sandbox / Spreadsheet)', () => {
  it.each(bookings.map((p) => [p.id, p] as const))(
    '%s: solution link decodes, balances, includes the other side',
    (_id, p) => {
      const accounts = engine.pickerAccounts(p, entities[p.entityId]!);
      const board = boardFor(p, accounts, solvedRows(p), true);

      // A link that fails the schema would silently open an empty board.
      expect(engine.decodeSandbox(engine.encodeState(board))).toEqual(board);

      // One scenario: the problem, its events, and each entity's entry for each (or "no entry").
      expect(board.scenarios).toHaveLength(1);
      const sc = board.scenarios[0]!;
      for (const e of board.entities) {
        const ids = new Set(e.accounts.map((a) => a.id));
        for (const ev of sc.events) {
          const lines = ev.lines[e.id];
          if (!lines) {
            expect(ev.none).toContain(e.id);
            continue;
          }
          expect(engine.rowTotals({ id: ev.id, postings: lines }).balanced).toBe(true);
          for (const q of lines) expect(ids.has(q.accountId)).toBe(true);
        }
        for (const l of sc.opening[e.id]?.lines ?? []) expect(ids.has(l.accountId)).toBe(true);
      }

      const pair = p.perspectivePairId ? problems[p.perspectivePairId] : undefined;
      const twoSided = pair?.kind === 'booking' && pair.entityId !== p.entityId;
      expect(board.entities.map((e) => e.id)).toEqual(
        twoSided ? [p.entityId, pair.entityId] : [p.entityId],
      );
    },
  );

  it('without the pair, the board is just this problem’s books', () => {
    const p = problems['03-cash-to-checking'] as BookingProblem;
    const board = boardFor(p, engine.pickerAccounts(p, entities.you!), [], false);
    expect(board.entities).toHaveLength(1);
    expect(board.title).toBe(p.title);
  });
});
