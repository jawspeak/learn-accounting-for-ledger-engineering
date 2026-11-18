import type { BalanceSheet, Posting, SectionModule, TransactionRow } from '@contracts';

/** Owned by C2. Amounts below are written in whole dollars and converted to cents. */
const usd = (d: number) => d * 100;
const dr = (accountId: string, d: number): Posting => ({ accountId, side: 'dr', amount: usd(d) });
const cr = (accountId: string, d: number): Posting => ({ accountId, side: 'cr', amount: usd(d) });
const row = (id: string, label: string, ...postings: Posting[]): TransactionRow => ({ id, label, postings });
const bs = (o: Record<string, number>): BalanceSheet => ({
  lines: Object.entries(o).map(([accountId, d]) => ({ accountId, amount: usd(d) })),
});

// ---- Bean There's December, used across this section ----
const dec1 = {
  cash: 8000,
  savings: 3650,
  'accounts-receivable': 600,
  'allowance-doubtful': 30,
  inventory: 1200,
  'prepaid-rent': 3000,
  equipment: 12000,
  'accum-depreciation': 2400,
  'accounts-payable': 900,
  'unearned-gift-cards': 300,
  'paid-in-capital': 20000,
  'retained-earnings': 4820,
};

const r1 = row('t1', 'Dec 1: pay November supplier bill', dr('accounts-payable', 900), cr('cash', 900));
const r2 = row('t2', 'Dec 3: beans on credit', dr('inventory', 1400), cr('accounts-payable', 1400));
const r3 = row('t3', 'Dec 1–31: cash sales', dr('cash', 3000), cr('sales-revenue', 3000));
const r4 = row('t4', 'Dec 1–31: card sales', dr('card-receivable', 2000), cr('sales-revenue', 2000));
const r5 = row('t5', 'Card settlements, net of 3% fee', dr('cash', 1940), dr('card-fees', 60), cr('card-receivable', 2000));
const r6 = row('t6', 'Gift cards redeemed', dr('unearned-gift-cards', 100), cr('sales-revenue', 100));
const r7 = row('t7', 'Catering client pays invoice', dr('cash', 400), cr('accounts-receivable', 400));
const r8 = row('t8', 'Pay baristas (Dec 1–24)', dr('wages-expense', 1800), cr('cash', 1800));
const r9 = row('t9', 'Electricity bill, due Jan 15', dr('utilities-expense', 250), cr('accounts-payable', 250));
const a1 = row('t10', 'December rent from prepaid', dr('rent-expense', 1500), cr('prepaid-rent', 1500));
const a2 = row('t11', 'December depreciation', dr('depreciation-expense', 200), cr('accum-depreciation', 200));
const a3 = row('t12', 'Accrue wages Dec 25–31', dr('wages-expense', 700), cr('wages-payable', 700));
const a4 = row('t13', 'Month-end count: beans & supplies used', dr('cogs', 1600), cr('inventory', 1600));

const afterR6 = {
  cash: 12040,
  savings: 3650,
  'accounts-receivable': 600,
  'allowance-doubtful': 30,
  inventory: 2600,
  'prepaid-rent': 3000,
  equipment: 12000,
  'accum-depreciation': 2400,
  'accounts-payable': 1400,
  'unearned-gift-cards': 200,
  'paid-in-capital': 20000,
  'retained-earnings': 4820,
  'sales-revenue': 5100,
  'card-fees': 60,
};
const afterR9 = {
  ...afterR6,
  cash: 10640,
  'accounts-receivable': 200,
  'accounts-payable': 1650,
  'wages-expense': 1800,
  'utilities-expense': 250,
};

const tb = (side: 'dr' | 'cr', accountId: string, d: number) => ({ accountId, side, amount: usd(d) });

