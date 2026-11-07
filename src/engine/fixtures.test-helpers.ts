/** Inline fixtures shared by engine tests (not content — keeps engine tests independent of authored sections). */
import type { AccountType, BookingProblem, EntityCoA, Posting, Side, TransactionRow } from '@contracts';

export const co: EntityCoA = {
  id: 'co',
  name: 'Test Co.',
  kind: 'company',
  basis: 'accrual',
  accounts: [
    { id: 'cash', name: 'Cash', type: 'asset' },
    { id: 'bank', name: 'Bank Account', type: 'asset' },
    { id: 'clearing', name: 'Clearing', type: 'asset' },
    { id: 'ar', name: 'Accounts Receivable', type: 'asset' },
    { id: 'equipment', name: 'Equipment', type: 'asset' },
    { id: 'accum-dep', name: 'Accumulated Depreciation', type: 'contra-asset', contraOf: 'equipment' },
    { id: 'ap', name: 'Accounts Payable', type: 'liability' },
    { id: 'loan', name: 'Loan Payable', type: 'liability' },
    { id: 'capital', name: 'Paid-in Capital', type: 'equity', equityGroup: 'paid-in' },
    { id: 're', name: 'Retained Earnings', type: 'equity', equityGroup: 'retained' },
    { id: 'sales', name: 'Sales Revenue', type: 'revenue' },
    { id: 'rent', name: 'Rent Expense', type: 'expense' },
  ],
};

export const typeOf = (id: string): AccountType | undefined => co.accounts.find((a) => a.id === id)?.type;

/** Posting shorthand: p('cash', 'dr', 100) — amount in whole dollars; chosenType defaults to the real type. */
export const p = (accountId: string, side: Side, dollars: number, chosenType?: AccountType): Posting => ({
  accountId,
  side,
  amount: dollars * 100,
  chosenType: chosenType ?? typeOf(accountId) ?? 'liability',
});

export const row = (id: string, ...postings: Posting[]): TransactionRow => ({ id, postings });

/** Two-event problem: owner invests $1,000 cash; buy equipment $400 on credit. */
export const twoEvents: BookingProblem = {
  id: '99-two-events',
  sectionId: '07-revenue-expenses',
  kind: 'booking',
  title: 'Two events',
  role: 'practice',
  difficulty: 1,
  prompt: 'x',
  hints: [],
  explanation: 'x',
  entityId: 'co',
  showBalanceSheets: true,
  askAfterBalanceSheet: true,
  opening: { lines: [] },
  trapAccounts: [
    {
      id: 'customer-deposits',
      name: 'Customer Deposits',
      type: 'liability',
      trap: { kind: 'counterparty', explanation: 'COUNTERPARTY EXPL' },
    },
    {
      id: 'owner-cash',
      name: 'Owner Cash',
      type: 'asset',
      trap: { kind: 'near-synonym', explanation: 'NEAR SYNONYM EXPL' },
    },
  ],
  solution: [
    { id: 's1', postings: [{ accountId: 'cash', side: 'dr', amount: 100000 }, { accountId: 'capital', side: 'cr', amount: 100000 }] },
    { id: 's2', postings: [{ accountId: 'equipment', side: 'dr', amount: 40000 }, { accountId: 'ap', side: 'cr', amount: 40000 }] },
  ],
};

/** Learner answer that exactly matches `twoEvents`. */
export const twoEventsCorrect = (): TransactionRow[] => [
  row('r1', p('cash', 'dr', 1000), p('capital', 'cr', 1000)),
  row('r2', p('equipment', 'dr', 400), p('ap', 'cr', 400)),
];

/** One-event problem: move $100 from cash to the bank. */
export const deposit: BookingProblem = {
  ...twoEvents,
  id: '99-deposit',
  askAfterBalanceSheet: false,
  opening: { lines: [{ accountId: 'cash', amount: 10000 }, { accountId: 'capital', amount: 10000 }] },
  solution: [{ id: 's1', postings: [{ accountId: 'bank', side: 'dr', amount: 10000 }, { accountId: 'cash', side: 'cr', amount: 10000 }] }],
};
