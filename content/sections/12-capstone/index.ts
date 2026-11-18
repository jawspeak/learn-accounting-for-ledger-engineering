import type { BalanceSheet, Posting, SectionModule, TransactionRow } from '@contracts';

/** Owned by C2. Amounts below are written in whole dollars and converted to cents. */
const usd = (d: number) => d * 100;
const dr = (accountId: string, d: number): Posting => ({ accountId, side: 'dr', amount: usd(d) });
const cr = (accountId: string, d: number): Posting => ({ accountId, side: 'cr', amount: usd(d) });
const row = (id: string, label: string, ...postings: Posting[]): TransactionRow => ({ id, label, postings });
const bs = (o: Record<string, number>): BalanceSheet => ({
  lines: Object.entries(o).map(([accountId, d]) => ({ accountId, amount: usd(d) })),
});

/** Zap's chart of accounts as the accounting team would hand it to engineering. */
const zapCoaTable = `
| No. | Account name | Type | Normal | Notes |
|---|---|---|---|---|
| 1010 | Cash – Operating | Asset | Dr | Zap’s own bank account |
| 1020 | Cash – FBO (Restricted) | Asset | Dr | Customer funds at First Example Bank |
| 1030 | Cash in Transit – Incoming ACH | Asset | Dr | Incoming ACH not yet landed |
| 1100 | Settlement Receivable | Asset | Dr | Debit-card top-ups owed by the card processor |
| 1200 | Interest Receivable | Asset | Dr | |
| 1300 | Prepaid Expenses | Asset | Dr | |
| 2000 | Customer Balances Payable (control) | Liability | Cr | Total of 2010–2012; the one line on the balance sheet (not postable) |
| 2010 | Customer Balances Payable – Alice | Liability | Cr | Sub-ledger of 2000 control |
| 2011 | Customer Balances Payable – Bob | Liability | Cr | Sub-ledger of 2000 control |
| 2012 | Customer Balances Payable – Carol | Liability | Cr | Sub-ledger of 2000 control |
| 2100 | Clearing – Pending ACH Cash-outs | Liability | Cr | Should be 0 after settlement |
| 2200 | Suspense | Liability | Cr | Unmatched receipts; clear daily |
| 2300 | Accounts Payable | Liability | Cr | Invoices received |
| 2400 | Accrued Expenses | Liability | Cr | Incurred, not yet invoiced |
| 3010 | Paid-in Capital | Equity | Cr | |
| 3020 | Retained Earnings | Equity | Cr | |
| 4010 | Transaction Fee Revenue | Revenue | Cr | |
| 4020 | Interchange Revenue | Revenue | Cr | |
| 4030 | Interest Income | Revenue | Cr | Operating account only |
| 5010 | Processing Expense | Expense | Dr | ACH / card processor costs |
| 6010 | Salaries Expense | Expense | Dr | |
| 6020 | Cloud Hosting Expense | Expense | Dr | |
| 6030 | Fraud & Chargeback Losses | Expense | Dr | |
`;

const primer = `
Engineers usually meet a [[Chart of Accounts]] in one of two ways: **designing** one for a new product, or **receiving** one from the accounting team as a spreadsheet. Both are skills.

**Designing a CoA from business activities**
1. List the **events** the business has: money in, money out, money between customers, fees, costs, errors.
2. For each event ask the five questions: what do we **own**? what do we **owe**? what is **owners’** money? what do we **earn**? what do we **use up**?
3. Name accounts by **economic meaning**, not by system or vendor (*Clearing – Pending ACH Cash-outs*, not *Stripe pending*).
4. Separate what must be separated: restricted vs. operating cash, money in flight, unidentified money.
5. Leave out what the business doesn’t do — a P2P app has no [[inventory]].

**Reading an accountant’s CoA table**
- The **number** encodes the type: 1xxx assets, 2xxx liabilities, 3xxx equity, 4xxx revenue, 5xxx–6xxx expenses. Lower numbers within a group are usually more liquid / more operational.
- **Type** and **[[normal balance]]** columns tell you everything you need to pick Dr or Cr. Trust them over the name ("[[Unearned Revenue]]" is a liability).
- Notes like *“[[sub-ledger]] of 2000”* mean many detailed accounts roll up into one **[[control account]]** on the financial statements.

Here is Zap’s chart, as its controller would send it:
${zapCoaTable}
`;

