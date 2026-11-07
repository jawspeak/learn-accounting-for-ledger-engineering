import type { BalanceSheet, Posting, SectionModule, TransactionRow } from '@contracts';

/** Owned by C2. Amounts below are written in whole dollars and converted to cents. */
const usd = (d: number) => d * 100;
const dr = (accountId: string, d: number): Posting => ({ accountId, side: 'dr', amount: usd(d) });
const cr = (accountId: string, d: number): Posting => ({ accountId, side: 'cr', amount: usd(d) });
const row = (id: string, label: string, ...postings: Posting[]): TransactionRow => ({ id, label, postings });
const bs = (o: Record<string, number>): BalanceSheet => ({
  lines: Object.entries(o).map(([accountId, d]) => ({ accountId, amount: usd(d) })),
});

const primer = `
**Cash basis** records revenue when cash arrives and expenses when cash leaves. **Accrual basis** records them when they are *earned* or *incurred* — whenever the cash moves. Bean There and First Example Bank both use accrual.

When cash and the economic event happen at different times, a balance-sheet account holds the difference until they line up:

| | Cash comes **later** (accrual) | Cash comes **first** (deferral) |
|---|---|---|
| **Revenue** | **Accrued revenue** → asset, e.g. *Interest Receivable*, *Accounts Receivable* | **Unearned revenue** → liability, e.g. *Unearned Revenue – Gift Cards* |
| **Expense** | **Accrued expense** → liability, e.g. *Wages Payable*, *Accrued Interest Payable* | **Prepaid expense** → asset, e.g. *Prepaid Rent* |

Every one of these is a two-step pattern:
1. **Recognize** the revenue/expense in the right period, against the holding account.
2. **Settle** the holding account when the cash (or the service) finally moves — no revenue or expense in this step.

Our running example: Bean There keeps **$3,650** in savings at First Example Bank at **10% simple interest**. That’s $3,650 × 10% ÷ 365 = **exactly $1 per day**. Each day both parties *accrue* $1; on the last day of the month the bank *posts* the month’s $30 into the account.
`;

const lens = `
**Ledger-engineer's lens: accruals are scheduled jobs**

- A daily accrual is a **cron job** that posts one small entry per account per day. Make it **idempotent**: key each posting by \`(account, accrual_date)\` — e.g. \`accrual:savings-bean-there:2026-11-28\` — so a retry or a re-run never double-accrues.
- Month-end **capitalization** (moving accrued interest into the deposit balance) is a second job that posts exactly the sum of that month’s accruals. A good invariant: *after posting, Interest Receivable / Accrued Interest Payable for that account is zero.*
- The two sides should **reconcile**: Bean There’s Interest Receivable for this account must equal the bank’s Accrued Interest Payable for it, every day.
- Accrue in integer minor units. With non-round rates you need a rounding policy (and a remainder carried to the posting day) — which is why this course uses exactly $1/day.
`;

const callouts = [
  {
    title: 'Cash vs. accrual — who must accrue?',
    body: `Individuals almost always think in **cash basis**: money in, money out. That’s fine for a household.

**Companies** that produce financial statements under US GAAP (for investors, lenders, auditors) must use **accrual** accounting, because cash timing distorts results: a café that sells $5,000 of gift cards in December hasn’t *earned* $5,000 in December. (Small businesses may still be allowed to file *taxes* on a cash basis — a separate rule.)

**Banks** accrue too: interest on every loan and deposit is earned or owed *every day*, and regulators require accrual-basis reports. If the bank only booked interest when it paid it, its monthly profit would jump around for no economic reason and its liabilities would be understated.`,
  },
];

const coffeeInterestTraps = [
  {
    id: 'accrued-interest-payable-trap',
    name: 'Accrued Interest Payable',
    type: 'liability' as const,
    trap: {
      kind: 'counterparty' as const,
      explanation:
        'Accrued Interest Payable is the **bank’s** account — the bank owes the interest. Bean There is *owed* the interest, so it’s an asset: **Interest Receivable**.',
    },
  },
  {
    id: 'interest-expense-trap',
    name: 'Interest Expense',
    type: 'expense' as const,
    trap: {
      kind: 'counterparty' as const,
      explanation:
        'The **bank** pays the interest, so it’s the bank’s expense. Bean There *earns* it: **Interest Income** (Revenue).',
    },
  },
];

