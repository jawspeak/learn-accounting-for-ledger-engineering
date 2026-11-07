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
Meet **Bean There Coffee Co.**, a small café owned by Maya. From now on we're in a **company's** books, and a company is a separate entity from its owner: Maya's personal savings are not Bean There's cash.

**Revenue** and **expenses** are not new kinds of thing — they are *sub-accounts of equity* with a time window:

\`\`\`
Assets = Liabilities + Paid-in Capital + Retained Earnings + Revenue − Expenses − Dividends
\`\`\`

- **Revenue** (Cr-normal): value Bean There *earns* by selling coffee. It increases equity, so it increases on the credit side.
- **Expenses** (Dr-normal): value *used up* to earn revenue — rent, wages, beans consumed. They decrease equity, so they increase on the debit side.
- **Dividends / Owner Draws** (Dr-normal): profit handed to the owner. Not an expense — it isn't a cost of running the café.

The **income statement** for a period is just *Revenue − Expenses = Net Income*, read off those accounts. At period end, **closing entries** move each revenue and expense balance (and dividends) into **Retained Earnings**, so the next month starts at zero.

Two Bean There conventions to know:
- Bean There is a small corporation: Maya's investment goes to **Paid-in Capital**, and money she takes out goes to **Dividends (Owner Draws)**. (In a sole proprietorship the same accounts are called Owner's Capital and Owner's Draws — identical mechanics.)
- Beans and cups are bought into **Inventory**. At month-end Maya counts what's left, and what was used becomes **Cost of Goods Sold**. So a sale only touches cash/receivables and Sales Revenue.

Keep using the move: **start from the account you're sure about**, decide up or down, let its normal balance pick Dr or Cr, then balance the row.
`;

const lens = `
**Ledger-engineer's lens: revenue, expenses and closing**

- Revenue and expense accounts are just equity sub-accounts with a reporting window. The income statement is a *query*: \`SUM(postings) WHERE account.type IN (revenue, expense) AND date IN period\`.
- **Closing** is a period-end batch job that posts new entries zeroing those accounts into Retained Earnings. It never deletes or edits postings — history stays immutable.
- Many modern ledgers skip physical closing entries and *derive* Retained Earnings from all prior-period P&L postings. Either way, the invariant holds: after closing, every temporary account's balance for the new period starts at zero.
- Card sales are your first **in-flight money**: the sale is done, but the cash hasn't arrived. \`Card Receivables\` is the state of that money between "authorized" and "settled".
`;

const callouts = [
  {
    title: 'The business is not the owner',
    body: `Accountants call this the **entity concept**. When Maya moves $20,000 from her personal account into Bean There, *her* books lose an asset and gain an investment; *Bean There's* books gain cash and owe her equity (Paid-in Capital). We only ever book one entity's side at a time — and here it's Bean There's.`,
  },
  {
    title: 'Why are expenses debits?',
    body: `Expenses reduce equity, and equity is credit-normal — so reducing it is a debit. Rather than debiting Retained Earnings directly every time we pay rent, we collect the debits in a separate **Rent Expense** account so we can report them. Same math, better information.`,
  },
];

