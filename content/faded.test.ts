import { describe, expect, it } from 'vitest';
import type { BookingProblem } from '@contracts';
import { problems } from '@content';

/**
 * Faded examples lock their prefilled postings (only those cells; the rest of the row stays editable).
 * That's only solvable if each locked posting is exactly what the solution has in the same row.
 */
const faded = Object.values(problems).filter(
  (p): p is BookingProblem => p.kind === 'booking' && !!p.prefill?.locked,
);

describe('faded examples are solvable around their locked cells', () => {
  it('there are some', () => expect(faded.length).toBeGreaterThan(0));
  it.each(faded.map((p) => [p.id, p] as const))('%s', (_id, p) => {
    p.prefill!.rows.forEach((row, i) => {
      const sol = p.solution[i];
      expect(sol, `solution row ${i + 1}`).toBeDefined();
      for (const posting of row.postings)
        expect(sol!.postings).toContainEqual(
          expect.objectContaining({
            accountId: posting.accountId,
            side: posting.side,
            amount: posting.amount,
          }),
        );
    });
  });
});