const decemberTable = `
| # | Event |
|---|---|
| 1 | Dec 1: pay November’s supplier bill, $900 |
| 2 | Dec 3: buy $1,400 of beans on 30-day credit |
| 3 | December cash sales, $3,000 |
| 4 | December card sales, $2,000 |
| 5 | Processor settles all card sales: $1,940 deposited, $60 fee kept |
| 6 | Customers redeem $100 of gift cards |
| 7 | A catering client pays a $400 invoice |
| 8 | Baristas paid $1,800 for Dec 1–24 |
| 9 | Electricity bill for December, $250, due Jan 15 |
| 10 | Month-end: December’s rent ($1,500) comes out of Prepaid Rent |
| 11 | Month-end: depreciation, $200 |
| 12 | Month-end: baristas earned $700 for Dec 25–31, paid in January |
| 13 | Month-end count: $1,000 of beans & supplies left on the shelf |
`;

const primer = `
Real bookkeeping is a **cycle** that repeats every period:

1. **Events happen** — sales, purchases, payments.
2. **Journalize** — one balanced entry per event.
3. **Post** to the ledger — each account accumulates its postings.
4. **Trial balance** — list every account’s balance in a Dr or Cr column; the two totals must match.
5. **Adjust** — month-end accruals, deferrals, depreciation, inventory count.
6. **Statements** — income statement and balance sheet from the adjusted balances.
7. **Close** — revenue, expenses and dividends into Retained Earnings.

A **trial balance** (TB) is the cheap sanity check in step 4. Since every entry has Dr = Cr, the sum of all debit balances must equal the sum of all credit balances. If it doesn’t, an entry was mis-posted.

But a balanced TB does **not** mean the books are right. It can’t catch an entry posted to the *wrong account on the correct side*, an entry *left out entirely*, or an entry with the *same wrong amount on both sides*.

Two classic tricks for an unbalanced TB:
- Difference **divisible by 9** → suspect a transposed amount (540 vs 450 → off by 90).
- Difference that is **twice** some amount → suspect that amount was posted on the wrong side.

This section walks Bean There through all of December — the same 13 events across several problems, so the rows **accumulate** (to keep December short, we ignore interest on the savings account this month):
${decemberTable}
`;

const lens = `
**Ledger-engineer's lens: the trial balance is an invariant**

- In a double-entry database that **rejects any transaction where ΣDr ≠ ΣCr**, the trial balance balances *by construction*. Run it anyway, as a continuous invariant check: if it ever fails, you have data corruption or a bug that bypassed validation — page someone.
- What it can’t catch is *semantic* error — the right amount in the wrong account. That’s what **reconciliations** are for: compare a GL account to an independent source (bank statement, processor report, sub-ledger totals).
- Never fix a posted entry by editing it. Post a **reversal** (the mirror image) and then the **correct** entry. The audit trail shows what was wrong, when, and who fixed it. (In the find-the-error problem below you edit *draft* rows — before posting, that’s fine.)
- The month-end adjustments are scheduled jobs that run *after* the period’s operational events, often with a different effective date than created-at date. Store both.
`;

const callouts = [
  {
    title: 'Trial balance vs. balance sheet',
    body: `The TB lists **every** account — including revenue, expense and dividend accounts — in two columns, Dr and Cr. The balance sheet groups the permanent accounts into A = L + E and rolls revenue/expenses into equity (after closing, into Retained Earnings). Contra accounts appear on the TB on their own normal side (e.g. Accumulated Depreciation in the Cr column).`,
  },
];

const decemberTraps = [
  {
    id: 'sales-receivable',
    name: 'Sales Receivable',
    type: 'asset' as const,
    trap: {
      kind: 'near-synonym' as const,
      explanation: 'Card sales waiting for settlement go to **Card Receivables (Cash in Transit)** in Bean There’s chart of accounts.',
    },
  },
  {
    id: 'gift-card-revenue-10',
    name: 'Gift Card Revenue',
    type: 'revenue' as const,
    trap: {
      kind: 'near-synonym' as const,
      explanation: 'Redeemed gift cards become ordinary **Sales Revenue**; the liability **Unearned Revenue – Gift Cards** goes down.',
    },
  },
];