const lens = `
**Ledger-engineer's lens: the CoA is a schema**

- An account is a row: \`(id, number, name, type, normal_side, parent_id, currency, restricted)\`. [[Postings]] reference account ids, never names.
- **Type is effectively immutable** once postings exist — retyping an account silently changes every historical report. Treat it like a schema migration.
- Adding accounts is cheap; splitting one later (e.g. one *Cash* into *Operating* and *FBO*) means reclassifying history. Design the obvious splits up front.
- Keep high-cardinality detail (one wallet per user) in a **sub-ledger** keyed by customer, rolling up to a GL **control account**. Reconcile Σ sub-ledger = control account continuously.
- Encode [[invariants]] next to the schema: *[[clearing accounts]] settle to zero*, *Suspense ages out*, *Cash – FBO (+ in-flight receipts) = customer balances + pending cash-outs + suspense + unswept fees*.
`;

const callouts = [
  {
    title: 'Why the number ranges matter',
    body: `Account numbers let reports group accounts by range (all 1xxx = assets) and let accountants add new accounts in the right place (e.g. 1040 between 1030 and 1100). If your [[ledger]] stores accounts by id only, store the number too — finance will ask for reports ordered and grouped by it.`,
  },
];

const mod: SectionModule = {
  section: {
    id: '12-capstone',
    number: 12,
    title: 'Capstone: Chart of Accounts Design',
    summary: 'Design Zap’s chart of accounts, book from an accountant’s CoA table, and spot what’s missing.',
    primer,
    lens,
    callouts,
    problemIds: [
      '12-table-hosting',
      '12-table-card-topup',
      '12-coa-design-zap',
      '12-table-month',
      '12-mc-whats-missing',
      '12-mc-misclassified',
      '12-classify-zap',
      '12-rv-bad-debt',
      '12-rv-bank-cashout',
    ],
  },
  problems: [
    {
      id: '12-table-hosting',
      sectionId: '12-capstone',
      kind: 'booking',
      title: 'Booking from the CoA table: the hosting bill',
      role: 'worked',
      difficulty: 1,
      entityId: 'zap',
      prompt: `Using Zap’s chart of accounts below, book this event: Zap pays its **$2,000** cloud hosting bill for this month from its **operating** account.\n${zapCoaTable}`,
      hints: [
        'Find the account you’re sure about in the table. Which cash account pays Zap’s own bills?',
        'Read the "Type" and "Normal" columns: a 1xxx asset decreasing goes on which side?',
        'What does the money pay for — something used up this month? Look in the 5xxx–6xxx range.',
      ],
      walkthrough: [
        '**Start from the account you know.** Zap pays from its own money: **1010 Cash – Operating** (Asset, normal Dr). It decreases → **credit** 2,000.',
        'Never touch **1020 Cash – FBO** for Zap’s own bills — that’s customers’ money.',
        'The debit side: this month’s hosting is used up this month → an expense. Scanning the 6xxx range: **6020 Cloud Hosting Expense** (Expense, normal Dr) → **debit** 2,000.',
        'Row balances: Dr 2,000 = Cr 2,000. The table’s "Normal" column did the Dr/Cr work for you.',
      ],
      explanation:
        '**Dr 6020 Cloud Hosting Expense 2,000 / Cr 1010 Cash – Operating 2,000.** The table tells you each account’s type and normal side; increase on the normal side, decrease on the opposite. Paying from Cash – FBO would be spending customer money — exactly what segregation forbids.',
      showBalanceSheets: true,
      journalView: true,
      opening: bs({ 'cash-operating': 50000, 'paid-in-capital': 50000 }),
      trapAccounts: [
        {
          id: 'hosting-payable',
          name: 'Hosting Payable',
          type: 'liability',
          trap: { kind: 'near-synonym', explanation: 'The bill was paid now, so no liability is involved — and the table has no such account.' },
        },
        {
          id: 'hosting-revenue',
          name: 'Cloud Services Revenue',
          type: 'revenue',
          trap: { kind: 'counterparty', explanation: 'That’s the **cloud provider’s** revenue. For Zap, hosting is **6020 Cloud Hosting Expense**.' },
        },
      ],
      diagnosticExplanations: {
        EXTRA_ACCOUNT: 'Zap pays its own bills from **1010 Cash – Operating**. 1020 Cash – FBO holds customer money and must never pay Zap’s expenses.',
        WRONG_SIDE: 'Check the "Normal" column: an asset decreasing is a **credit**; an expense increasing is a **debit**.',
      },
      solution: [row('t1', 'Pay hosting bill', dr('hosting-expense', 2000), cr('cash-operating', 2000))],
    },
    {
      id: '12-table-card-topup',
      sectionId: '12-capstone',
      kind: 'booking',
      title: 'Booking from the CoA table: a debit-card top-up',
      role: 'faded',
      difficulty: 2,
      entityId: 'zap',
      prompt: `Carol tops up her wallet with **$300** using her **debit card**. Zap credits her wallet instantly; the card processor will pay the money into the **FBO account** the next day.\n\nRow 1 (the top-up) is booked. Book **row 2**: the processor settles $300 into the FBO account.\n${zapCoaTable}`,
      hints: [
        'Look at row 1: what did Zap record the processor owes it?',
        'When the processor pays, which asset goes away and which asset (careful: which **cash** account?) goes up?',
      ],
      explanation:
        '**Row 1:** Dr 1100 Settlement Receivable 300 / Cr 2012 Customer Balances Payable – Carol 300 — Carol’s balance is credited immediately, while the money is owed by the processor.\n\n**Row 2: Dr 1020 Cash – FBO 300 / Cr 1100 Settlement Receivable 300.** The receivable becomes cash — in the **FBO** account, because it’s Carol’s money. No change to Carol’s balance in row 2.\n\nBetween rows 1 and 2, Cash – FBO (1,000) is $300 short of customer balances (1,300); the gap is the Settlement Receivable. Reconciliations include in-flight receivables, and many fintechs pre-fund the FBO account from operating cash so that customer balances are always fully backed.',
      showBalanceSheets: true,
      journalView: true,
      opening: bs({ 'cash-operating': 50000, 'cash-fbo': 1000, 'cbp-alice': 600, 'cbp-bob': 400, 'paid-in-capital': 50000 }),
      prefill: { locked: true, rows: [row('t1', 'Carol tops up by debit card', dr('settlement-receivable', 300), cr('cbp-carol', 300))] },
      trapAccounts: [
        {
          id: 'processor-payable',
          name: 'Due to Card Processor',
          type: 'liability',
          trap: { kind: 'other', explanation: 'Zap doesn’t owe the processor here — the processor owes Zap (1100 Settlement Receivable) until it pays.' },
        },
        {
          id: 'topup-revenue',
          name: 'Top-up Revenue',
          type: 'revenue',
          trap: { kind: 'other', explanation: 'A top-up is customer money — a liability to Carol, never revenue.' },
        },
      ],
      diagnosticExplanations: {
        EXTRA_ACCOUNT:
          'The settlement is Carol’s money, so it lands in **1020 Cash – FBO**, not 1010 Operating. 1030 Cash in Transit is for incoming **ACH**, not card settlements.',
      },
      solution: [
        row('t1', 'Carol tops up by debit card', dr('settlement-receivable', 300), cr('cbp-carol', 300)),
        row('t2', 'Processor settles into FBO', dr('cash-fbo', 300), cr('settlement-receivable', 300)),
      ],
    },
    {
      id: '12-coa-design-zap',
      sectionId: '12-capstone',
      kind: 'coa-design',
      title: 'Design Zap’s chart of accounts',
      role: 'practice',
      difficulty: 3,
      prompt:
        'You’re the first ledger engineer at **Zap**. The business:\n\n- Customers load money by ACH; it’s held in an **FBO account** at First Example Bank. Zap’s own money is in a separate operating account.\n- Customers pay each other instantly inside the app.\n- Customers cash out by ACH, which takes **two days** to settle.\n- Zap charges a fee for instant transfers.\n- Occasionally money arrives that can’t be matched to a customer.\n- Zap earns interest on its operating account, pays an ACH processor, and pays salaries.\n- Zap was funded by investors.\n\nFor each candidate account: **include** it or not, and if included, assign its **type**.',
      hints: [
        'Walk through each bullet and ask: own, owe, owners’, earn, use up?',
        'Customer money: one asset for where it sits, one liability for whom it’s owed to. In-flight and unmatched money need their own homes.',
        'Leave out accounts for things Zap doesn’t do — it sells no goods and makes no loans.',
      ],
      explanation:
        '**Include:** Cash – Operating (asset), Cash – FBO (Restricted) (asset), Customer Balances Payable (liability), Clearing – Pending ACH Cash-outs (liability), Suspense (liability), Paid-in Capital (equity), Retained Earnings (equity), Transaction Fee Revenue (revenue), Interest Income (revenue), Processing Expense (expense), Salaries Expense (expense).\n\n**Exclude:** Inventory and Cost of Goods Sold (Zap sells no goods), Loans Receivable (Zap doesn’t lend), Customer Deposits (that’s a bank’s liability; Zap isn’t a bank and shouldn’t describe balances as deposits), Unearned Revenue – Gift Cards (no gift cards).',
      candidates: [
        { name: 'Cash – Operating', answerType: 'asset', required: true, explanation: 'Zap’s own money; pays salaries and vendors.' },
        { name: 'Cash – FBO (Restricted)', answerType: 'asset', required: true, explanation: 'Customer funds at the bank — must be separate from operating cash.' },
        { name: 'Customer Balances Payable', answerType: 'liability', required: true, explanation: 'What Zap owes customers — the other half of the gross-up.' },
        {
          name: 'Clearing – Pending ACH Cash-outs',
          answerType: 'liability',
          required: true,
          explanation: 'Cash-outs take two days: money deducted from wallets but not yet out of the FBO account needs a home.',
        },
        { name: 'Suspense', answerType: 'liability', required: true, explanation: 'Unmatched incoming money is owed to someone not yet identified.' },
        { name: 'Paid-in Capital', answerType: 'equity', required: true, explanation: 'Investor funding.' },
        { name: 'Retained Earnings', answerType: 'equity', required: true, explanation: 'Every company accumulates profits (or losses) here.' },
        { name: 'Transaction Fee Revenue', answerType: 'revenue', required: true, explanation: 'Instant-transfer fees.' },
        { name: 'Interest Income', answerType: 'revenue', required: true, explanation: 'Interest on the operating account.' },
        { name: 'Processing Expense', answerType: 'expense', required: true, explanation: 'The ACH processor’s charges.' },
        { name: 'Salaries Expense', answerType: 'expense', required: true, explanation: 'Payroll.' },
        { name: 'Inventory', answerType: 'asset', required: false, explanation: 'Zap sells no physical goods.' },
        { name: 'Cost of Goods Sold', answerType: 'expense', required: false, explanation: 'No goods sold, so no COGS.' },
        { name: 'Loans Receivable', answerType: 'asset', required: false, explanation: 'Zap doesn’t lend money.' },
        {
          name: 'Customer Deposits',
          answerType: 'liability',
          required: false,
          explanation: 'Deposits are what a **bank** owes its depositors. Zap isn’t a bank; it owes customer balances (and should avoid "deposit" language).',
        },
        { name: 'Unearned Revenue – Gift Cards', answerType: 'liability', required: false, explanation: 'Zap sells no gift cards.' },
      ],
    },
    {
      id: '12-table-month',
      sectionId: '12-capstone',
      kind: 'booking',
      title: 'Booking from the CoA table: a slice of a month',
      role: 'practice',
      difficulty: 3,
      entityId: 'zap',
      prompt: `Using Zap’s chart below, book these four events in order:\n\n1. The ACH processor’s **invoice for $45** arrives (due in 30 days).\n2. Carol pays Alice **$100** with the instant option, which costs Carol a **$1** fee.\n3. End of day: Zap sweeps its **$1** of fees from the FBO account to its operating account.\n4. Zap pays the processor’s **$45** invoice from its operating account.\n${zapCoaTable}`,
      hints: [
        'Row 1: an invoice has arrived — 2300 or 2400? Read the Notes column.',
        'Row 2 is one compound row: Carol, Alice, and Zap’s fee.',
        'Rows 3 and 4: which cash account does each touch? Zap’s own money never stays in, or gets paid from, the FBO account.',
      ],
      explanation:
        '1. **Dr 5010 Processing Expense 45 / Cr 2300 Accounts Payable 45** — an invoice was received, so Accounts Payable (Accrued Expenses is for costs not yet invoiced).\n2. **Dr 2012 Carol 101 / Cr 2010 Alice 100 / Cr 4010 Transaction Fee Revenue 1.**\n3. **Dr 1010 Cash – Operating 1 / Cr 1020 Cash – FBO 1.**\n4. **Dr 2300 Accounts Payable 45 / Cr 1010 Cash – Operating 45.**\n\nCheck the FBO invariant afterwards: Cash – FBO 1,299 = Alice 700 + Bob 400 + Carol 199. ✓',
      showBalanceSheets: true,
      journalView: true,
      opening: bs({
        'cash-operating': 50000,
        'cash-fbo': 1300,
        'cbp-alice': 600,
        'cbp-bob': 400,
        'cbp-carol': 300,
        'paid-in-capital': 50000,
      }),
      trapAccounts: [
        {
          id: 'processor-revenue-12',
          name: 'Processing Revenue',
          type: 'revenue',
          trap: { kind: 'counterparty', explanation: 'That’s the processor’s revenue. For Zap it’s **5010 Processing Expense**.' },
        },
        {
          id: 'fee-expense-12',
          name: 'Instant Transfer Fee Expense',
          type: 'expense',
          trap: { kind: 'counterparty', explanation: 'That’s how **Carol** sees the fee. Zap earns it: **4010 Transaction Fee Revenue**.' },
        },
      ],
      diagnosticExplanations: {
        EXTRA_ACCOUNT:
          'Row 1 uses **2300 Accounts Payable** because the invoice has arrived. Rows 3–4: Zap’s fees and bills move through **1010 Cash – Operating**; the FBO account only gives up the swept $1.',
        WRONG_AMOUNT: 'Row 2: Carol pays 100 + 1 fee = **101**; Alice receives **100**; Zap earns **1**.',
        SPLIT_ENTRY: 'Carol’s payment and its fee are one event — one compound row.',
      },
      solution: [
        row('t1', 'Processor invoice received', dr('processing-expense', 45), cr('accounts-payable', 45)),
        row('t2', 'Carol pays Alice $100 + $1 fee', dr('cbp-carol', 101), cr('cbp-alice', 100), cr('transaction-fee-revenue', 1)),
        row('t3', 'Sweep fees to operating', dr('cash-operating', 1), cr('cash-fbo', 1)),
        row('t4', 'Pay processor', dr('accounts-payable', 45), cr('cash-operating', 45)),
      ],
    },
    {
      id: '12-mc-whats-missing',
      sectionId: '12-capstone',
      kind: 'multiple-choice',
      title: 'What’s missing from this CoA?',
      role: 'practice',
      difficulty: 3,
      multi: true,
      prompt:
        'A contractor drafted this chart of accounts for Zap (customer funds in an FBO account, ACH cash-outs that take two days to settle, and occasional unmatched incoming wires):\n\n| No. | Account | Type |\n|---|---|---|\n| 1000 | Cash | Asset |\n| 2000 | Customer Balances Payable | Liability |\n| 3000 | Paid-in Capital | Equity |\n| 3100 | Retained Earnings | Equity |\n| 4000 | Transaction Fee Revenue | Revenue |\n| 5000 | Processing Expense | Expense |\n| 5100 | Salaries Expense | Expense |\n\nWhich accounts does Zap **need to add**? Select all that apply.',
      hints: [
        'Where would you book a cash-out on Monday that settles on Wednesday?',
        'Can one "Cash" account keep customer money separate from Zap’s own?',
        'Where does a $75 wire from an unknown sender go?',
      ],
      explanation:
        'Zap needs **Cash – FBO (Restricted)** separate from operating cash (segregation; the FBO invariant), a **clearing** liability for pending ACH cash-outs (in-flight money), and **Suspense** for unmatched receipts. Inventory and gift-card liabilities don’t fit Zap’s business, and customer money is never revenue.',
      options: [
        { text: 'Split Cash into **Cash – Operating** and **Cash – FBO (Restricted)**', correct: true, explanation: 'Customer funds must be tracked separately from Zap’s own money.' },
        { text: '**Clearing – Pending ACH Cash-outs** (liability)', correct: true, explanation: 'Cash-outs are deducted from wallets two days before cash leaves the FBO account.' },
        { text: '**Suspense** (liability)', correct: true, explanation: 'Unmatched wires need a home until they’re identified.' },
        { text: '**Inventory** (asset)', correct: false, explanation: 'Zap sells no goods.' },
        { text: '**Customer Load Revenue** (revenue)', correct: false, explanation: 'Loaded money is owed back to customers — a liability, never revenue.' },
        { text: '**Unearned Revenue – Gift Cards** (liability)', correct: false, explanation: 'Zap doesn’t sell gift cards.' },
      ],
    },
    {
      id: '12-mc-misclassified',
      sectionId: '12-capstone',
      kind: 'multiple-choice',
      title: 'Spot the misclassified account',
      role: 'practice',
      difficulty: 2,
      multi: false,
      prompt:
        'An accountant’s CoA for a payments startup contains this row:\n\n| No. | Account | Type | Normal |\n|---|---|---|---|\n| 4050 | Customer Wallet Balances | Revenue | Cr |\n\nWhat’s wrong?',
      hints: ['Does the startup get to keep the money in customers’ wallets?', 'What range would the account number be in if the type were right?'],
      explanation:
        'Customer wallet balances are money the startup **owes** its customers — a **liability** (2xxx range), not revenue. Classifying them as revenue would wildly overstate income every time a customer loads money. The normal side (Cr) happens to be the same for liabilities and revenue, which is why this kind of error can go unnoticed in a trial balance.',
      options: [
        { text: 'It should be a **liability** (2xxx), because the startup owes the balances to customers.', correct: true, explanation: 'Customer money is owed back — a liability.' },
        { text: 'It should be an **asset**, because the startup holds the cash.', correct: false, explanation: 'The cash held is the asset (Cash – FBO). The balance owed to customers is the liability.' },
        { text: 'Its normal side should be **Dr**.', correct: false, explanation: 'Cr is right for a liability too — the problem is the type, not the side.' },
        { text: 'Nothing is wrong; wallet loads are revenue for a payments company.', correct: false, explanation: 'Only fees are revenue. Customer money is never the company’s income.' },
      ],
    },
    {
      id: '12-classify-zap',
      sectionId: '12-capstone',
      kind: 'classify',
      title: 'Classify Zap’s accounts',
      role: 'practice',
      difficulty: 2,
      prompt: 'Sort each account by type. All are in **Zap’s** books unless marked otherwise.',
      buckets: ['asset', 'liability', 'equity', 'revenue', 'expense'],
      hints: [
        'Clearing and suspense accounts hold money owed to someone — which type?',
        'The same FBO money appears in two sets of books with opposite types.',
      ],
      explanation:
        'Assets: Cash – FBO, Settlement Receivable. Liabilities: Customer Balances Payable, Clearing – Pending ACH Cash-outs, Suspense, and the bank’s Deposits – FBO Accounts. Equity: Paid-in Capital. Revenue: Transaction Fee Revenue, Interchange Revenue. Expense: Fraud & Chargeback Losses.',
      items: [
        { label: 'Cash – FBO (Restricted)', entityId: 'zap', answer: 'asset', explanation: 'Customer money Zap holds — a restricted asset.' },
        { label: 'Settlement Receivable', entityId: 'zap', answer: 'asset', explanation: 'Money the card processor owes Zap.' },
        { label: 'Customer Balances Payable', entityId: 'zap', answer: 'liability', explanation: 'What Zap owes its customers.' },
        { label: 'Clearing – Pending ACH Cash-outs', entityId: 'zap', answer: 'liability', explanation: 'Still owed until the ACH settles.' },
        { label: 'Suspense', entityId: 'zap', answer: 'liability', explanation: 'Owed to an as-yet-unidentified sender.' },
        { label: 'Paid-in Capital', entityId: 'zap', answer: 'equity', explanation: 'Investor funding.' },
        { label: 'Transaction Fee Revenue', entityId: 'zap', answer: 'revenue', explanation: 'Fees Zap earns.' },
        { label: 'Interchange Revenue', entityId: 'zap', answer: 'revenue', explanation: 'Zap’s share of card fees.' },
        { label: 'Fraud & Chargeback Losses', entityId: 'zap', answer: 'expense', explanation: 'A cost of running a payments business.' },
        {
          label: 'Deposits – FBO Accounts (in First Example Bank’s books)',
          entityId: 'bank',
          answer: 'liability',
          explanation: 'The bank owes the FBO balance — its liability, Zap’s asset.',
        },
      ],
    },
    {
      id: '12-rv-bad-debt',
      sectionId: '12-capstone',
      kind: 'booking',
      title: 'Review: Bean There’s bad-debt estimate',
      role: 'review',
      difficulty: 2,
      entityId: 'coffee',
      prompt:
        'Bean There’s catering clients owe **$1,600**. Maya expects **5%** won’t be collected and has no allowance yet. Record the month-end estimate.',
      hints: ['5% of $1,600 is…?', 'The expense goes to this month. Which contra account holds the estimate?'],
      explanation:
        '**Dr Bad Debt Expense 80 / Cr Allowance for Doubtful Accounts 80.** The estimate is expensed now; the contra-asset reduces receivables to their expected net value (1,600 − 80 = 1,520) without touching any specific client’s invoice.',
      showBalanceSheets: true,
      opening: bs({ cash: 1000, 'accounts-receivable': 1600, 'paid-in-capital': 2600 }),
      trapAccounts: [
        {
          id: 'doubtful-payable-12',
          name: 'Doubtful Accounts Payable',
          type: 'liability',
          trap: { kind: 'near-synonym', explanation: 'Nobody is owed anything. The estimate reduces receivables via the contra-asset **Allowance for Doubtful Accounts**.' },
        },
        {
          id: 'uncollectible-revenue-12',
          name: 'Uncollectible Sales Revenue',
          type: 'contra-revenue',
          contraOf: 'sales-revenue',
          trap: { kind: 'other', explanation: 'Credit losses are an **expense** (Bad Debt Expense), not a reduction of sales.' },
        },
      ],
      diagnosticExplanations: {
        EXTRA_ACCOUNT: 'Don’t credit Accounts Receivable — you don’t know which client will default. Use the **Allowance**.',
        WRONG_AMOUNT: '5% × 1,600 = **80**.',
      },
      solution: [row('t1', 'Estimate bad debts', dr('bad-debt-expense', 80), cr('allowance-doubtful', 80))],
    },
    {
      id: '12-rv-bank-cashout',
      sectionId: '12-capstone',
      kind: 'booking',
      title: 'Review: a cash-out leaves the bank',
      role: 'review',
      difficulty: 2,
      entityId: 'bank',
      prompt:
        'Bob’s **$50** Zap cash-out settles: First Example Bank sends $50 by ACH from **Zap’s FBO account** to Bob’s account at another bank (settling through the Fed). Book it in the **bank’s** books.',
      hints: ['Which deposit account at First Example Bank goes down?', 'The money leaves for another bank. Which bank asset goes with it?'],
      explanation:
        '**Dr Deposits – FBO Accounts 50 / Cr Reserves at the Federal Reserve 50.** The bank owes less on the FBO account, and its reserves fall as the ACH settles to the other bank. In Zap’s books, the same settlement is Dr Clearing – Pending ACH Cash-outs / Cr Cash – FBO.',
      showBalanceSheets: true,
      opening: bs({
        'reserves-fed': 10000,
        'deposits-business': 5850,
        'deposits-fbo': 150,
        'paid-in-capital': 3000,
        'retained-earnings': 1000,
      }),
      trapAccounts: [
        {
          id: 'zap-clearing-trap',
          name: 'Clearing – Pending ACH Cash-outs',
          type: 'liability',
          trap: { kind: 'counterparty', explanation: 'That clearing account lives in **Zap’s** books. The bank just sees its FBO deposit and its reserves go down.' },
        },
        {
          id: 'bob-deposit-trap',
          name: 'Customer Balances Payable – Bob',
          type: 'liability',
          trap: { kind: 'counterparty', explanation: 'Bob’s wallet is in **Zap’s** sub-ledger. The bank only knows the pooled FBO account.' },
        },
      ],
      diagnosticExplanations: {
        EXTRA_ACCOUNT:
          'It’s the **FBO** deposit that shrinks (not Business Deposits), and the money leaves electronically through **reserves**, not vault cash.',
        WRONG_SIDE: 'The deposit liability decreases (debit); reserves decrease (credit).',
      },
      solution: [row('t1', 'ACH out of Zap FBO', dr('deposits-fbo', 50), cr('reserves-fed', 50))],
    },
  ],
};
export default mod;