const mod: SectionModule = {
  section: {
    id: '08-accruals',
    number: 8,
    title: 'Accruals & Deferrals',
    summary: 'Cash vs. accrual basis; interest, gift cards, prepaid rent, accrued wages.',
    primer,
    lens,
    callouts,
    problemIds: [
      '08-daily-accrual',
      '08-interest-month-end',
      '08-interest-bank-side',
      '08-gift-cards',
      '08-prepaid-rent',
      '08-accrued-wages',
      '08-catering-invoice',
      '08-mc-cash-vs-accrual',
      '08-rv-loan-to-coffee',
      '08-rv-dr-cr',
    ],
  },
  problems: [
    {
      id: '08-daily-accrual',
      sectionId: '08-accruals',
      kind: 'booking',
      title: 'One day of interest',
      role: 'worked',
      difficulty: 1,
      entityId: 'coffee',
      prompt:
        'Bean There holds **$3,650** in its savings account at First Example Bank, earning **10% simple interest** — exactly **$1 per day**. The bank only adds interest to the account at month-end.\n\nBook Bean There’s **accrual for November 1** (one day of interest).',
      hints: [
        'Did any cash move today? No — but did Bean There *earn* something?',
        'Bean There earned $1. Which account type records value earned, and which side increases it?',
        'The other side: the bank owes Bean There $1 that hasn’t been paid yet. What kind of account is "money owed to us"?',
      ],
      walkthrough: [
        '**Start from the account you know.** Bean There earned $1 of interest today — that’s **Interest Income**, a Revenue account. Revenue increases on the **credit** side: Cr Interest Income 1.',
        'The savings balance hasn’t changed — the bank adds interest only at month-end. So we can’t debit Savings.',
        'What does Bean There have instead? A **right to receive** $1 from the bank: **Interest Receivable**, an Asset. Assets increase on the **debit** side: Dr Interest Receivable 1.',
        'Row balances: Dr 1 = Cr 1. Equation: Assets +1 = Equity +1 (through revenue). ✓',
        'This repeats every day. At month-end, when the bank posts the interest, Interest Receivable is cleared into Savings — next problem.',
      ],
      explanation:
        '**Dr Interest Receivable 1 / Cr Interest Income 1.** Under accrual accounting, Bean There records interest as it is **earned** (daily), not when the bank pays it. The revenue is real today; the cash comes later, so the asset in the meantime is a receivable.\n\nWhy not Dr Savings? The savings balance at the bank hasn’t changed yet — if Bean There’s books showed $3,651, they wouldn’t reconcile with the bank statement until month-end.',
      showBalanceSheets: true,
      opening: bs({ cash: 1000, savings: 3650, 'paid-in-capital': 4000, 'retained-earnings': 650 }),
      trapAccounts: coffeeInterestTraps,
      diagnosticExplanations: {
        EXTRA_ACCOUNT:
          'The bank hasn’t added anything to the savings account yet — that happens at month-end. Until then, the $1 is a receivable: **Interest Receivable**.',
        WRONG_TYPE: 'Interest Receivable is an **Asset** (money owed to Bean There); Interest Income is **Revenue**.',
        WRONG_SIDE: 'Revenue increases on the **credit** side; the receivable (Asset) increases on the **debit** side.',
      },
      solution: [row('t1', 'Accrue Nov 1 interest', dr('interest-receivable', 1), cr('interest-income', 1))],
    },
    {
      id: '08-interest-month-end',
      sectionId: '08-accruals',
      kind: 'booking',
      title: 'Last days of the month, then the bank posts',
      role: 'faded',
      difficulty: 2,
      entityId: 'coffee',
      prompt:
        'It’s late November. Bean There has accrued interest for Nov 1–27 (**$27**, see the opening balance sheet). Rows 1–2 (Nov 28 and Nov 29 accruals) are done for you.\n\nBook:\n- **Row 3:** the Nov 30 accrual ($1).\n- **Row 4:** on Nov 30 the bank **posts the month’s $30 of interest** into Bean There’s savings account.\n\n_(Next month the bank will pay interest on $3,680 — that’s compounding — but we stop here.)_',
      hints: [
        'Row 3 looks exactly like rows 1 and 2.',
        'Row 4: Which account are you sure about? The savings balance at the bank goes up by $30.',
        'Is this *new* revenue? No — all $30 was already recognized day by day. What happens to the receivable now that the bank has paid?',
      ],
      explanation:
        '**Row 3: Dr Interest Receivable 1 / Cr Interest Income 1** — same as every other day.\n\n**Row 4: Dr Savings 30 / Cr Interest Receivable 30.** The bank pays the 30 accrued days into the account: Savings (Asset) ↑, and the receivable is settled (Asset ↓) back to zero. **No revenue** in row 4 — it was all recognized in the daily accruals. Crediting Interest Income again would count November’s interest twice (Interest Income would show $60).\n\nEnd state: Savings 3,680, Interest Receivable 0, Interest Income for November 30. ✓',
      perspectivePairId: '08-interest-bank-side',
      showBalanceSheets: true,
      opening: bs({
        cash: 1000,
        savings: 3650,
        'interest-receivable': 27,
        'paid-in-capital': 4000,
        'retained-earnings': 650,
        'interest-income': 27,
      }),
      prefill: {
        locked: true,
        rows: [
          row('t1', 'Accrue Nov 28', dr('interest-receivable', 1), cr('interest-income', 1)),
          row('t2', 'Accrue Nov 29', dr('interest-receivable', 1), cr('interest-income', 1)),
        ],
      },
      trapAccounts: coffeeInterestTraps,
      diagnosticExplanations: {
        EXTRA_ACCOUNT:
          'In row 4, the interest was already earned day by day. Posting is a **settlement**: the receivable turns into savings. Crediting Interest Income again would double-count it.',
        WRONG_AMOUNT: 'The posting covers the whole month: 30 days × $1 = **$30**, which is exactly the Interest Receivable balance after row 3.',
        SPLIT_ENTRY: 'Each day’s accrual is its own event, and the month-end posting is one event — one row each.',
      },
      solution: [
        row('t1', 'Accrue Nov 28', dr('interest-receivable', 1), cr('interest-income', 1)),
        row('t2', 'Accrue Nov 29', dr('interest-receivable', 1), cr('interest-income', 1)),
        row('t3', 'Accrue Nov 30', dr('interest-receivable', 1), cr('interest-income', 1)),
        row('t4', 'Bank posts November interest', dr('savings', 30), cr('interest-receivable', 30)),
      ],
    },
    {
      id: '08-interest-bank-side',
      sectionId: '08-accruals',
      kind: 'booking',
      title: 'The same interest, in the bank’s books',
      role: 'practice',
      difficulty: 3,
      entityId: 'bank',
      prompt:
        'Now be **First Example Bank**. It owes Bean There $1/day of interest on its $3,650 savings balance and has already accrued **$27** for Nov 1–27 (see the opening balance sheet). The bank records all of Bean There’s accounts — checking and savings — in **Business Deposits**.\n\nBook four rows:\n1. Nov 28 accrual\n2. Nov 29 accrual\n3. Nov 30 accrual\n4. Nov 30: the bank posts the month’s **$30** into Bean There’s savings account.',
      hints: [
        'For the bank, is interest on a deposit something it earns or something it pays?',
        'Each day: the bank incurs $1 of expense that it hasn’t paid yet. What liability holds "owed, not yet paid"?',
        'Row 4: paying the interest into the account settles the accrued liability. What happens to the deposit — and which liability account is Bean There’s?',
      ],
      explanation:
        '**Rows 1–3: Dr Interest Expense 1 / Cr Accrued Interest Payable 1** (each day). The bank incurs $1 of expense daily and owes it but hasn’t paid it.\n\n**Row 4: Dr Accrued Interest Payable 30 / Cr Business Deposits 30.** Paying the interest *into the account* means the bank now owes Bean There $30 more as a deposit. One liability (accrued interest) is swapped for another (the deposit). No cash leaves the bank, and no new expense — it was all accrued already.\n\nMirror image of Bean There’s books: their Interest Receivable ↔ the bank’s Accrued Interest Payable; their Interest Income ↔ the bank’s Interest Expense; their Savings ↑ ↔ the bank’s Business Deposits ↑.',
      perspectivePairId: '08-interest-month-end',
      showBalanceSheets: true,
      opening: bs({
        'reserves-fed': 5000,
        'deposits-business': 3650,
        'accrued-interest-payable': 27,
        'paid-in-capital': 1000,
        'retained-earnings': 350,
        'interest-expense': 27,
      }),
      trapAccounts: [
        {
          id: 'bt-savings-asset',
          name: 'Savings Account – Bean There',
          type: 'asset',
          trap: {
            kind: 'counterparty',
            explanation:
              'A savings account is an asset only to **Bean There**. To the bank, Bean There’s savings balance is a liability — recorded in **Business Deposits**.',
          },
        },
        {
          id: 'interest-income-deposits',
          name: 'Interest Income – Deposits',
          type: 'revenue',
          trap: {
            kind: 'near-synonym',
            explanation:
              'Banks **pay** interest on deposits — it’s their cost of borrowing from customers. Interest on a deposit is the bank’s **Interest Expense**. (Banks earn interest income on *loans*.)',
          },
        },
      ],
      diagnosticExplanations: {
        EXTRA_ACCOUNT:
          'Interest Receivable and Interest Income are for interest the bank *earns* on loans. Here the bank owes interest. And Bean There is a business customer, so its balance lives in **Business Deposits**, not Customer Deposits – Savings.',
        MISSING_ACCOUNT:
          'Daily: the expense (Interest Expense) and what’s owed (Accrued Interest Payable). Month-end: Accrued Interest Payable goes to zero and Business Deposits goes up.',
        WRONG_SIDE:
          'Liabilities increase with a **credit** and decrease with a **debit**. Expenses increase with a **debit**.',
      },
      solution: [
        row('t1', 'Accrue Nov 28', dr('interest-expense', 1), cr('accrued-interest-payable', 1)),
        row('t2', 'Accrue Nov 29', dr('interest-expense', 1), cr('accrued-interest-payable', 1)),
        row('t3', 'Accrue Nov 30', dr('interest-expense', 1), cr('accrued-interest-payable', 1)),
        row('t4', 'Post November interest to Bean There', dr('accrued-interest-payable', 30), cr('deposits-business', 30)),
      ],
    },
    {
      id: '08-gift-cards',
      sectionId: '08-accruals',
      kind: 'booking',
      title: 'Gift cards: sold, then redeemed',
      role: 'practice',
      difficulty: 2,
      entityId: 'coffee',
      prompt:
        '1. In December, Bean There sells **$500** of gift cards for cash.\n2. In January, customers redeem **$120** of those gift cards for coffee.\n\nBook both events.',
      hints: [
        'Row 1: Cash is up for sure. Has Bean There *earned* anything yet — has it served any coffee?',
        'Taking money for coffee you still owe creates an obligation. Which type of account is an obligation?',
        'Row 2: Coffee is served, so revenue is earned now. What happens to the obligation? Did any cash move?',
      ],
      explanation:
        '**Row 1: Dr Cash 500 / Cr Unearned Revenue – Gift Cards 500.** Bean There has the cash but owes $500 of coffee (or a refund). That’s a **liability**, not revenue.\n\n**Row 2: Dr Unearned Revenue – Gift Cards 120 / Cr Sales Revenue 120.** Serving the coffee fulfils part of the obligation: the liability goes down and revenue is earned *now*. No cash moves in row 2.\n\nAfter both rows $380 of gift cards are still outstanding — still a liability. Revenue in December: $0. Revenue in January: $120.',
      showBalanceSheets: true,
      opening: bs({ cash: 2000, 'paid-in-capital': 2000 }),
      trapAccounts: [
        {
          id: 'gift-card-revenue',
          name: 'Gift Card Revenue',
          type: 'revenue',
          trap: {
            kind: 'near-synonym',
            explanation:
              'Selling a gift card isn’t earning revenue — Bean There hasn’t delivered anything yet. The cash creates an obligation: **Unearned Revenue – Gift Cards** (a liability).',
          },
        },
        {
          id: 'gift-card-receivable',
          name: 'Gift Cards Receivable',
          type: 'asset',
          trap: {
            kind: 'other',
            explanation:
              'Nobody owes Bean There anything — the customer paid up front. It’s the other way round: Bean There owes the customer coffee.',
          },
        },
      ],
      diagnosticExplanations: {
        EXTRA_ACCOUNT:
          'Row 1: no revenue until coffee is served. Row 2: no cash moves at redemption — the customer paid back when they bought the card.',
        WRONG_SIDE: 'Unearned Revenue is a **liability**: it increases with a credit (row 1) and decreases with a debit (row 2).',
        WRONG_TYPE: 'Despite its name, **Unearned Revenue** is a **Liability** — it’s an obligation to deliver.',
      },
      solution: [
        row('t1', 'Sell gift cards', dr('cash', 500), cr('unearned-gift-cards', 500)),
        row('t2', 'Gift cards redeemed', dr('unearned-gift-cards', 120), cr('sales-revenue', 120)),
      ],
    },
    {
      id: '08-prepaid-rent',
      sectionId: '08-accruals',
      kind: 'booking',
      title: 'Three months of rent up front',
      role: 'practice',
      difficulty: 2,
      entityId: 'coffee',
      prompt:
        '1. On **November 1**, Bean There pays **$4,500** for three months of rent (Nov, Dec, Jan) in advance.\n2. On **November 30**, record November’s share of the rent.\n\nBook both events.',
      hints: [
        'Row 1: Cash goes down. Has Bean There used up three months of the space on Nov 1?',
        'Something paid for but not yet used is an asset. Which account?',
        'Row 2: One month of the three has now been used. How much becomes an expense, and which asset shrinks?',
      ],
      explanation:
        '**Row 1: Dr Prepaid Rent 4,500 / Cr Cash 4,500.** Paying in advance swaps one asset (cash) for another: the right to use the space for three months.\n\n**Row 2: Dr Rent Expense 1,500 / Cr Prepaid Rent 1,500.** November has been used up: one-third of the prepaid becomes an expense. $3,000 of Prepaid Rent remains for December and January, and the same adjustment repeats at the end of each month.\n\nIf you’d expensed the full $4,500 on Nov 1, November would look $3,000 worse and December and January $1,500 better each — exactly what accrual accounting avoids.',
      showBalanceSheets: true,
      opening: bs({ cash: 10000, 'paid-in-capital': 10000 }),
      trapAccounts: [
        {
          id: 'rent-payable-trap',
          name: 'Rent Payable',
          type: 'liability',
          trap: {
            kind: 'near-synonym',
            explanation: 'Rent Payable is for rent you **owe** but haven’t paid. Here Bean There paid **in advance** — the opposite situation, an asset.',
          },
        },
        {
          id: 'unearned-rent',
          name: 'Unearned Rent Revenue',
          type: 'liability',
          trap: {
            kind: 'counterparty',
            explanation:
              'That’s the **landlord’s** account: the landlord received cash before providing the space. In Bean There’s books, the same prepayment is **Prepaid Rent** (an asset).',
          },
        },
      ],
      diagnosticExplanations: {
        EXTRA_ACCOUNT:
          'In row 1, nothing is used up yet, so no expense. In row 2, no cash moves — the rent was paid on Nov 1.',
        WRONG_AMOUNT: 'Row 2 records one month: $4,500 ÷ 3 = **$1,500**.',
        WRONG_SIDE: 'Prepaid Rent is an asset: up with a debit (row 1), down with a credit (row 2).',
      },
      solution: [
        row('t1', 'Prepay 3 months of rent', dr('prepaid-rent', 4500), cr('cash', 4500)),
        row('t2', 'November rent used', dr('rent-expense', 1500), cr('prepaid-rent', 1500)),
      ],
    },
    {
      id: '08-accrued-wages',
      sectionId: '08-accruals',
      kind: 'booking',
      title: 'Wages earned, not yet paid',
      role: 'practice',
      difficulty: 3,
      entityId: 'coffee',
      prompt:
        'Bean There pays its baristas every Friday for the week. November 30 is a Wednesday.\n\n1. **Nov 30:** baristas have earned **$900** since the last payday (Mon–Wed). Record the month-end accrual.\n2. **Fri Dec 2:** payday. Bean There pays **$1,500** for the whole week — the $900 from Mon–Wed plus **$600** for Thu–Fri.\n\nBook both events.',
      hints: [
        'Row 1: The work was done in November, so the expense belongs to November — even though no cash moved. What does Bean There owe?',
        'Row 2: $1,500 of cash leaves. Part of it pays off what you recorded in row 1. What’s the rest?',
        'Row 2 touches three accounts. It’s one payday, so it’s one compound row.',
      ],
      explanation:
        '**Row 1: Dr Wages Expense 900 / Cr Wages Payable 900.** The baristas’ work happened in November, so November bears the expense. Bean There owes it → liability.\n\n**Row 2: Dr Wages Payable 900, Dr Wages Expense 600 / Cr Cash 1,500.** The payment settles the $900 liability (no new expense for that part) and covers $600 of December work, which is December’s expense.\n\nResult: November wages expense $900, December $600 — each month carries the work done in it.',
      showBalanceSheets: true,
      opening: bs({ cash: 5000, 'paid-in-capital': 5000 }),
      trapAccounts: [
        {
          id: 'prepaid-wages',
          name: 'Prepaid Wages',
          type: 'asset',
          trap: {
            kind: 'near-synonym',
            explanation:
              'Prepaid Wages would mean Bean There paid **before** the work. Here the work came first and payment later — that’s a liability, **Wages Payable**.',
          },
        },
        {
          id: 'wages-receivable',
          name: 'Wages Receivable',
          type: 'asset',
          trap: {
            kind: 'counterparty',
            explanation: 'That’s how a **barista** might see it — money owed to them. In Bean There’s books, it’s owed *by* Bean There: **Wages Payable**.',
          },
        },
      ],
      diagnosticExplanations: {
        WRONG_AMOUNT:
          'Row 2: only the Thu–Fri work ($600) is new expense. The $900 was already expensed in November — it reduces Wages Payable instead.',
        MISSING_ACCOUNT: 'Payday clears the $900 liability **and** records $600 of new December expense, against $1,500 cash.',
        EXTRA_ACCOUNT: 'Row 1 involves no cash — payday is Friday.',
        SPLIT_ENTRY: 'One paycheck run is one event — book it as a single compound row.',
      },
      solution: [
        row('t1', 'Accrue Mon–Wed wages', dr('wages-expense', 900), cr('wages-payable', 900)),
        row('t2', 'Payday', dr('wages-payable', 900), dr('wages-expense', 600), cr('cash', 1500)),
      ],
    },
    {
      id: '08-catering-invoice',
      sectionId: '08-accruals',
      kind: 'booking',
      title: 'Catering now, cash later',
      role: 'practice',
      difficulty: 2,
      entityId: 'coffee',
      prompt:
        '1. **Nov 29:** Bean There delivers **$400** of coffee catering to a local office and sends an invoice due in 15 days.\n2. **Dec 10:** the office pays the invoice in full by bank transfer.\n\nBook both events. Compare with the gift cards: there cash came first; here it comes last.',
      hints: [
        'Row 1: The coffee was delivered in November. Is the revenue earned in November, even without cash?',
        'If revenue is earned but cash hasn’t arrived, what asset does Bean There hold?',
        'Row 2: Is there any *new* revenue in December?',
      ],
      explanation:
        '**Row 1: Dr Accounts Receivable 400 / Cr Sales Revenue 400.** The service is delivered in November, so November has the revenue. The client owes Bean There → receivable.\n\n**Row 2: Dr Cash 400 / Cr Accounts Receivable 400.** Collecting just converts the receivable into cash. No revenue in December.\n\nGift cards: *cash first* → liability, revenue later. Catering: *revenue first* → receivable, cash later.',
      showBalanceSheets: true,
      opening: bs({ cash: 2000, 'paid-in-capital': 2000 }),
      trapAccounts: [
        {
          id: 'unearned-catering',
          name: 'Unearned Catering Revenue',
          type: 'liability',
          trap: {
            kind: 'near-synonym',
            explanation: 'Unearned revenue is for cash received **before** delivering. Here Bean There delivered first, so it is owed money: **Accounts Receivable**.',
          },
        },
        {
          id: 'client-ap',
          name: 'Accounts Payable – Bean There',
          type: 'liability',
          trap: {
            kind: 'counterparty',
            explanation: 'That’s how the **client** records the debt. In Bean There’s books, the client’s debt is an asset: **Accounts Receivable**.',
          },
        },
      ],
      diagnosticExplanations: {
        EXTRA_ACCOUNT:
          'Card Receivables is only for money in transit from the card processor. An invoiced client is **Accounts Receivable**. And collection in December earns no new revenue.',
        WRONG_SIDE: 'Accounts Receivable is an asset: debit to increase (row 1), credit to decrease (row 2).',
      },
      solution: [
        row('t1', 'Deliver catering, invoice', dr('accounts-receivable', 400), cr('sales-revenue', 400)),
        row('t2', 'Client pays invoice', dr('cash', 400), cr('accounts-receivable', 400)),
      ],
    },
    {
      id: '08-mc-cash-vs-accrual',
      sectionId: '08-accruals',
      kind: 'multiple-choice',
      title: 'November revenue: cash vs. accrual',
      role: 'practice',
      difficulty: 2,
      multi: false,
      prompt:
        'In November, Bean There:\n- sold **$500** of gift cards for cash,\n- had **$120** of gift cards redeemed for coffee,\n- delivered **$400** of catering, invoiced and paid in December,\n- earned **$30** of savings interest, accrued daily and posted to savings on Nov 30.\n\nUsing **accrual** accounting, what is Bean There’s total revenue for November (counting only these items)?',
      hints: [
        'Accrual: revenue counts when it’s *earned*, regardless of cash. Go item by item: was anything delivered or earned?',
        'Was anything earned by *selling* a gift card? What about redeeming one?',
      ],
      explanation:
        'Earned in November: gift cards **redeemed** $120 + catering **delivered** $400 + interest **earned** $30 = **$550**. Selling gift cards ($500) isn’t revenue — it creates a liability. Under the cash basis you’d instead count cash received: $500 (gift cards) + $30 (interest posted) = $530 — a different number for a different question.',
      options: [
        { text: '$550', correct: true, explanation: '120 + 400 + 30. Each item was delivered or earned in November.' },
        { text: '$530', correct: false, explanation: 'That’s the **cash-basis** view: gift-card cash plus interest received. Accrual ignores when cash moves.' },
        { text: '$1,050', correct: false, explanation: 'That counts the $500 gift-card sale as revenue. Selling a gift card creates a liability; revenue comes when it’s redeemed.' },
        { text: '$520', correct: false, explanation: 'Close — but you left out the $30 of interest, which was earned (accrued) in November too.' },
      ],
    },
    {
      id: '08-rv-loan-to-coffee',
      sectionId: '08-accruals',
      kind: 'booking',
      title: 'Review: the bank lends to Bean There',
      role: 'review',
      difficulty: 2,
      entityId: 'bank',
      prompt:
        'First Example Bank lends Bean There **$5,000** to buy a second grinder. The loan proceeds are credited to Bean There’s **business checking account** at the bank. Book this in the **bank’s** books.',
      hints: [
        'Which account are you sure about? The bank now has a claim on Bean There for $5,000.',
        'Where did the money go? Did any reserves or vault cash leave the bank?',
        'The bank credited Bean There’s account — what does the bank now owe Bean There?',
      ],
      explanation:
        '**Dr Loans Receivable 5,000 / Cr Business Deposits 5,000.** The bank gains an asset (Bean There owes it $5,000) and a liability (it owes Bean There the $5,000 now sitting in its checking account). No reserves move: the loan **created** a deposit. Reserves only move when Bean There spends the money and it leaves the bank.',
      showBalanceSheets: true,
      opening: bs({ 'reserves-fed': 20000, 'deposits-business': 12000, 'paid-in-capital': 5000, 'retained-earnings': 3000 }),
      trapAccounts: [
        {
          id: 'bt-loan-payable',
          name: 'Loan Payable',
          type: 'liability',
          trap: {
            kind: 'counterparty',
            explanation: 'Loan Payable is in **Bean There’s** books — Bean There owes the loan. For the bank, the loan is an asset: **Loans Receivable**.',
          },
        },
        {
          id: 'loan-revenue',
          name: 'Loan Revenue',
          type: 'revenue',
          trap: {
            kind: 'near-synonym',
            explanation: 'Lending money isn’t revenue — the bank expects the principal back. The bank earns **interest** over time, not the principal.',
          },
        },
      ],
      diagnosticExplanations: {
        EXTRA_ACCOUNT:
          'No reserves left the bank — the money was credited to an account at the same bank. The loan creates a deposit.',
        WRONG_SIDE: 'Loans Receivable (Asset) increases with a debit; Business Deposits (Liability) increases with a credit.',
      },
      solution: [row('t1', 'Lend to Bean There', dr('loans-receivable', 5000), cr('deposits-business', 5000))],
    },
    {
      id: '08-rv-dr-cr',
      sectionId: '08-accruals',
      kind: 'dr-cr-predict',
      title: 'Review: debit or credit?',
      role: 'review',
      difficulty: 1,
      prompt: 'For each change, choose **Dr** or **Cr**. Use the normal balance of the account’s type.',
      hints: ['DEALER: Dividends, Expenses, Assets are Dr-normal; Liabilities, Equity, Revenue are Cr-normal.', 'An increase goes on the normal side; a decrease on the opposite side.'],
      explanation: 'Increase = normal side; decrease = opposite side. Names like "Unearned Revenue" or "Prepaid Rent" can mislead — always go by the *type*.',
      items: [
        { accountName: 'Interest Receivable', accountType: 'asset', change: 'increase', answer: 'dr', explanation: 'Asset → Dr-normal → increase is Dr.' },
        { accountName: 'Unearned Revenue – Gift Cards', accountType: 'liability', change: 'increase', answer: 'cr', explanation: 'It’s a **liability**, despite "revenue" in its name → increase is Cr.' },
        { accountName: 'Prepaid Rent', accountType: 'asset', change: 'decrease', answer: 'cr', explanation: 'Asset → decrease is Cr.' },
        { accountName: 'Wages Payable', accountType: 'liability', change: 'decrease', answer: 'dr', explanation: 'Liability → decrease is Dr.' },
        { accountName: 'Accrued Interest Payable (bank)', accountType: 'liability', change: 'increase', answer: 'cr', explanation: 'Liability → increase is Cr.' },
        { accountName: 'Dividends (Owner Draws)', accountType: 'dividend', change: 'increase', answer: 'dr', explanation: 'Dividends are Dr-normal (the D in DEALER).' },
      ],
    },
  ],
};
export default mod;
