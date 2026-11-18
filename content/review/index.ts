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
Problems from every section, deliberately mixed: the café, the bank and the fintech, in no particular order. Mixing makes you do the hard part every time — **figure out what kind of problem this is** before solving it.

For every booking problem, run the same routine:
1. **Whose books?** Bean There, First Example Bank, or Zap? [[Counterparty]] accounts are in the picker to catch you.
2. **Which account am I sure about?** Up or down?
3. **[[Normal balance]] → Dr or Cr.** (DEALER.)
4. **Balance the row** — what account makes sense on the other side?
5. **One event, one row.** [[Compound entries]] are fine.
`;

const lens = `
**Ledger-engineer's lens: the whole model in five lines**

- An **entry** is an atomic set of [[postings]] with ΣDr = ΣCr; a **balance** is a sum of postings; money is **[[integer minor units]]**.
- **Normal balance** is just a sign convention per account type.
- **[[Accruals]]** and **[[clearing accounts]]** are state for time gaps and in-flight money.
- **[[Contra accounts]]** keep gross values; reports derive nets.
- **Never edit — reverse and rebook.** The [[ledger]] is append-only, and every [[invariant]] (TB, FBO, [[sub-ledger]] = control) can be checked continuously.
`;

const mod: SectionModule = {
  section: {
    id: 'review',
    number: 99,
    title: 'Mixed Review',
    summary: 'Interleaved problems from every section.',
    primer,
    lens,
    problemIds: [
      'rv-perspective-classify',
      'rv-utility-bill',
      'rv-loan-repay-bank',
      'rv-zap-load-and-pay',
      'rv-dr-cr-mix',
      'rv-grinder-depreciation',
      'rv-bank-loan-to-zap',
      'rv-card-return',
      'rv-equation-mix',
      'rv-accrued-hosting',
      'rv-closing-with-dividends',
      'rv-mc-fbo',
      'rv-zap-income-statement',
    ],
  },
  problems: [
    {
      id: 'rv-perspective-classify',
      sectionId: 'review',
      kind: 'classify',
      title: 'Same money, different books',
      role: 'review',
      difficulty: 2,
      prompt: 'Classify each account **in the books it belongs to** (shown in brackets).',
      buckets: ['asset', 'contra-asset', 'liability', 'equity', 'revenue', 'expense'],
      hints: ['For each, ask: from *that* entity’s point of view, is it owned, owed, earned or used up?', 'Several pairs here are the same money seen from two sides.'],
      explanation:
        'Mirror pairs: Bean There’s **Savings Account** (asset) ↔ the bank’s **Business Deposits** (liability); Zap’s **Cash: FBO** (asset) ↔ the bank’s **Deposits: FBO Accounts** (liability); Bean There’s **Interest Receivable** (asset) ↔ the bank’s **Accrued Interest Payable** (liability); Bean There’s **Interest Income** (revenue) ↔ the bank’s **Interest Expense** (expense). Accumulated Depreciation is a contra-asset; Customer Balances Payable is Zap’s liability.',
      items: [
        { label: 'Savings Account: First Example Bank [Bean There]', entityId: 'coffee', answer: 'asset', explanation: 'Bean There owns its savings.' },
        { label: 'Business Deposits [First Example Bank]', entityId: 'bank', answer: 'liability', explanation: 'The bank owes it to business customers.' },
        { label: 'Cash: FBO (Restricted) [Zap]', entityId: 'zap', answer: 'asset', explanation: 'Restricted cash Zap holds for customers.' },
        { label: 'Deposits: FBO Accounts [First Example Bank]', entityId: 'bank', answer: 'liability', explanation: 'The bank owes the FBO balance.' },
        { label: 'Customer Balances Payable: Alice [Zap]', entityId: 'zap', answer: 'liability', explanation: 'Zap owes Alice her balance.' },
        { label: 'Interest Receivable [Bean There]', entityId: 'coffee', answer: 'asset', explanation: 'Interest earned, owed to Bean There.' },
        { label: 'Accrued Interest Payable [First Example Bank]', entityId: 'bank', answer: 'liability', explanation: 'Interest the bank owes, not yet posted.' },
        { label: 'Interest Income [Bean There]', entityId: 'coffee', answer: 'revenue', explanation: 'Earned on savings.' },
        { label: 'Interest Expense [First Example Bank]', entityId: 'bank', answer: 'expense', explanation: 'The bank’s cost of paying depositors.' },
        { label: 'Accumulated Depreciation: Equipment [Bean There]', entityId: 'coffee', answer: 'contra-asset', explanation: 'Reduces Equipment; credit-normal.' },
      ],
    },
    {
      id: 'rv-utility-bill',
      sectionId: 'review',
      kind: 'booking',
      title: 'The electricity bill',
      role: 'review',
      difficulty: 1,
      entityId: 'coffee',
      prompt:
        '1. **Nov 30:** Bean There receives its **$250** electricity bill for November, due Dec 15.\n2. **Dec 15:** Bean There pays it by bank transfer.\n\nBook both events.',
      hints: ['Which month used the electricity?', 'Row 1 moves no cash. What does Bean There owe?', 'Row 2: is there any new expense?'],
      explanation:
        '**Row 1: Dr Utilities Expense 250 / Cr Accounts Payable 250** — November used the power, so November has the expense.\n\n**Row 2: Dr Accounts Payable 250 / Cr Cash 250** — paying settles the liability; no new expense.',
      showBalanceSheets: true,
      opening: bs({ cash: 3000, 'paid-in-capital': 3000 }),
      trapAccounts: [
        {
          id: 'prepaid-utilities-rv',
          name: 'Prepaid Utilities',
          type: 'asset',
          trap: { kind: 'near-synonym', explanation: 'Nothing was paid in advance — power was used first, paid later. That’s a liability.' },
        },
        {
          id: 'utility-revenue-rv',
          name: 'Electricity Sales Revenue',
          type: 'revenue',
          trap: { kind: 'counterparty', explanation: 'That’s the **utility company’s** revenue. For Bean There it’s Utilities Expense.' },
        },
      ],
      diagnosticExplanations: {
        EXTRA_ACCOUNT: 'Row 1 moves no cash; row 2 has no expense (it was recorded in November).',
        WRONG_SIDE: 'Accounts Payable rises with a credit (row 1) and falls with a debit (row 2).',
      },
      solution: [
        row('t1', 'November electricity bill', dr('utilities-expense', 250), cr('accounts-payable', 250)),
        row('t2', 'Pay the bill', dr('accounts-payable', 250), cr('cash', 250)),
      ],
    },
    {
      id: 'rv-loan-repay-bank',
      sectionId: 'review',
      kind: 'booking',
      title: 'Bean There repays its loan',
      role: 'review',
      difficulty: 3,
      entityId: 'bank',
      prompt:
        'Bean There repays its **$5,000** loan plus **$100** of interest, paid from its business checking account at First Example Bank. The bank has **already accrued** the $100 of interest (see Interest Receivable in the opening balances). Book it in the **bank’s** books as one entry.',
      hints: [
        'Which liability goes down when Bean There pays from its account at this bank?',
        'Two assets are settled: the principal and the interest that was already accrued.',
        'Is there new interest income today, or was it recognized already?',
      ],
      explanation:
        '**Dr Business Deposits 5,100 / Cr Loans Receivable 5,000 / Cr Interest Receivable 100.** Bean There’s deposit shrinks by the full payment. The loan principal is repaid, and the accrued interest receivable is collected. **No new Interest Income** — the bank recognized it as it accrued. (If the bank hadn’t accrued it, the $100 would be credited to Interest Income instead — the §6 version of this problem.) No reserves move: the money was already at this bank.',
      showBalanceSheets: true,
      opening: bs({
        'reserves-fed': 20000,
        'loans-receivable': 5000,
        'interest-receivable': 100,
        'deposits-business': 8000,
        'paid-in-capital': 10000,
        'retained-earnings': 7000,
        'interest-income': 100,
      }),
      trapAccounts: [
        {
          id: 'rv-loan-payable',
          name: 'Loan Payable',
          type: 'liability',
          trap: { kind: 'counterparty', explanation: 'Loan Payable is in **Bean There’s** books. For the bank, the loan is an asset: Loans Receivable.' },
        },
        {
          id: 'rv-bt-cash',
          name: 'Cash: Bean There',
          type: 'asset',
          trap: { kind: 'counterparty', explanation: 'Bean There’s cash is Bean There’s asset. The bank sees its own liability (Business Deposits) going down.' },
        },
      ],
      diagnosticExplanations: {
        EXTRA_ACCOUNT:
          'The interest was already accrued, so credit **Interest Receivable**, not Interest Income (that would double-count). No reserves move — Bean There paid from an account at this bank.',
        WRONG_AMOUNT: 'Bean There pays 5,000 + 100 = **5,100** out of its deposit.',
        SPLIT_ENTRY: 'One repayment, one compound row.',
      },
      solution: [
        row('t1', 'Loan repaid with accrued interest', dr('deposits-business', 5100), cr('loans-receivable', 5000), cr('interest-receivable', 100)),
      ],
    },
    {
      id: 'rv-zap-load-and-pay',
      sectionId: 'review',
      kind: 'booking',
      title: 'Carol joins Zap',
      role: 'review',
      difficulty: 2,
      entityId: 'zap',
      prompt:
        '1. Carol loads **$200** into Zap; it lands in the FBO account.\n2. Carol pays Bob **$50** with the instant option, which costs her a **$1** fee.\n\nBook both events in **Zap’s** books. (No sweep yet.)',
      hints: ['Row 1: restricted cash and a new customer liability.', 'Row 2: three accounts — Carol, Bob, and Zap’s revenue. Does FBO cash move?'],
      explanation:
        '**Row 1: Dr Cash: FBO 200 / Cr Customer Balances Payable: Carol 200.**\n\n**Row 2: Dr Customer Balances Payable: Carol 51 / Cr Customer Balances Payable: Bob 50 / Cr Transaction Fee Revenue 1.**\n\nAfter row 2 the FBO account still holds 350 = Alice 100 + Bob 100 + Carol 149 + $1 of Zap’s fees not yet swept.',
      showBalanceSheets: true,
      opening: bs({ 'cash-operating': 50000, 'cash-fbo': 150, 'cbp-alice': 100, 'cbp-bob': 50, 'paid-in-capital': 50000 }),
      trapAccounts: [
        {
          id: 'rv-bank-deposits-fbo',
          name: 'Deposits: FBO Accounts',
          type: 'liability',
          trap: { kind: 'counterparty', explanation: 'That’s the bank’s liability. Zap owes **Carol**: Customer Balances Payable: Carol.' },
        },
        {
          id: 'rv-load-revenue',
          name: 'Customer Load Revenue',
          type: 'revenue',
          trap: { kind: 'other', explanation: 'Loaded money is owed back to the customer — a liability. Only the fee is revenue.' },
        },
      ],
      diagnosticExplanations: {
        EXTRA_ACCOUNT: 'Row 2 moves no bank money — Cash: FBO doesn’t change. And customer money never goes to Cash: Operating.',
        WRONG_AMOUNT: 'Row 2: Carol pays 50 + 1 = **51**, Bob gets **50**, Zap earns **1**.',
      },
      solution: [
        row('t1', 'Carol loads $200', dr('cash-fbo', 200), cr('cbp-carol', 200)),
        row('t2', 'Carol pays Bob $50 + $1 fee', dr('cbp-carol', 51), cr('cbp-bob', 50), cr('transaction-fee-revenue', 1)),
      ],
    },
    {
      id: 'rv-dr-cr-mix',
      sectionId: 'review',
      kind: 'dr-cr-predict',
      title: 'Debit or credit — mixed',
      role: 'review',
      difficulty: 2,
      prompt: 'Choose **Dr** or **Cr** for each change.',
      hints: ['Find the type first; the name can mislead.', 'Contra accounts are the opposite of their parent.'],
      explanation: 'Increase → normal side; decrease → opposite. Contra accounts flip their parent’s normal side.',
      items: [
        { accountName: 'Accumulated Depreciation: Equipment', accountType: 'contra-asset', change: 'increase', answer: 'cr', explanation: 'Contra-asset → credit-normal.' },
        { accountName: 'Sales Returns & Allowances', accountType: 'contra-revenue', change: 'increase', answer: 'dr', explanation: 'Contra-revenue → debit-normal.' },
        { accountName: 'Clearing: Pending ACH Cash-outs (Zap)', accountType: 'liability', change: 'decrease', answer: 'dr', explanation: 'Liability decreasing → debit (on settlement).' },
        { accountName: 'Cash: FBO (Zap)', accountType: 'asset', change: 'decrease', answer: 'cr', explanation: 'Asset decreasing → credit.' },
        { accountName: 'Deposits: FBO Accounts (bank)', accountType: 'liability', change: 'increase', answer: 'cr', explanation: 'Liability increasing → credit.' },
        { accountName: 'Allowance for Doubtful Accounts', accountType: 'contra-asset', change: 'decrease', answer: 'dr', explanation: 'Credit-normal contra; decrease (write-off) → debit.' },
        { accountName: 'Retained Earnings', accountType: 'equity', change: 'increase', answer: 'cr', explanation: 'Equity increasing → credit (e.g. closing a profit).' },
      ],
    },
    {
      id: 'rv-grinder-depreciation',
      sectionId: 'review',
      kind: 'booking',
      title: 'A new grinder',
      role: 'review',
      difficulty: 2,
      entityId: 'coffee',
      prompt:
        '1. Bean There buys a **$2,400** grinder for cash. It will last **2 years** with no resale value (it’s recorded in the Equipment account).\n2. At month-end, record the first month’s straight-line depreciation.',
      hints: ['Row 1: is buying a long-lived asset an expense?', 'Row 2: $2,400 over 24 months = ?', 'Which contra account takes the credit?'],
      explanation:
        '**Row 1: Dr Equipment 2,400 / Cr Cash 2,400** — an asset swap.\n\n**Row 2: Dr Depreciation Expense 100 / Cr Accumulated Depreciation: Equipment 100** ($2,400 ÷ 24 months).',
      showBalanceSheets: true,
      opening: bs({ cash: 5000, 'paid-in-capital': 5000 }),
      trapAccounts: [
        {
          id: 'rv-equipment-expense',
          name: 'Equipment Expense',
          type: 'expense',
          trap: { kind: 'near-synonym', explanation: 'A grinder lasting 2 years is an asset; its cost is expensed gradually through depreciation.' },
        },
        {
          id: 'rv-depreciation-payable',
          name: 'Depreciation Payable',
          type: 'liability',
          trap: { kind: 'other', explanation: 'Nobody is owed depreciation; credit the contra-asset Accumulated Depreciation.' },
        },
      ],
      diagnosticExplanations: {
        WRONG_AMOUNT: '$2,400 ÷ 24 months = **$100** a month.',
        EXTRA_ACCOUNT: 'Don’t credit Equipment directly in row 2 — it stays at cost.',
      },
      solution: [
        row('t1', 'Buy grinder', dr('equipment', 2400), cr('cash', 2400)),
        row('t2', 'First month’s depreciation', dr('depreciation-expense', 100), cr('accum-depreciation', 100)),
      ],
    },
    {
      id: 'rv-bank-loan-to-zap',
      sectionId: 'review',
      kind: 'booking',
      title: 'The bank lends to Zap',
      role: 'review',
      difficulty: 2,
      entityId: 'bank',
      prompt:
        'First Example Bank lends Zap **$10,000** of working capital, credited to Zap’s **operating** account (recorded in Business Deposits). Book it in the **bank’s** books.',
      hints: ['What new asset does the bank have?', 'Which deposit account receives the money — the FBO account or Zap’s operating account?'],
      explanation:
        '**Dr Loans Receivable 10,000 / Cr Business Deposits 10,000.** The loan creates a deposit in Zap’s operating account. Never the FBO account — that holds customers’ money, and borrowed money is Zap’s own.',
      showBalanceSheets: true,
      opening: bs({ 'reserves-fed': 20000, 'deposits-business': 12000, 'paid-in-capital': 5000, 'retained-earnings': 3000 }),
      trapAccounts: [
        {
          id: 'rv-zap-loan-payable',
          name: 'Loan Payable',
          type: 'liability',
          trap: { kind: 'counterparty', explanation: 'That’s **Zap’s** liability. The bank holds the loan as an asset.' },
        },
        {
          id: 'rv-zap-cash-op',
          name: 'Cash: Operating',
          type: 'asset',
          trap: { kind: 'counterparty', explanation: 'Zap’s operating cash is Zap’s asset; for the bank it’s a deposit liability (Business Deposits).' },
        },
      ],
      diagnosticExplanations: {
        EXTRA_ACCOUNT: 'Borrowed money is Zap’s own — it goes into Zap’s operating account (Business Deposits), never Deposits: FBO. No reserves move.',
      },
      solution: [row('t1', 'Lend to Zap', dr('loans-receivable', 10000), cr('deposits-business', 10000))],
    },
    {
      id: 'rv-card-return',
      sectionId: 'review',
      kind: 'booking',
      title: 'A refund on a card sale',
      role: 'review',
      difficulty: 3,
      entityId: 'coffee',
      prompt:
        'Earlier today a customer bought a **$30** bag of beans by card (the processor hasn’t settled today’s sales yet). They return it unopened and the refund goes back to their card — the processor will **deduct it from today’s pending settlement**. Book the refund. (Inventory is tracked by month-end count.)',
      hints: ['Which account records refunds without hiding them inside Sales Revenue?', 'No cash leaves Bean There — what will the processor pay less of?'],
      explanation:
        '**Dr Sales Returns & Allowances 30 / Cr Card Receivables (Cash in Transit) 30.** The refund is a contra-revenue, and because it’s netted against the pending settlement, the processor will now pay $30 less: Card Receivables goes down instead of Cash.',
      showBalanceSheets: true,
      opening: bs({ cash: 1000, 'card-receivable': 200, 'paid-in-capital': 1000, 'sales-revenue': 200 }),
      trapAccounts: [
        {
          id: 'rv-refund-expense',
          name: 'Refund Expense',
          type: 'expense',
          trap: { kind: 'near-synonym', explanation: 'Refunds reduce revenue; use the contra-revenue Sales Returns & Allowances.' },
        },
        {
          id: 'rv-refunds-payable',
          name: 'Refunds Payable',
          type: 'liability',
          trap: { kind: 'other', explanation: 'Nothing remains owed — the processor nets the refund against what it owes Bean There.' },
        },
      ],
      diagnosticExplanations: {
        EXTRA_ACCOUNT:
          'No cash leaves Bean There: the processor deducts the refund from the pending settlement, so **Card Receivables** goes down. And use Sales Returns & Allowances rather than debiting Sales Revenue directly.',
      },
      solution: [row('t1', 'Card refund netted from settlement', dr('sales-returns', 30), cr('card-receivable', 30))],
    },
    {
      id: 'rv-equation-mix',
      sectionId: 'review',
      kind: 'equation-fill',
      title: 'Fill the gap: A = L + E',
      role: 'review',
      difficulty: 1,
      prompt: 'Fill in the missing number for each entity’s balance sheet (whole dollars).',
      hints: ['A = L + E, so any one can be found from the other two.'],
      explanation: 'Rearrange A = L + E for the blank: E = A − L, L = A − E, A = L + E.',
      items: [
        { assets: 26020, liabilities: 1200, equity: null, explanation: 'Bean There on Dec 1: E = 26,020 − 1,200 = **24,820**.' },
        { assets: 50100, liabilities: null, equity: 50000, explanation: 'Zap after Alice loads $100: L = 50,100 − 50,000 = **100** — exactly the customer balance.' },
        { assets: null, liabilities: 3680, equity: 1320, explanation: 'The bank after posting November interest: A = 3,680 + 1,320 = **5,000**.' },
      ],
    },
    {
      id: 'rv-accrued-hosting',
      sectionId: 'review',
      kind: 'booking',
      title: 'Hosting: accrued, then paid',
      role: 'review',
      difficulty: 2,
      entityId: 'zap',
      prompt:
        '1. **Nov 30:** Zap used **$3,000** of cloud hosting in November. The invoice hasn’t arrived yet.\n2. **Dec 12:** the invoice arrives for exactly $3,000 and Zap pays it immediately from its operating account.\n\nBook both events.',
      hints: ['Row 1: which month bears the cost? No invoice yet — which liability in Zap’s chart?', 'Row 2: is there new expense in December?'],
      explanation:
        '**Row 1: Dr Cloud Hosting Expense 3,000 / Cr Accrued Expenses 3,000** — incurred in November, not yet invoiced.\n\n**Row 2: Dr Accrued Expenses 3,000 / Cr Cash: Operating 3,000** — the payment settles the accrual; no December expense. (Had the invoice been paid later, you might first reclassify the accrual to Accounts Payable.)',
      showBalanceSheets: true,
      opening: bs({ 'cash-operating': 50000, 'paid-in-capital': 50000 }),
      trapAccounts: [
        {
          id: 'rv-cloud-revenue',
          name: 'Cloud Services Revenue',
          type: 'revenue',
          trap: { kind: 'counterparty', explanation: 'That’s the cloud provider’s revenue; for Zap it’s an expense.' },
        },
        {
          id: 'rv-hosting-payable',
          name: 'Hosting Payable',
          type: 'liability',
          trap: { kind: 'near-synonym', explanation: 'Zap’s chart uses **Accrued Expenses** for costs incurred but not yet invoiced.' },
        },
      ],
      diagnosticExplanations: {
        EXTRA_ACCOUNT:
          'Row 1 moves no cash, and Prepaid Expenses is for paying *before* using. Row 2 adds no new expense. Zap pays its own bills from **Cash: Operating**, never Cash: FBO.',
      },
      solution: [
        row('t1', 'Accrue November hosting', dr('hosting-expense', 3000), cr('accrued-expenses', 3000)),
        row('t2', 'Pay hosting invoice', dr('accrued-expenses', 3000), cr('cash-operating', 3000)),
      ],
    },
    {
      id: 'rv-closing-with-dividends',
      sectionId: 'review',
      kind: 'booking',
      title: 'Closing with interest income and dividends',
      role: 'review',
      difficulty: 3,
      entityId: 'coffee',
      prompt:
        'Close Bean There’s month (balances in the opening balance sheet) **directly into Retained Earnings**, in three rows:\n1. Close all **revenue** accounts (there are two).\n2. Close all **expense** accounts.\n3. Close **Dividends**.',
      hints: ['Zero each account by posting its balance on the opposite side.', 'Interest Income is revenue too.', 'Check: Retained Earnings should rise by 4,030 − 3,000 − 500.'],
      explanation:
        '**Row 1: Dr Sales Revenue 4,000, Dr Interest Income 30 / Cr Retained Earnings 4,030.**\n**Row 2: Dr Retained Earnings 3,000 / Cr Wages Expense 1,500, Cr Rent Expense 1,500.**\n**Row 3: Dr Retained Earnings 500 / Cr Dividends 500.**\n\nNet income 1,030, less dividends 500: Retained Earnings goes from 1,000 to **1,530**. Total equity is unchanged.',
      showBalanceSheets: true,
      opening: bs({
        cash: 6530,
        'paid-in-capital': 5000,
        'retained-earnings': 1000,
        'sales-revenue': 4000,
        'interest-income': 30,
        'wages-expense': 1500,
        'rent-expense': 1500,
        dividends: 500,
      }),
      trapAccounts: [
        {
          id: 'rv-income-summary',
          name: 'Income Summary',
          type: 'equity',
          equityGroup: 'retained',
          trap: { kind: 'other', explanation: 'This problem closes directly into **Retained Earnings**; Bean There’s chart has no Income Summary account.' },
        },
        {
          id: 'rv-net-income',
          name: 'Net Income',
          type: 'equity',
          equityGroup: 'retained',
          trap: { kind: 'other', explanation: 'Net income is a result, not an account. It lands in Retained Earnings.' },
        },
      ],
      diagnosticExplanations: {
        MISSING_ACCOUNT: 'Don’t forget **Interest Income** — it’s revenue and must be closed too.',
        WRONG_SIDE: 'Debit revenue to close it; credit expenses and dividends to close them.',
        EXTRA_ACCOUNT: 'Closing never touches Paid-in Capital or Cash.',
      },
      solution: [
        row('t1', 'Close revenues', dr('sales-revenue', 4000), dr('interest-income', 30), cr('retained-earnings', 4030)),
        row('t2', 'Close expenses', dr('retained-earnings', 3000), cr('wages-expense', 1500), cr('rent-expense', 1500)),
        row('t3', 'Close dividends', dr('retained-earnings', 500), cr('dividends', 500)),
      ],
    },
    {
      id: 'rv-mc-fbo',
      sectionId: 'review',
      kind: 'multiple-choice',
      title: 'FBO facts',
      role: 'review',
      difficulty: 2,
      multi: true,
      prompt: 'Which statements about Zap’s FBO account are **true**? Select all that apply.',
      hints: ['Whose money is in the account, and what may Zap use it for?', 'What does pass-through deposit insurance protect against — the bank failing, or the fintech failing?'],
      explanation:
        'The FBO account holds customers’ money for their benefit; Zap can direct it but not spend it on its own bills. Under the gross-up model it appears as a restricted asset with an equal liability, so loads don’t change Zap’s equity. Pass-through insurance (when titling and records are right) protects against the **bank’s** failure — not Zap’s. And the bank sees one pooled balance; only Zap’s ledger knows each customer’s share.',
      options: [
        { text: 'The money is held for Zap’s customers; Zap may not use it to pay its own expenses.', correct: true, explanation: 'That’s the point of segregation.' },
        {
          text: 'Under the gross-up model, Zap shows the FBO cash as an asset and an equal liability to customers.',
          correct: true,
          explanation: 'Dr Cash: FBO / Cr Customer Balances Payable.',
        },
        {
          text: 'Pass-through FDIC insurance protects customers if Zap (the fintech) goes bankrupt.',
          correct: false,
          explanation: 'Deposit insurance covers the failure of the insured **bank**, and only passes through if the records are adequate. It doesn’t cover the fintech’s failure.',
        },
        { text: 'Zap’s equity increases when customers load money.', correct: false, explanation: 'Loads create equal assets and liabilities; equity is unchanged.' },
        {
          text: 'The bank knows each customer’s share of the FBO balance from its own books.',
          correct: false,
          explanation: 'The bank books one pooled deposit; per-customer balances live in Zap’s ledger.',
        },
      ],
    },
    {
      id: 'rv-zap-income-statement',
      sectionId: 'review',
      kind: 'statement-fill',
      title: 'Zap’s income statement',
      role: 'review',
      difficulty: 3,
      entityId: 'zap',
      statement: 'income-statement',
      prompt:
        'Here are some of Zap’s transactions for the month. Fill in the **income statement**: every revenue and expense account’s balance for the month. Customer money flows are a trap — think about which rows touch Zap’s own earnings and costs.',
      hints: [
        'A load moves money into the FBO account and creates a liability. Revenue?',
        'In a P2P payment with a fee, which part is Zap’s?',
        'Costs incurred this month are expenses even if they haven’t been paid yet.',
      ],
      explanation:
        '| Line | Amount |\n|---|---|\n| Transaction Fee Revenue (2 + 1) | 3 |\n| Salaries Expense | (8,000) |\n| Processing Expense | (45) |\n| **Net loss** | **(8,042)** |\n\nThe $500 load and the $100 and $30 transfers are customer money — liabilities, not revenue. Only the fees are Zap’s.',
      opening: bs({ 'cash-operating': 50000, 'cash-fbo': 600, 'cbp-bob': 300, 'cbp-carol': 300, 'paid-in-capital': 50000 }),
      rows: [
        row('t1', 'Alice loads $500', dr('cash-fbo', 500), cr('cbp-alice', 500)),
        row('t2', 'Alice pays Bob $100 + $2 fee', dr('cbp-alice', 102), cr('cbp-bob', 100), cr('transaction-fee-revenue', 2)),
        row('t3', 'Bob pays Carol $30 + $1 fee', dr('cbp-bob', 31), cr('cbp-carol', 30), cr('transaction-fee-revenue', 1)),
        row('t4', 'Pay salaries', dr('salaries-expense', 8000), cr('cash-operating', 8000)),
        row('t5', 'Processor invoice received', dr('processing-expense', 45), cr('accounts-payable', 45)),
      ],
      answer: { balanceSheet: bs({ 'transaction-fee-revenue': 3, 'salaries-expense': 8000, 'processing-expense': 45 }) },
    },
  ],
};
export default mod;
