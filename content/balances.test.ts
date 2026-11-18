import { describe, expect, it } from 'vitest';
import type { BookingProblem } from '@contracts';
import { engine } from '@engine';
import { entities, problems } from '@content';

/**
 * A worked solution should never leave an account below zero (shown as "(abnormal)" in the builder) just
 * because the problem forgot a starting balance — give the problem an `opening` instead.
 */
const bookings = Object.values(problems).filter((p): p is BookingProblem => p.kind === 'booking');

describe('booking solutions leave no account below zero', () => {
  it.each(bookings.map((p) => [p.id, p] as const))('%s', (_id, p) => {
    const ent = entities[p.entityId]!;
    const typeOf = (id: string) =>
      ent.accounts.find((a) => a.id === id)?.type ?? p.trapAccounts?.find((a) => a.id === id)?.type;
    const negative = engine
      .computeBalances(p.solution, typeOf, p.opening)
      .lines.filter((l) => l.amount < 0)
      .map((l) => `${l.accountId} ${l.amount / 100}`);
    expect(negative).toEqual([]);
  });
});
