/** Sandbox boards built from booking problems: the learner's attempt, or the authored solution (+ the other side). */
import type {
  Account,
  BookingProblem,
  SandboxEntity,
  SandboxState,
  TransactionRow,
} from '@contracts';
import { engine } from '@engine';
import { entities, problems } from '@content';

/** Fill chosenType on authored rows so the builder can show them. */
export function withTypes(rows: TransactionRow[], accounts: Account[]): TransactionRow[] {
  return rows.map((r) => ({
    ...r,
    postings: r.postings.map((p) => ({
      ...p,
      chosenType: p.chosenType ?? accounts.find((a) => a.id === p.accountId)?.type,
    })),
  }));
}

/** One problem's books as a sandbox entity: only the accounts in play (rows + opening), so links stay short. */
export function sandboxEntity(
  problem: BookingProblem,
  accounts: Account[],
  rows: TransactionRow[],
): SandboxEntity {
  const used = new Set<string>();
  rows.forEach((r) => r.postings.forEach((p) => used.add(p.accountId)));
  problem.opening?.lines.forEach((l) => used.add(l.accountId));
  const entity = entities[problem.entityId];
  // Picker lists are alphabetical; boards read better in chart-of-accounts order (cash first), traps last.
  const coaIndex = new Map((entity?.accounts ?? []).map((a, i) => [a.id, i]));
  const rank = (id: string) => coaIndex.get(id) ?? Number.MAX_SAFE_INTEGER;
  // Accounts in play may be outside a restricted picker list (e.g. Net Worth in an opening balance): take them
  // from the entity's full chart of accounts so the board never has a balance for an unknown account.
  const pool = [...accounts, ...(entity?.accounts ?? []).filter((a) => !accounts.some((x) => x.id === a.id))];
  const chosen = pool.filter((a) => used.has(a.id)).sort((a, b) => rank(a.id) - rank(b.id));
  return {
    id: problem.entityId,
    name: entity?.name ?? problem.entityId,
    accounts: (chosen.length > 0 ? chosen : accounts).map(
      ({ id, name, type, contraOf, equityGroup }) => {
        const a: Account = { id, name, type };
        if (contraOf) a.contraOf = contraOf;
        if (equityGroup) a.equityGroup = equityGroup;
        return a;
      },
    ),
    rows,
    opening: problem.opening,
    showBalanceSheets: problem.showBalanceSheets,
  };
}

/** The authored solution of a booking problem, typed so the builder can show it. */
export function solvedRows(problem: BookingProblem): TransactionRow[] {
  const entity = entities[problem.entityId];
  return entity
    ? withTypes(problem.solution, engine.pickerAccounts(problem, entity))
    : problem.solution;
}

/**
 * A sandbox board for `rows` in this problem's books. With `withPair`, the other-side problem's authored solution
 * is added as a second set of books (when it's a booking problem in different books), so both sides open together.
 */
export function boardFor(
  problem: BookingProblem,
  accounts: Account[],
  rows: TransactionRow[],
  withPair: boolean,
): SandboxState {
  const books = [sandboxEntity(problem, accounts, rows)];
  const pair =
    withPair && problem.perspectivePairId ? problems[problem.perspectivePairId] : undefined;
  if (pair?.kind === 'booking' && pair.entityId !== problem.entityId && entities[pair.entityId])
    books.push(
      sandboxEntity(pair, engine.pickerAccounts(pair, entities[pair.entityId]!), solvedRows(pair)),
    );
  return {
    v: 1,
    title: withPair ? `${problem.title} — solution` : problem.title,
    scenario: problem.prompt,
    entities: books,
  };
}