const mod: SectionModule = {
  section: {
    id: '10-processes',
    number: 10,
    title: 'Business Processes & Trial Balance',
    summary: 'A full month at Bean There, the trial balance, and finding errors.',
    primer,
    lens,
    callouts,
    problemIds: [
      '10-december-start',
      '10-december-sales',
      '10-december-midmonth',
      '10-december-adjustments',
      '10-december-trial-balance',
      '10-find-the-error',
      '10-mc-tb-limits',
      '10-rv-gift-card-by-card',
      '10-rv-grinder-contribution',
    ],
  },
  problems: [
    {
      id: '10-december-start',
      sectionId: '10-processes',
      kind: 'booking',
      title: 'December, part 1: the first three events',
      role: 'worked',
      difficulty: 2,
      entityId: 'coffee',
      prompt:
        'December begins at Bean There (opening balances shown). Book events **1–3** from the December list, one row each:\n\n1. Dec 1: pay November’s supplier bill, **$900**\n2. Dec 3: buy **$1,400** of beans on 30-day credit\n3. December cash sales, **$3,000**',
      hints: [
        'For each row, find the account you’re sure about first: cash, inventory, cash.',
        'Paying a bill settles a liability — is there any expense?',
        'Buying beans goes to Inventory; the expense comes at the month-end count.',
      ],
      walkthrough: [
        '**Row 1 — start from Cash.** Cash leaves → Cr Cash 900. What did the payment do? It wiped out what Bean There owed → Dr Accounts Payable 900. No expense: the beans were recorded when they arrived in November.',
        '**Row 2 — start from Inventory.** Beans arrive → Dr Inventory 1,400. Nothing paid yet → Cr Accounts Payable 1,400.',
        '**Row 3 — start from Cash.** Cash comes in → Dr Cash 3,000. Earned by selling coffee → Cr Sales Revenue 3,000.',
        'Check the running balances: Cash 8,000 − 900 + 3,000 = 10,100. Accounts Payable 900 − 900 + 1,400 = 1,400. Every row balances, so A = L + E still holds.',
      ],
      explanation:
        '1. **Dr Accounts Payable 900 / Cr Cash 900** — settle a liability.\n2. **Dr Inventory 1,400 / Cr Accounts Payable 1,400** — asset in, liability up.\n3. **Dr Cash 3,000 / Cr Sales Revenue 3,000** — revenue earned.\n\nOnly row 3 touches the income statement. Rows 1 and 2 are balance-sheet-only.',
      showBalanceSheets: true,
      journalView: true,
      opening: bs(dec1),
      trapAccounts: [
        {
          id: 'purchases-expense-10',
          name: 'Purchases Expense',
          type: 'expense',
          trap: {
            kind: 'near-synonym',
            explanation: 'Bean There puts purchases into **Inventory** and expenses them as COGS at the month-end count.',
          },
        },
        {
          id: 'roastery-receivable-10',
          name: 'Receivable from Bean There',
          type: 'asset',
          trap: { kind: 'counterparty', explanation: 'That’s the **supplier’s** asset. Bean There owes the money: **Accounts Payable**.' },
        },
      ],
      diagnosticExplanations: {
        EXTRA_ACCOUNT: 'Paying a bill and buying inventory are balance-sheet-only events — no expense yet.',
        WRONG_ROW: 'Keep the events in the listed order: one event per row.',
      },
      solution: [r1, r2, r3],
    },
    {
      id: '10-december-sales',
      sectionId: '10-processes',
      kind: 'booking',
      title: 'December, part 2: cards and gift cards',
      role: 'faded',
      difficulty: 2,
      entityId: 'coffee',
      prompt:
        'Rows 1–3 (events 1–3) are already booked. Continue with:\n\n4. December card sales, **$2,000**\n5. The processor settles all of them: **$1,940** deposited, **$60** fee kept\n6. Customers redeem **$100** of gift cards',
      hints: [
        'Row 4: revenue is earned now, but the cash is in transit.',
        'Row 5: one compound row clears the full receivable.',
        'Row 6: no cash moves. What obligation shrinks, and what is earned?',
      ],
      explanation:
        '4. **Dr Card Receivables 2,000 / Cr Sales Revenue 2,000.**\n5. **Dr Cash 1,940, Dr Card Processing Fees 60 / Cr Card Receivables 2,000.**\n6. **Dr Unearned Revenue – Gift Cards 100 / Cr Sales Revenue 100.**\n\nAfter row 6, December sales are 3,000 + 2,000 + 100 = **5,100**, and Card Receivables is back to zero.',
      showBalanceSheets: true,
      journalView: true,
      opening: bs(dec1),
      prefill: { locked: true, rows: [r1, r2, r3] },
      trapAccounts: decemberTraps,
      diagnosticExplanations: {
        WRONG_AMOUNT: 'Row 5: credit the full 2,000 to Card Receivables; 1,940 is cash and 60 is the fee.',
        EXTRA_ACCOUNT: 'Gift card redemptions move no cash — the cash came in when the cards were sold.',
        SPLIT_ENTRY: 'The settlement is a single deposit: one compound row.',
      },
      solution: [r1, r2, r3, r4, r5, r6],
    },
    {
      id: '10-december-midmonth',
      sectionId: '10-processes',
      kind: 'booking',
      title: 'December, part 3: collections, payroll, bills',
      role: 'practice',
      difficulty: 2,
      entityId: 'coffee',
      prompt:
        'The opening balances now include events 1–6. Book:\n\n7. A catering client pays a **$400** invoice\n8. Baristas are paid **$1,800** for Dec 1–24\n9. The **$250** electricity bill for December arrives, due Jan 15',
      hints: [
        'Row 7: the revenue was recorded when the catering was delivered. What does collecting change?',
        'Row 8: work done and paid in the same month — straightforward expense.',
        'Row 9: December used the electricity. Which month bears the expense — and what do you owe?',
      ],
      explanation:
        '7. **Dr Cash 400 / Cr Accounts Receivable 400** — collection, no revenue.\n8. **Dr Wages Expense 1,800 / Cr Cash 1,800.**\n9. **Dr Utilities Expense 250 / Cr Accounts Payable 250** — December’s electricity is December’s expense even though it’s paid in January.',
      showBalanceSheets: true,
      journalView: true,
      opening: bs(afterR6),
      trapAccounts: [
        {
          id: 'utilities-prepaid',
          name: 'Prepaid Utilities',
          type: 'asset',
          trap: { kind: 'near-synonym', explanation: 'Nothing was paid in advance. The electricity was used first and will be paid later → **Accounts Payable**.' },
        },
        {
          id: 'catering-revenue-10',
          name: 'Catering Revenue Collected',
          type: 'revenue',
          trap: {
            kind: 'other',
            explanation: 'The revenue was recognized when the catering was delivered. Collecting the invoice only converts Accounts Receivable into Cash.',
          },
        },
      ],
      diagnosticExplanations: {
        EXTRA_ACCOUNT: 'Row 7 creates no revenue (it was recognized at delivery). Row 9 moves no cash yet.',
        MISSING_ACCOUNT: 'Row 9: the bill is unpaid, so the credit goes to **Accounts Payable**.',
      },
      solution: [r7, r8, r9].map((r, i) => ({ ...r, id: `t${i + 1}` })),
    },
    {
      id: '10-december-adjustments',
      sectionId: '10-processes',
      kind: 'booking',
      title: 'December, part 4: month-end adjustments',
      role: 'practice',
      difficulty: 3,
      entityId: 'coffee',
      prompt:
        'All of December’s operational events (1–9) are in the opening balances. Now book the **month-end adjustments**, one row each:\n\n10. December’s rent ($1,500) comes out of Prepaid Rent\n11. Depreciation on the espresso machine, $200\n12. Baristas earned **$700** for Dec 25–31, to be paid in January\n13. The month-end count finds **$1,000** of beans & supplies left\n\n(To keep December short, we ignore interest on the savings account this month.)',
      hints: [
        'None of these four rows touch Cash. Why not?',
        'Row 13: Inventory is $2,600 on the books, but only $1,000 is on the shelf. Where did the rest go?',
        'Each row moves an amount from a balance-sheet account into an expense (or creates a liability for one).',
      ],
      explanation:
        '10. **Dr Rent Expense 1,500 / Cr Prepaid Rent 1,500** — deferral used up.\n11. **Dr Depreciation Expense 200 / Cr Accumulated Depreciation 200** — contra-asset grows.\n12. **Dr Wages Expense 700 / Cr Wages Payable 700** — accrued expense.\n13. **Dr Cost of Goods Sold 1,600 / Cr Inventory 1,600** — 2,600 on the books − 1,000 counted = 1,600 used.\n\nAdjustments never involve cash: they fix *timing*, moving amounts between the balance sheet and the income statement so December shows what it really earned and used.',
      showBalanceSheets: true,
      journalView: true,
      opening: bs(afterR9),
      trapAccounts: [
        {
          id: 'inventory-shrinkage',
          name: 'Inventory Count Adjustment Revenue',
          type: 'revenue',
          trap: { kind: 'other', explanation: 'Beans used up are a cost, not revenue: **Cost of Goods Sold**.' },
        },
        {
          id: 'wages-receivable-10',
          name: 'Wages Receivable',
          type: 'asset',
          trap: { kind: 'counterparty', explanation: 'From the baristas’ point of view they’re owed wages; in Bean There’s books it’s **Wages Payable**.' },
        },
        {
          id: 'depreciation-payable-10',
          name: 'Depreciation Payable',
          type: 'liability',
          trap: { kind: 'other', explanation: 'Nobody is owed depreciation. Credit the contra-asset **Accumulated Depreciation – Equipment**.' },
        },
      ],
      diagnosticExplanations: {
        WRONG_AMOUNT:
          'Row 13: COGS is what was *used*: book inventory 2,600 − counted 1,000 = **1,600**. (Not the 1,000 that’s left.)',
        EXTRA_ACCOUNT: 'Month-end adjustments don’t move cash.',
      },
      solution: [a1, a2, a3, a4].map((r, i) => ({ ...r, id: `t${i + 1}` })),
    },
    {
      id: '10-december-trial-balance',
      sectionId: '10-processes',
      kind: 'statement-fill',
      title: 'December trial balance',
      role: 'practice',
      difficulty: 3,
      entityId: 'coffee',
      statement: 'trial-balance',
      prompt:
        'Here are all 13 of December’s entries, starting from the Dec 1 balances. Produce Bean There’s **adjusted trial balance** at Dec 31: every account with a non-zero balance, its amount, and whether it sits in the **Dr** or **Cr** column. Then check the totals match.',
      hints: [
        'Start each account from its Dec 1 balance and apply the rows that touch it.',
        'Each account’s balance goes in the column of its normal side — contra accounts included (Allowance and Accumulated Depreciation are Cr).',
        'Card Receivables ends at zero — leave it out. Both columns should total 35,100.',
      ],
      explanation:
        '| Account | Dr | Cr |\n|---|---:|---:|\n| Cash | 10,640 | |\n| Savings Account | 3,650 | |\n| Accounts Receivable | 200 | |\n| Allowance for Doubtful Accounts | | 30 |\n| Inventory | 1,000 | |\n| Prepaid Rent | 1,500 | |\n| Equipment | 12,000 | |\n| Accumulated Depreciation | | 2,600 |\n| Accounts Payable | | 1,650 |\n| Wages Payable | | 700 |\n| Unearned Revenue – Gift Cards | | 200 |\n| Paid-in Capital | | 20,000 |\n| Retained Earnings | | 4,820 |\n| Sales Revenue | | 5,100 |\n| Cost of Goods Sold | 1,600 | |\n| Wages Expense | 2,500 | |\n| Rent Expense | 1,500 | |\n| Utilities Expense | 250 | |\n| Depreciation Expense | 200 | |\n| Card Processing Fees | 60 | |\n| **Total** | **35,100** | **35,100** |\n\nRetained Earnings is still the Dec 1 figure — December’s profit (5,100 − 6,110 = **−1,010**, a loss) only reaches it at closing.',
      opening: bs(dec1),
      rows: [r1, r2, r3, r4, r5, r6, r7, r8, r9, a1, a2, a3, a4],
      answer: {
        trialBalance: [
          tb('dr', 'cash', 10640),
          tb('dr', 'savings', 3650),
          tb('dr', 'accounts-receivable', 200),
          tb('cr', 'allowance-doubtful', 30),
          tb('dr', 'inventory', 1000),
          tb('dr', 'prepaid-rent', 1500),
          tb('dr', 'equipment', 12000),
          tb('cr', 'accum-depreciation', 2600),
          tb('cr', 'accounts-payable', 1650),
          tb('cr', 'wages-payable', 700),
          tb('cr', 'unearned-gift-cards', 200),
          tb('cr', 'paid-in-capital', 20000),
          tb('cr', 'retained-earnings', 4820),
          tb('cr', 'sales-revenue', 5100),
          tb('dr', 'cogs', 1600),
          tb('dr', 'wages-expense', 2500),
          tb('dr', 'rent-expense', 1500),
          tb('dr', 'utilities-expense', 250),
          tb('dr', 'depreciation-expense', 200),
          tb('dr', 'card-fees', 60),
        ],
      },
    },
    {
      id: '10-find-the-error',
      sectionId: '10-processes',
      kind: 'booking',
      title: 'Find and fix the errors',
      role: 'practice',
      difficulty: 3,
      entityId: 'coffee',
      prompt:
        'A new part-time bookkeeper drafted these four entries. The trial balance came out **unbalanced — debits exceed credits by $310** — and Maya suspects at least one balanced entry is wrong too.\n\nThe events were:\n1. Paid January’s rent, **$1,500**, for January (the current month).\n2. Bought **$450** of beans on credit.\n3. Maya took a **$500** owner draw.\n4. Sold **$200** of gift cards for cash.\n\nThe rows are pre-filled with the bookkeeper’s drafts. **Edit them** until each is correct.',
      hints: [
        'Check each row’s ΣDr = ΣCr first. Which rows don’t balance, and by how much?',
        'A difference of 90 is divisible by 9 — a classic sign of transposed digits. A difference of 400 is twice 200 — a sign of a 200 posted on the wrong side.',
        'Now look at the balanced rows. Does every account make sense for its event? (Is an owner draw a wage?)',
      ],
      explanation:
        'Row by row:\n1. **Correct** as drafted: Dr Rent Expense 1,500 / Cr Cash 1,500.\n2. **Transposition**: Accounts Payable was credited 540 instead of 450 (Cr side 90 too big). Fix: Dr Inventory 450 / Cr Accounts Payable 450.\n3. **Wrong account** (balanced, so the TB couldn’t catch it): an owner draw is **Dividends**, not Wages Expense. Fix: Dr Dividends 500 / Cr Cash 500.\n4. **Wrong side**: Unearned Revenue was debited instead of credited (Dr side 400 too big). Fix: Dr Cash 200 / Cr Unearned Revenue – Gift Cards 200.\n\nNet TB effect of the drafts: +400 Dr (row 4) − 90 Dr (row 2) = debits exceed credits by **310**. Row 3 would have slipped through a balanced TB — it overstates expenses and understates net income by $500.',
      showBalanceSheets: false,
      // Starting balances so the entry doesn't take an account below zero.
      opening: { lines: [{ accountId: 'cash', amount: usd(1800) }, { accountId: 'paid-in-capital', amount: usd(1800) }] },
      journalView: true,
      prefill: {
        locked: false,
        rows: [
          row('t1', 'Pay January rent', dr('rent-expense', 1500), cr('cash', 1500)),
          row('t2', 'Beans on credit', dr('inventory', 450), cr('accounts-payable', 540)),
          row('t3', 'Owner draw', dr('wages-expense', 500), cr('cash', 500)),
          row('t4', 'Sell gift cards', dr('cash', 200), dr('unearned-gift-cards', 200)),
        ],
      },
      trapAccounts: [
        {
          id: 'owner-salary-10',
          name: 'Owner Salary Expense',
          type: 'expense',
          trap: {
            kind: 'near-synonym',
            explanation: 'Maya isn’t on payroll; her draw is a distribution of profit: **Dividends (Owner Draws)**, not an expense.',
          },
        },
        {
          id: 'gift-card-revenue-fe',
          name: 'Gift Card Revenue',
          type: 'revenue',
          trap: {
            kind: 'near-synonym',
            explanation: 'Selling a gift card creates a liability — **Unearned Revenue – Gift Cards** — not revenue.',
          },
        },
      ],
      diagnosticExplanations: {
        UNBALANCED_ROW: 'Rows 2 and 4 don’t balance. Row 2 has a transposed amount (450 vs 540); row 4 has both postings on the debit side.',
        WRONG_AMOUNT: 'The beans cost **$450** — both sides of row 2 should be 450.',
        WRONG_SIDE: 'Selling gift cards **increases** a liability — that’s a **credit** to Unearned Revenue.',
        EXTRA_ACCOUNT: 'Row 3: an owner draw is not Wages Expense. Use **Dividends (Owner Draws)**.',
        MISSING_ACCOUNT: 'Row 3 needs **Dividends (Owner Draws)** on the debit side.',
      },
      solution: [
        row('t1', 'Pay January rent', dr('rent-expense', 1500), cr('cash', 1500)),
        row('t2', 'Beans on credit', dr('inventory', 450), cr('accounts-payable', 450)),
        row('t3', 'Owner draw', dr('dividends', 500), cr('cash', 500)),
        row('t4', 'Sell gift cards', dr('cash', 200), cr('unearned-gift-cards', 200)),
      ],
    },
    {
      id: '10-mc-tb-limits',
      sectionId: '10-processes',
      kind: 'multiple-choice',
      title: 'What a balanced trial balance can’t tell you',
      role: 'practice',
      difficulty: 2,
      multi: true,
      prompt: 'Bean There’s trial balance balances perfectly. Which of these errors could **still** be in the books? Select **all** that apply.',
      hints: ['A TB only checks that total debits equal total credits.', 'For each error, ask: does it change the Dr total and the Cr total by different amounts?'],
      explanation:
        'A TB catches only errors that make total debits ≠ total credits. Posting to the wrong account on the right side, omitting an entire entry, or using the same wrong amount on both sides all leave the TB balanced. A one-sided posting or a one-sided transposition does unbalance it.',
      options: [
        {
          text: 'A $500 owner draw debited to Wages Expense instead of Dividends.',
          correct: true,
          explanation: 'Right side, wrong account — both totals still match.',
        },
        { text: 'A $250 utility bill that was never recorded at all.', correct: true, explanation: 'An omitted entry changes neither total.' },
        {
          text: 'A $450 purchase recorded as Dr Inventory 540 / Cr Accounts Payable 540.',
          correct: true,
          explanation: 'The same wrong amount on both sides keeps the TB balanced.',
        },
        {
          text: 'A $450 purchase recorded as Dr Inventory 450 / Cr Accounts Payable 540.',
          correct: false,
          explanation: 'The credit side is 90 bigger — the TB is off by 90 (divisible by 9: a transposition).',
        },
        {
          text: 'A $200 gift-card sale recorded as Dr Cash 200 / Dr Unearned Revenue 200.',
          correct: false,
          explanation: 'Two debits and no credit — debits exceed credits by 400.',
        },
      ],
    },
    {
      id: '10-rv-gift-card-by-card',
      sectionId: '10-processes',
      kind: 'booking',
      title: 'Review: a gift card paid by card',
      role: 'review',
      difficulty: 2,
      entityId: 'coffee',
      prompt: 'A customer buys a **$25** gift card and pays with a **debit card**. The processor will settle in two days. Book the sale of the gift card.',
      hints: [
        'Two questions: what did Bean There get (and is it cash yet?), and what does it owe?',
        'Card money in flight is a receivable from the processor. A gift card is an obligation to deliver coffee.',
      ],
      explanation:
        '**Dr Card Receivables 25 / Cr Unearned Revenue – Gift Cards 25.** Both halves combine earlier ideas: the cash is in transit (card receivable, §7) and nothing has been earned yet (unearned revenue, §8). Revenue comes when the card is redeemed.',
      showBalanceSheets: true,
      opening: bs({ cash: 1000, 'paid-in-capital': 1000 }),
      trapAccounts: [
        {
          id: 'gift-card-revenue-rv',
          name: 'Gift Card Revenue',
          type: 'revenue',
          trap: { kind: 'near-synonym', explanation: 'No coffee has been served yet — selling a gift card creates a liability, not revenue.' },
        },
        {
          id: 'prepaid-gift-card',
          name: 'Prepaid Gift Card',
          type: 'asset',
          trap: { kind: 'counterparty', explanation: 'That’s the **customer’s** asset. For Bean There, the gift card is an obligation: Unearned Revenue – Gift Cards.' },
        },
      ],
      diagnosticExplanations: {
        EXTRA_ACCOUNT:
          'The card payment hasn’t settled, so it isn’t Cash yet — use **Card Receivables (Cash in Transit)**. And it isn’t revenue until redemption.',
      },
      solution: [row('t1', 'Sell gift card by debit card', dr('card-receivable', 25), cr('unearned-gift-cards', 25))],
    },
    {
      id: '10-rv-grinder-contribution',
      sectionId: '10-processes',
      kind: 'booking',
      title: 'Review: Maya contributes a grinder',
      role: 'review',
      difficulty: 2,
      entityId: 'coffee',
      prompt:
        'Instead of cash, Maya contributes her own commercial coffee grinder, worth **$800**, to Bean There as additional investment. Book it in Bean There’s books.',
      hints: [
        'What did Bean There receive? It isn’t cash, but it is a long-lived asset.',
        'What did Bean There give in exchange? Same answer as when Maya invested cash.',
      ],
      explanation:
        '**Dr Equipment 800 / Cr Paid-in Capital 800.** Owners can invest assets other than cash; the asset is recorded at its fair value and equity rises by the same amount. It isn’t revenue (no customer, nothing sold) and isn’t a loan (no repayment). From now on the grinder is depreciated like any other equipment.',
      showBalanceSheets: true,
      opening: bs({ cash: 5000, 'paid-in-capital': 5000 }),
      trapAccounts: [
        {
          id: 'donation-revenue',
          name: 'Donation Revenue',
          type: 'revenue',
          trap: { kind: 'other', explanation: 'An owner’s contribution is an **investment** in exchange for ownership → Paid-in Capital, not revenue.' },
        },
        {
          id: 'owner-loan-10',
          name: 'Loan Payable – Owner',
          type: 'liability',
          trap: { kind: 'near-synonym', explanation: 'Maya isn’t lending the grinder; she’s investing it. No repayment is due → equity.' },
        },
      ],
      diagnosticExplanations: {
        EXTRA_ACCOUNT: 'No cash moved — the asset received is the grinder itself (**Equipment**).',
      },
      solution: [row('t1', 'Owner contributes grinder', dr('equipment', 800), cr('paid-in-capital', 800))],
    },
  ],
};
export default mod;
