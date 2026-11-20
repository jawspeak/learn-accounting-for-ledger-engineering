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

      // One scenario: the problem, with each entity's books.
      expect(board.scenarios).toHaveLength(1);
      for (const e of board.entities) {
        const ids = new Set(e.accounts.map((a) => a.id));
        const books = board.scenarios[0]!.books[e.id]!;
        for (const r of books.rows) {
          expect(engine.rowTotals(r).balanced).toBe(true);
          for (const q of r.postings) expect(ids.has(q.accountId)).toBe(true);
        }
        for (const l of books.opening?.lines ?? []) expect(ids.has(l.accountId)).toBe(true);
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
