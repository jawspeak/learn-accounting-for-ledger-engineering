import type { SectionModule } from '@contracts';

/** Owned by C1. Phase-0 includes one reference problem showing the expected shape. */
const mod: SectionModule = {
  section: {
    id: '03-t-accounts',
    number: 3,
    title: 'T-Accounts & Double Entry',
    summary: 'Book personal banking transactions with T-accounts.',
    primer: '_Coming soon._',
    problemIds: ['03-cash-to-checking'],
  },
  problems: [
    {
      id: '03-cash-to-checking',
      sectionId: '03-t-accounts',
      kind: 'booking',
      title: 'Deposit cash into checking',
      role: 'practice',
      difficulty: 1,
      entityId: 'you',
      prompt:
        'You have **$100 in cash**. You walk into your bank and deposit all of it into your **checking account**. Book this in **your** books.',
      hints: [
        'Whose books are we in? Yours — so only accounts *you* own (or owe) can appear.',
        'Which account are you sure changes? Your cash goes down. Cash is an Asset — what side decreases an Asset?',
        'Debits must equal credits. If Cash is credited $100, something must be debited $100. What did you get in exchange for the cash?',
      ],
      explanation:
        'Cash (Asset) decreases → **Cr Cash 100**. Checking (Asset) increases → **Dr Checking 100**. Both accounts are Assets, so total assets are unchanged — you just moved value from one asset to another. Your net worth did not change.',
      showBalanceSheets: true,
      opening: {
        lines: [
          { accountId: 'cash', amount: 10000 },
          { accountId: 'net-worth', amount: 10000 },
        ],
      },
      trapAccounts: [
        {
          id: 'customer-deposits',
          name: 'Customer Deposits',
          type: 'liability',
          trap: {
            kind: 'counterparty',
            explanation:
              "**Customer Deposits** is an account in the **bank's** books — it's what the bank owes you. In *your* books, the money in the bank is your asset: **Checking Account**.",
          },
        },
      ],
      perspectivePairId: '04-bank-cash-deposit',
      solution: [
        {
          id: 't1',
          label: 'Deposit cash',
          postings: [
            { accountId: 'checking', side: 'dr', amount: 10000 },
            { accountId: 'cash', side: 'cr', amount: 10000 },
          ],
        },
      ],
    },
  ],
};
export default mod;