const mod: SectionModule = {
  section: {
    id: '07-revenue-expenses',
    number: 7,
    title: 'Revenue, Expenses & Closing',
    summary: 'Coffee Co. earns and spends; the income statement and closing.',
    primer,
    lens,
    callouts,
    problemIds: [
      '07-owner-invests',
      '07-supplies-on-credit',
      '07-cash-sales',
      '07-card-sales',
      '07-pay-rent',
      '07-pay-supplier',
      '07-owner-draw',
      '07-income-statement',
      '07-closing-entries',
      '07-rv-bank-till-deposit',
      '07-rv-classify-coffee',
    ],
  },
  problems: [
    {
      id: '07-owner-invests',
      sectionId: '07-revenue-expenses',
      kind: 'booking',
      title: 'Maya invests $20,000',
      role: 'worked',
      difficulty: 1,
      entityId: 'coffee',
      prompt:
        'Maya opens **Bean There Coffee Co.** by transferring **$20,000** of her own money into the company’s bank account in exchange for ownership. Book this in **Bean There’s** books.',
      hints: [
        'Whose books are we in? Bean There’s — not Maya’s. Which of Bean There’s accounts are you sure changes?',
        'Bean There now has more Cash. Cash is an Asset — which side increases an Asset?',
        'Is this money a loan Bean There must repay, or ownership? What equity account records what owners put in?',
      ],
      walkthrough: [
        '**Start from the account you know.** Bean There’s bank balance goes up by $20,000. That is **Cash**, an Asset.',
        'Assets are debit-normal, so an increase is a **debit**: Dr Cash 20,000.',
        'The row must balance, so something is credited $20,000. What did Bean There give in exchange? Not a promise to repay (that would be a liability) — it gave Maya **ownership**.',
        'Owner investment is recorded in **Paid-in Capital** (Equity, credit-normal): Cr Paid-in Capital 20,000.',
        'Check the equation: Assets +20,000 = Liabilities 0 + Equity +20,000. ✓ No revenue — Bean There didn’t *earn* this money.',
      ],
      explanation:
        '**Dr Cash 20,000 / Cr Paid-in Capital 20,000.** Cash (Asset) increases on the debit side. The source of the money is the owner, in exchange for ownership, so equity increases: Paid-in Capital is credit-normal and increases on the credit side.\n\nIt is **not revenue** — revenue is earned by selling goods or services to customers. And it is **not a liability** — Bean There doesn’t have to pay it back on a schedule. If Maya had *lent* the money, Bean There would credit a Loan Payable instead.',
      showBalanceSheets: true,
      opening: bs({}),
      trapAccounts: [
        {
          id: 'owner-loan-payable',
          name: 'Loan Payable – Owner',
          type: 'liability',
          trap: {
            kind: 'near-synonym',
            explanation:
              'A loan must be repaid on agreed terms. Maya invested in exchange for **ownership** — that’s equity (**Paid-in Capital**), not a liability.',
          },
        },
        {
          id: 'maya-personal-savings',
          name: 'Maya’s Personal Savings',
          type: 'asset',
          trap: {
            kind: 'counterparty',
            explanation:
              'That account lives in **Maya’s** personal books, not Bean There’s. The company is a separate entity — we book only the company’s side.',
          },
        },
      ],
      diagnosticExplanations: {
        MISSING_ACCOUNT:
          'Both sides of this entry must appear: the asset Bean There received and the equity it gave in return.',
        EXTRA_ACCOUNT:
          'Investment by the owner is not revenue — Bean There didn’t sell anything. Use **Paid-in Capital**.',
        WRONG_SIDE: 'Cash (an Asset) increases on the **debit** side; Paid-in Capital (Equity) increases on the **credit** side.',
      },
      solution: [row('t1', 'Owner invests cash', dr('cash', 20000), cr('paid-in-capital', 20000))],
    },
    {
      id: '07-supplies-on-credit',
      sectionId: '07-revenue-expenses',
      kind: 'booking',
      title: 'Buying beans on credit',
      role: 'faded',
      difficulty: 1,
      entityId: 'coffee',
      prompt:
        'Row 1 is done for you: Bean There bought **$800 of coffee beans** from Roastery Ridge, to be paid in 30 days.\n\nNow book **row 2**: the next day, Bean There buys **$300 of milk, cups and lids** from the same supplier, also on 30-day terms.',
      hints: [
        'Look at row 1 — what did Bean There receive, and what does it owe?',
        'Milk and cups go into the same asset as beans: they haven’t been used up yet.',
        'Nothing was paid today. Which liability records a bill you’ll pay later?',
      ],
      explanation:
        '**Dr Inventory – Beans & Supplies 300 / Cr Accounts Payable 300.** Bean There gained an asset (supplies it hasn’t used yet) and a liability (it owes the supplier). No cash moved, and no expense yet — the supplies become **Cost of Goods Sold** only when they’re used up (we record that at the month-end count).',
      showBalanceSheets: true,
      opening: bs({ cash: 20000, 'paid-in-capital': 20000 }),
      prefill: {
        locked: true,
        rows: [row('t1', 'Beans on credit', dr('inventory', 800), cr('accounts-payable', 800))],
      },
      trapAccounts: [
        {
          id: 'supplies-expense',
          name: 'Supplies Expense',
          type: 'expense',
          trap: {
            kind: 'near-synonym',
            explanation:
              'Bean There’s policy is to put purchases into **Inventory** and expense them as COGS when they’re used (the month-end count). Unused cups on the shelf are still an asset.',
          },
        },
        {
          id: 'roastery-sales-revenue',
          name: 'Roastery Ridge – Sales Revenue',
          type: 'revenue',
          trap: {
            kind: 'counterparty',
            explanation: 'That’s the **supplier’s** revenue, in the supplier’s books. In Bean There’s books, the purchase creates an Account Payable.',
          },
        },
      ],
      diagnosticExplanations: {
        EXTRA_ACCOUNT: 'No cash changed hands today — the supplier gave 30-day terms. Use **Accounts Payable** instead of Cash.',
        WRONG_SIDE: 'Inventory (Asset) increases with a **debit**; Accounts Payable (Liability) increases with a **credit**.',
      },
      solution: [
        row('t1', 'Beans on credit', dr('inventory', 800), cr('accounts-payable', 800)),
        row('t2', 'Milk, cups and lids on credit', dr('inventory', 300), cr('accounts-payable', 300)),
      ],
    },
    {
      id: '07-cash-sales',
      sectionId: '07-revenue-expenses',
      kind: 'booking',
      title: 'A day of cash sales',
      role: 'practice',
      difficulty: 1,
      entityId: 'coffee',
      prompt: 'On Saturday, Bean There sells **$600** of coffee and pastries, all paid in **cash**. Book the day’s sales as one entry.',
      hints: [
        'Which account are you sure about? The till has more cash in it.',
        'Cash is up — Dr. What did Bean There *give* in exchange for the cash?',
        'Bean There earned this by delivering coffee. Which account type records value earned, and which side increases it?',
      ],
      explanation:
        '**Dr Cash 600 / Cr Sales Revenue 600.** Cash (Asset) increases → debit. Bean There earned the money by delivering coffee, so revenue increases → credit (revenue is credit-normal because it increases equity).\n\n(The beans used are recorded as Cost of Goods Sold at the month-end count — the sale itself only records what was earned.)',
      showBalanceSheets: true,
      opening: bs({ cash: 1000, 'paid-in-capital': 1000 }),
      trapAccounts: [
        {
          id: 'business-deposits-trap',
          name: 'Business Deposits',
          type: 'liability',
          trap: {
            kind: 'counterparty',
            explanation: '**Business Deposits** is the **bank’s** liability to Bean There. In Bean There’s own books, its money is an asset: Cash.',
          },
        },
        {
          id: 'customer-prepayments',
          name: 'Customer Prepayments',
          type: 'liability',
          trap: {
            kind: 'near-synonym',
            explanation:
              'A liability is right only when you’ve been paid *before* delivering (like a gift card). Here the coffee was handed over on the spot, so the revenue is **earned** now.',
          },
        },
      ],
      diagnosticExplanations: {
        WRONG_SIDE: 'Revenue increases equity, so it increases on the **credit** side; Cash increases on the **debit** side.',
        WRONG_TYPE: 'Sales Revenue is a **Revenue** account (credit-normal), not equity or an asset.',
        EXTRA_ACCOUNT:
          'Only two things happened: cash came in and revenue was earned. Cost of beans is handled at the month-end inventory count, not per sale.',
      },
      solution: [row('t1', 'Saturday cash sales', dr('cash', 600), cr('sales-revenue', 600))],
    },
    {
      id: '07-card-sales',
      sectionId: '07-revenue-expenses',
      kind: 'booking',
      title: 'Card sales and settlement',
      role: 'practice',
      difficulty: 2,
      entityId: 'coffee',
      prompt:
        '1. On Thursday Bean There sells **$400** of coffee paid by **card**. The card processor will deposit the money in two days.\n2. On Saturday the processor deposits **$388** into Bean There’s bank account — the $400 minus its **3% fee ($12)**.\n\nBook each event as its own row.',
      hints: [
        'Row 1: Revenue is earned on Thursday — the coffee was delivered. But did cash arrive? What does Bean There have instead?',
        'Card money in flight is a receivable from the processor: **Card Receivables (Cash in Transit)**.',
        'Row 2: The receivable is fully settled ($400 goes away), but only $388 arrives. Where do the missing $12 go?',
      ],
      explanation:
        '**Row 1: Dr Card Receivables 400 / Cr Sales Revenue 400.** Revenue is earned when the coffee is sold, regardless of when the cash arrives (accrual basis). Until settlement, the processor owes Bean There $400 — an asset.\n\n**Row 2: Dr Cash 388, Dr Card Processing Fees 12 / Cr Card Receivables 400.** The whole $400 receivable is settled. $388 arrives as cash; the $12 the processor kept is an **expense** of taking cards. Revenue stays at $400 — the fee is a cost, not a reduction of the sale.\n\n(Strictly the fee is incurred at the moment of sale; booking it at settlement two days later is a common simplification that doesn’t change the month’s totals.)',
      showBalanceSheets: true,
      opening: bs({ cash: 1000, 'paid-in-capital': 1000 }),
      trapAccounts: [
        {
          id: 'processor-fee-revenue',
          name: 'Merchant Processing Revenue',
          type: 'revenue',
          trap: {
            kind: 'counterparty',
            explanation: 'The fee is the **processor’s** revenue. In Bean There’s books it’s a cost: **Card Processing Fees** (Expense).',
          },
        },
        {
          id: 'sales-net-of-fees',
          name: 'Sales Revenue – Net of Fees',
          type: 'revenue',
          trap: {
            kind: 'near-synonym',
            explanation:
              'Record the sale at its full $400 in Sales Revenue and the fee separately as an expense. Netting them hides what processing actually costs.',
          },
        },
      ],
      diagnosticExplanations: {
        MISSING_ACCOUNT:
          'In row 2, three accounts change: Cash (+388), Card Processing Fees (+12) and Card Receivables (−400). It’s one event, so it’s one compound row.',
        WRONG_AMOUNT:
          'Card Receivables must go to zero — credit the full **400**. The difference between 400 and the 388 received is the **12** fee.',
        EXTRA_ACCOUNT:
          'On Thursday no cash arrived yet — use **Card Receivables (Cash in Transit)**. And Accounts Receivable is for invoiced catering customers, not card processors.',
        SPLIT_ENTRY: 'The settlement is one event: one deposit that clears the receivable and records the fee. Keep it in one compound row.',
      },
      solution: [
        row('t1', 'Card sales (Thursday)', dr('card-receivable', 400), cr('sales-revenue', 400)),
        row('t2', 'Processor settles, keeps 3% fee', dr('cash', 388), dr('card-fees', 12), cr('card-receivable', 400)),
      ],
    },
    {
      id: '07-pay-rent',
      sectionId: '07-revenue-expenses',
      kind: 'booking',
      title: 'Paying this month’s rent',
      role: 'practice',
      difficulty: 1,
      entityId: 'coffee',
      prompt: 'On the 1st, Bean There pays its landlord **$1,500** for **this month’s** rent from its bank account.',
      hints: [
        'Which account are you sure about? Cash goes down.',
        'Cash is an Asset, decreasing → credit. The debit side: did Bean There get an asset, pay off a debt, or use something up?',
        'The rent covers this month, which is being used up now. That’s an expense.',
      ],
      explanation:
        '**Dr Rent Expense 1,500 / Cr Cash 1,500.** Cash (Asset) decreases → credit. The rent pays for using the space *this month*, so it’s consumed in this period → **Rent Expense** (debit-normal, reduces equity).\n\nIf Bean There had paid for *future* months, the payment would be an asset (**Prepaid Rent**) until those months arrive — that’s §8.',
      showBalanceSheets: true,
      opening: bs({ cash: 5000, 'paid-in-capital': 5000 }),
      trapAccounts: [
        {
          id: 'rent-payable',
          name: 'Rent Payable',
          type: 'liability',
          trap: {
            kind: 'near-synonym',
            explanation: 'Rent Payable would record rent Bean There **owes but hasn’t paid**. Here it paid in cash on the day, so no liability is involved.',
          },
        },
        {
          id: 'rental-income',
          name: 'Rental Income',
          type: 'revenue',
          trap: {
            kind: 'counterparty',
            explanation: 'Rental Income lives in the **landlord’s** books. For Bean There, rent is a cost: **Rent Expense**.',
          },
        },
      ],
      diagnosticExplanations: {
        EXTRA_ACCOUNT:
          'Prepaid Rent is for rent paid **in advance** for future periods. This payment covers the current month, which is used up now → Rent Expense.',
        WRONG_SIDE: 'Expenses increase on the **debit** side (they reduce equity). Cash decreases on the **credit** side.',
      },
      solution: [row('t1', 'Pay this month’s rent', dr('rent-expense', 1500), cr('cash', 1500))],
    },
    {
      id: '07-pay-supplier',
      sectionId: '07-revenue-expenses',
      kind: 'booking',
      title: 'Paying the supplier',
      role: 'practice',
      difficulty: 1,
      entityId: 'coffee',
      prompt:
        'Thirty days after buying beans on credit, Bean There pays Roastery Ridge the **$800** it owes, by bank transfer. (The opening balance sheet shows the unpaid bill.)',
      hints: [
        'Which account are you sure about? Cash decreases.',
        'What else changes? Does Bean There still owe the supplier after paying?',
        'Was anything used up *today*? The beans were recorded when they arrived — paying the bill only settles the debt.',
      ],
      explanation:
        '**Dr Accounts Payable 800 / Cr Cash 800.** Cash (Asset) decreases → credit. The debt to the supplier is gone, so Accounts Payable (Liability) decreases → debit.\n\nNo expense today: the beans were recorded in Inventory when they arrived, and they become Cost of Goods Sold when they’re used. Paying a bill just swaps one balance-sheet item for another — assets and liabilities both shrink by $800, equity is untouched.',
      showBalanceSheets: true,
      opening: bs({ cash: 5000, inventory: 800, 'accounts-payable': 800, 'paid-in-capital': 5000 }),
      trapAccounts: [
        {
          id: 'purchases-expense',
          name: 'Purchases Expense',
          type: 'expense',
          trap: {
            kind: 'near-synonym',
            explanation:
              'The purchase was already recorded when the beans arrived (Dr Inventory / Cr Accounts Payable). Paying the bill only settles the liability — booking an expense now would count the beans twice.',
          },
        },
        {
          id: 'roastery-receivable',
          name: 'Receivable from Bean There',
          type: 'asset',
          trap: {
            kind: 'counterparty',
            explanation: 'That’s the **supplier’s** asset. In Bean There’s books the same debt is **Accounts Payable**.',
          },
        },
      ],
      diagnosticExplanations: {
        EXTRA_ACCOUNT:
          'Paying a bill isn’t an expense — the cost was captured when the beans arrived. Only Cash and the liability change.',
        WRONG_SIDE: 'Liabilities decrease on the **debit** side. Cash decreases on the **credit** side.',
        MISSING_ACCOUNT: 'Two things change: Cash goes down and the amount owed to the supplier goes down.',
      },
      solution: [row('t1', 'Pay supplier', dr('accounts-payable', 800), cr('cash', 800))],
    },
    {
      id: '07-owner-draw',
      sectionId: '07-revenue-expenses',
      kind: 'booking',
      title: 'Maya takes a draw',
      role: 'practice',
      difficulty: 2,
      entityId: 'coffee',
      prompt:
        'Business is good. Maya transfers **$1,000** from Bean There’s bank account to her personal account as a distribution of profits. She is not on the payroll — this is not a salary.',
      hints: [
        'Which account are you sure about? Bean There’s cash decreases.',
        'Is this a cost of running the café — like wages — or a payout of profit to the owner?',
        'Payouts to owners go to a Dr-normal account that reduces equity but is *not* an expense. (Remember DEALER: **D**ividends are Dr-normal.)',
      ],
      explanation:
        '**Dr Dividends (Owner Draws) 1,000 / Cr Cash 1,000.** Cash decreases → credit. The money goes to the owner as a share of profits, so it reduces equity through **Dividends**, which is debit-normal.\n\nIt is **not an expense**: it isn’t a cost of earning revenue, so it doesn’t appear on the income statement and doesn’t reduce net income. Wages paid to employees *are* expenses; distributions to owners are not. At period-end, Dividends is closed into Retained Earnings just like expenses are.',
      showBalanceSheets: true,
      opening: bs({ cash: 5000, 'paid-in-capital': 4000, 'retained-earnings': 1000 }),
      trapAccounts: [
        {
          id: 'owner-salary-expense',
          name: 'Owner Salary Expense',
          type: 'expense',
          trap: {
            kind: 'near-synonym',
            explanation:
              'Maya isn’t on payroll, and this is a distribution of profit — not a cost of running the café. Distributions go to **Dividends (Owner Draws)**, which never hits the income statement.',
          },
        },
        {
          id: 'owner-receivable',
          name: 'Receivable from Owner',
          type: 'asset',
          trap: {
            kind: 'other',
            explanation: 'A receivable would mean Maya has to pay it back. A draw is a permanent payout of profit.',
          },
        },
      ],
      diagnosticExplanations: {
        EXTRA_ACCOUNT:
          'Wages Expense is for employees’ pay. An owner’s distribution goes to **Dividends (Owner Draws)**. Debiting Paid-in Capital or Retained Earnings directly would skip the Dividends account the income statement and closing rely on.',
        WRONG_TYPE: 'Dividends (Owner Draws) has its own type: **Dividend** — debit-normal, reduces equity, but not an expense.',
      },
      solution: [row('t1', 'Owner draw', dr('dividends', 1000), cr('cash', 1000))],
    },
    {
      id: '07-income-statement',
      sectionId: '07-revenue-expenses',
      kind: 'statement-fill',
      title: 'Bean There’s first income statement',
      role: 'practice',
      difficulty: 2,
      entityId: 'coffee',
      statement: 'income-statement',
      prompt:
        'Here are all of Bean There’s transactions for October. Fill in the **income statement**: the balance of every revenue and expense account for the month. Leave out anything that isn’t revenue or expense.\n\nThen work out net income in your head.',
      hints: [
        'Only revenue and expense accounts belong on the income statement. Which of these rows touch one?',
        'Buying beans on credit didn’t create an expense — what did? (Look for the month-end count.)',
        'Is Maya’s $1,000 draw a cost of running the café?',
      ],
      explanation:
        '| Line | Amount |\n|---|---|\n| Sales Revenue (6,000 cash + 3,000 card) | 9,000 |\n| Cost of Goods Sold (month-end count) | (1,800) |\n| Wages Expense | (2,000) |\n| Rent Expense | (1,500) |\n| Card Processing Fees | (90) |\n| **Net Income** | **3,610** |\n\nNot on the income statement:\n- **Buying $1,000 of beans** — that’s Inventory (an asset) until used; the expense is the $1,800 COGS from the count.\n- **The $2,910 settlement** — it only converts Card Receivables into Cash (plus the fee).\n- **Maya’s $1,000 draw** — Dividends reduce equity but aren’t an expense.',
      opening: bs({ cash: 20000, inventory: 2000, 'paid-in-capital': 22000 }),
      rows: [
        row('t1', 'Beans on credit', dr('inventory', 1000), cr('accounts-payable', 1000)),
        row('t2', 'Cash sales for the month', dr('cash', 6000), cr('sales-revenue', 6000)),
        row('t3', 'Card sales for the month', dr('card-receivable', 3000), cr('sales-revenue', 3000)),
        row('t4', 'Card settlements, net of 3% fee', dr('cash', 2910), dr('card-fees', 90), cr('card-receivable', 3000)),
        row('t5', 'Pay October rent', dr('rent-expense', 1500), cr('cash', 1500)),
        row('t6', 'Pay baristas', dr('wages-expense', 2000), cr('cash', 2000)),
        row('t7', 'Month-end count: beans & supplies used', dr('cogs', 1800), cr('inventory', 1800)),
        row('t8', 'Owner draw', dr('dividends', 1000), cr('cash', 1000)),
      ],
      answer: {
        balanceSheet: bs({ 'sales-revenue': 9000, cogs: 1800, 'rent-expense': 1500, 'wages-expense': 2000, 'card-fees': 90 }),
      },
    },
    {
      id: '07-closing-entries',
      sectionId: '07-revenue-expenses',
      kind: 'booking',
      title: 'Closing the books for October',
      role: 'practice',
      difficulty: 3,
      entityId: 'coffee',
      prompt:
        'October is over. The opening balance sheet shows Bean There’s balances (from the income-statement problem). Close the temporary accounts **directly into Retained Earnings**, in three rows:\n\n1. Close all **revenue** accounts.\n2. Close all **expense** accounts.\n3. Close **Dividends (Owner Draws)**.\n\nAfter closing, every revenue, expense and dividend account should be zero.',
      hints: [
        'To bring an account to zero, post its balance on the **opposite** side of its normal balance. Sales Revenue has a $9,000 credit balance — so…?',
        'Expenses have debit balances; closing them means crediting each one. Which account takes the other side?',
        'Check: Retained Earnings should end up at net income minus dividends: 3,610 − 1,000.',
      ],
      explanation:
        '**Row 1: Dr Sales Revenue 9,000 / Cr Retained Earnings 9,000.**\n\n**Row 2: Dr Retained Earnings 5,390 / Cr COGS 1,800, Cr Wages Expense 2,000, Cr Rent Expense 1,500, Cr Card Processing Fees 90.**\n\n**Row 3: Dr Retained Earnings 1,000 / Cr Dividends 1,000.**\n\nEach temporary account is zeroed by posting its balance on its opposite side, and the net lands in Retained Earnings: 9,000 − 5,390 − 1,000 = **2,610**. Total equity doesn’t change at all — closing only moves amounts *within* equity, from the period’s sub-accounts into the permanent Retained Earnings account.\n\nMany textbooks first close into a temporary **Income Summary** account and then close that into Retained Earnings; the end result is identical.',
      showBalanceSheets: true,
      opening: bs({
        cash: 24410,
        inventory: 1200,
        'accounts-payable': 1000,
        'paid-in-capital': 22000,
        'sales-revenue': 9000,
        cogs: 1800,
        'wages-expense': 2000,
        'rent-expense': 1500,
        'card-fees': 90,
        dividends: 1000,
      }),
      trapAccounts: [
        {
          id: 'income-summary',
          name: 'Income Summary',
          type: 'equity',
          equityGroup: 'retained',
          trap: {
            kind: 'other',
            explanation:
              'Income Summary is a temporary account some textbooks close through. Bean There’s chart of accounts has none — this problem closes **directly into Retained Earnings**.',
          },
        },
        {
          id: 'net-income',
          name: 'Net Income',
          type: 'equity',
          equityGroup: 'retained',
          trap: {
            kind: 'other',
            explanation: 'Net income is a **result** (revenue − expenses), not an account. The profit is kept in **Retained Earnings**.',
          },
        },
      ],
      diagnosticExplanations: {
        EXTRA_ACCOUNT:
          'Closing never touches Paid-in Capital or any asset/liability. Profits accumulate in **Retained Earnings**; owner contributions stay in Paid-in Capital.',
        WRONG_SIDE:
          'To zero an account, post on the side **opposite** its balance: debit revenue (credit balance), credit expenses and dividends (debit balances).',
        WRONG_AMOUNT: 'Close each account for its full balance. Row 2’s Retained Earnings debit is the sum of all expenses: 1,800 + 2,000 + 1,500 + 90 = 5,390.',
        SPLIT_ENTRY: 'The prompt asks for three rows: revenues together, expenses together, then dividends.',
      },
      solution: [
        row('t1', 'Close revenue', dr('sales-revenue', 9000), cr('retained-earnings', 9000)),
        row(
          't2',
          'Close expenses',
          dr('retained-earnings', 5390),
          cr('cogs', 1800),
          cr('wages-expense', 2000),
          cr('rent-expense', 1500),
          cr('card-fees', 90),
        ),
        row('t3', 'Close dividends', dr('retained-earnings', 1000), cr('dividends', 1000)),
      ],
    },
    {
      id: '07-rv-bank-till-deposit',
      sectionId: '07-revenue-expenses',
      kind: 'booking',
      title: 'Review: the bank receives Bean There’s cash',
      role: 'review',
      difficulty: 2,
      entityId: 'bank',
      prompt:
        'Maya walks Saturday’s **$600** of till cash to First Example Bank and deposits it into Bean There’s **business checking account**. Book this in **First Example Bank’s** books. (The bank records all of Bean There’s accounts in **Business Deposits**.)',
      hints: [
        'Whose books? The bank’s. What does the bank physically receive?',
        'Paper money goes into the vault — an asset for the bank. What does the bank now owe Bean There?',
        'To the bank, a customer’s deposit is a liability, not revenue.',
      ],
      explanation:
        '**Dr Cash – Vault 600 / Cr Business Deposits 600.** The bank receives physical currency (Asset ↑ → debit) and now owes Bean There $600 more (Liability ↑ → credit).\n\nCompare with Bean There’s books: depositing till cash into its own bank account is just an asset-to-asset move (both are in Bean There’s Cash). The same event is a *swap* for the customer and a *new asset + new liability* for the bank.',
      showBalanceSheets: true,
      opening: bs({
        'vault-cash': 5000,
        'reserves-fed': 50000,
        'deposits-checking': 25000,
        'deposits-business': 20000,
        'paid-in-capital': 6000,
        'retained-earnings': 4000,
      }),
      trapAccounts: [
        {
          id: 'bt-sales-revenue',
          name: 'Sales Revenue',
          type: 'revenue',
          trap: {
            kind: 'counterparty',
            explanation: 'Bean There earned that revenue — the **bank** didn’t. To the bank, deposited money is owed back to the customer: a liability.',
          },
        },
        {
          id: 'bt-checking-asset',
          name: 'Checking Account',
          type: 'asset',
          trap: {
            kind: 'counterparty',
            explanation: 'A checking account is the **customer’s** asset. In the bank’s books it’s the opposite: a deposit liability (**Business Deposits**).',
          },
        },
      ],
      diagnosticExplanations: {
        EXTRA_ACCOUNT:
          'Bean There is a business customer — the bank uses **Business Deposits**, not Customer Deposits – Checking (for personal customers). And physical cash goes to the vault, not to the Fed.',
        WRONG_SIDE: 'For the bank, a deposit is a liability → it increases with a **credit**. The vault cash (Asset) increases with a **debit**.',
      },
      solution: [row('t1', 'Bean There deposits till cash', dr('vault-cash', 600), cr('deposits-business', 600))],
    },
    {
      id: '07-rv-classify-coffee',
      sectionId: '07-revenue-expenses',
      kind: 'classify',
      title: 'Review: sort Bean There’s accounts',
      role: 'review',
      difficulty: 1,
      prompt: 'Drag each account into its type. Watch for the one that belongs to a different set of books.',
      buckets: ['asset', 'liability', 'equity', 'revenue', 'expense', 'dividend'],
      hints: [
        'Ask: does Bean There *own* it, *owe* it, *earn* it, *use it up*, or *pay it out to the owner*?',
        'Whose books is "Business Deposits" in? For that entity, is it owned or owed?',
      ],
      explanation:
        'Assets: Inventory, Card Receivables, Savings Account. Liability: Accounts Payable — and **Business Deposits in the bank’s books** (what the bank owes Bean There). Equity: Paid-in Capital. Revenue: Sales Revenue. Expense: Card Processing Fees. Dividend: Dividends (Owner Draws).',
      items: [
        { label: 'Inventory – Beans & Supplies', entityId: 'coffee', answer: 'asset', explanation: 'Beans on the shelf are owned and not yet used up.' },
        { label: 'Accounts Payable', entityId: 'coffee', answer: 'liability', explanation: 'Bills Bean There owes suppliers.' },
        { label: 'Paid-in Capital', entityId: 'coffee', answer: 'equity', explanation: 'Maya’s investment in the company.' },
        { label: 'Sales Revenue', entityId: 'coffee', answer: 'revenue', explanation: 'Earned by selling coffee.' },
        { label: 'Card Processing Fees', entityId: 'coffee', answer: 'expense', explanation: 'A cost of accepting cards.' },
        { label: 'Dividends (Owner Draws)', entityId: 'coffee', answer: 'dividend', explanation: 'Profit paid out to the owner — not an expense.' },
        {
          label: 'Card Receivables (Cash in Transit)',
          entityId: 'coffee',
          answer: 'asset',
          explanation: 'The processor owes Bean There this money; it arrives in a day or two.',
        },
        {
          label: 'Savings Account – First Example Bank',
          entityId: 'coffee',
          answer: 'asset',
          explanation: 'Bean There owns the money in its savings account.',
        },
        {
          label: 'Business Deposits (in First Example Bank’s books)',
          entityId: 'bank',
          answer: 'liability',
          explanation: 'For the **bank**, Bean There’s balance is money it owes — a liability. Same money, opposite perspective.',
        },
      ],
    },
  ],
};
export default mod;
