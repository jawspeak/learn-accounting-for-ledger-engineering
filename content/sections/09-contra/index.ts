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
A **[[contra account]]** is paired with a parent account and **reduces** it. Its [[normal balance]] is the **opposite** of its parent’s:

| Contra account | Parent | Contra normal side | Shown as |
|---|---|---|---|
| [[Accumulated Depreciation]] – Equipment | Equipment (Dr) | **Cr** | Equipment − Accumulated Depreciation = *[[net book value]]* |
| [[Allowance for Doubtful Accounts]] | [[Accounts Receivable]] (Dr) | **Cr** | AR − Allowance = *net realizable value* |
| [[Sales Returns & Allowances]] | Sales Revenue (Cr) | **Dr** | Sales − Returns = *net sales* |

Why not just credit Equipment or debit Sales directly? Because the **gross** number is information you want to keep:
- Equipment stays at its **original cost** ($12,000) while [[depreciation]] piles up beside it.
- Accounts Receivable keeps matching what customers actually owe, invoice by invoice, while the allowance holds an *estimate* of what won’t be collected — before you know which customer will default.
- Sales stays at what was sold; returns are visible on their own line, so a spike in refunds doesn’t hide inside a lower sales number.

The [[balance sheet]] shows the parent, the contra beneath it, and the **net**. In the builder, a contra column sits right after its parent. In the picker, choose the **contra** type (e.g. *contra-asset*), not the parent’s type.

**Depreciation:** Bean There’s $12,000 espresso machine is expected to last 5 years with no resale value, so it’s depreciated **straight-line** at $12,000 ÷ 60 months = **$200 per month**.
`;

const lens = `
**Ledger-engineer's lens: contra accounts vs. negative balances**

- You *could* model depreciation as negative [[postings]] on Equipment. Contra accounts are better: each account keeps a single, meaningful sign convention, and you never lose the gross figure.
- A contra account is just another account with \`type: contra-asset\` and \`contraOf: equipment\`. Reports compute **net = parent − contra**; nothing is stored pre-netted.
- Rule of thumb for [[ledgers]]: **store gross, derive net.** Netting at write time is lossy and irreversible; netting at read time is a query.
- The allowance is an *estimate* that gets revised. Revisions are new postings (adjust the allowance up or down), never edits of last month’s estimate.
`;

const callouts = [
  {
    title: 'Depreciation is not a savings account',
    body: `Accumulated Depreciation is **not** cash set aside to replace the machine — it’s just the portion of the machine’s cost that has been expensed so far. No cash moves when you record depreciation. The cash left when the machine was bought.`,
  },
];

const mod: SectionModule = {
  section: {
    id: '09-contra',
    number: 9,
    title: 'Contra Accounts',
    summary: 'Depreciation, doubtful accounts and returns — reducing an account without losing its gross value.',
    primer,
    lens,
    callouts,
    problemIds: [
      '09-depreciation',
      '09-buy-and-depreciate',
      '09-allowance-estimate',
      '09-write-off',
      '09-sales-returns',
      '09-bs-net',
      '09-mc-contra',
      '09-rv-prepaid-rent',
      '09-rv-bank-withdrawal',
    ],
  },
  problems: [
    {
      id: '09-depreciation',
      sectionId: '09-contra',
      kind: 'booking',
      title: 'A month of depreciation',
      role: 'worked',
      difficulty: 1,
      entityId: 'coffee',
      prompt:
        'Bean There’s espresso machine cost **$12,000** and is depreciated straight-line over 5 years (60 months) to zero: **$200 per month**. Five months have already been recorded (see the opening balance sheet).\n\nBook **this month’s** depreciation.',
      hints: [
        'Did any cash move? What has been "used up" this month?',
        'Using up part of a long-lived asset is an expense. Which one?',
        'We don’t credit Equipment directly — which account collects the reduction so Equipment stays at cost?',
      ],
      walkthrough: [
        '**Start from the account you know.** A month of the machine’s useful life has been consumed — that’s **Depreciation Expense**. Expenses increase on the **debit** side: Dr Depreciation Expense 200.',
        'The machine is worth less on the books, so assets must go down by $200. But we want **Equipment** to keep showing the original cost of $12,000.',
        'So the credit goes to the **contra-asset** **Accumulated Depreciation: Equipment**. Contra-assets are credit-normal, so an increase is a credit: Cr Accumulated Depreciation 200.',
        'Check: net book value goes from 12,000 − 1,000 = 11,000 to 12,000 − 1,200 = **10,800**. Assets −200 = Equity −200 (via the expense). ✓',
      ],
      explanation:
        '**Dr Depreciation Expense 200 / Cr Accumulated Depreciation: Equipment 200.** The expense spreads the machine’s cost over the months it helps earn revenue. The credit goes to the contra account so the balance sheet shows:\n\n| | |\n|---|---|\n| Equipment (cost) | 12,000 |\n| Less: Accumulated Depreciation | (1,200) |\n| **Net book value** | **10,800** |\n\nNo cash moves — depreciation is an allocation of a cost paid long ago.',
      showBalanceSheets: true,
      opening: bs({ cash: 4000, equipment: 12000, 'accum-depreciation': 1000, 'paid-in-capital': 14000, 'retained-earnings': 1000 }),
      trapAccounts: [
        {
          id: 'depreciation-payable',
          name: 'Depreciation Payable',
          type: 'liability',
          trap: {
            kind: 'other',
            explanation: 'Depreciation isn’t owed to anyone. It reduces the asset’s book value through the contra account **Accumulated Depreciation**.',
          },
        },
        {
          id: 'equipment-replacement-fund',
          name: 'Equipment Replacement Fund',
          type: 'asset',
          trap: {
            kind: 'other',
            explanation: 'Depreciation doesn’t set any cash aside. It’s a non-cash expense that records the asset being used up.',
          },
        },
      ],
      diagnosticExplanations: {
        EXTRA_ACCOUNT:
          'Crediting **Equipment** directly would lose the original cost. Use the contra account **Accumulated Depreciation: Equipment**. And no cash moves.',
        MISSING_ACCOUNT: 'The credit side belongs in **Accumulated Depreciation: Equipment**, which reduces Equipment on the balance sheet.',
        WRONG_TYPE: 'Accumulated Depreciation is a **contra-asset** (credit-normal), not a liability or an expense.',
        WRONG_SIDE: 'A contra-asset increases with a **credit** — the opposite of its parent asset.',
      },
      solution: [row('t1', 'Monthly depreciation', dr('depreciation-expense', 200), cr('accum-depreciation', 200))],
    },
    {
      id: '09-buy-and-depreciate',
      sectionId: '09-contra',
      kind: 'booking',
      title: 'Buy the machine, then depreciate',
      role: 'faded',
      difficulty: 1,
      entityId: 'coffee',
      prompt:
        'Row 1 is done: on **Jan 2** Bean There paid **$12,000** cash for an espresso machine expected to last 5 years with no resale value.\n\nBook **row 2**: January’s straight-line depreciation on **Jan 31**.',
      hints: [
        'Monthly depreciation = cost ÷ useful life in months. How many months in 5 years?',
        'Which expense records using up equipment, and which contra account takes the credit?',
      ],
      explanation:
        '**Row 2: Dr Depreciation Expense 200 / Cr Accumulated Depreciation: Equipment 200** ($12,000 ÷ 60 months).\n\nNotice what row 1 did: buying the machine was an **asset swap** (cash → equipment) with no expense. The cost reaches the income statement gradually, $200 a month, through depreciation.',
      showBalanceSheets: true,
      opening: bs({ cash: 20000, 'paid-in-capital': 20000 }),
      prefill: {
        locked: true,
        rows: [row('t1', 'Buy espresso machine', dr('equipment', 12000), cr('cash', 12000))],
      },
      trapAccounts: [
        {
          id: 'equipment-expense',
          name: 'Equipment Expense',
          type: 'expense',
          trap: {
            kind: 'near-synonym',
            explanation: 'The machine’s cost is expensed gradually through **Depreciation Expense**, not all at once as an equipment expense.',
          },
        },
        {
          id: 'depreciation-payable-2',
          name: 'Depreciation Payable',
          type: 'liability',
          trap: {
            kind: 'other',
            explanation: 'Nobody is owed anything. The credit reduces the asset via **Accumulated Depreciation: Equipment**.',
          },
        },
      ],
      diagnosticExplanations: {
        WRONG_AMOUNT: '$12,000 over 5 years = $2,400 a year = **$200 a month**.',
        EXTRA_ACCOUNT: 'Don’t credit Equipment directly; it stays at cost. Credit **Accumulated Depreciation: Equipment**.',
      },
      solution: [
        row('t1', 'Buy espresso machine', dr('equipment', 12000), cr('cash', 12000)),
        row('t2', 'January depreciation', dr('depreciation-expense', 200), cr('accum-depreciation', 200)),
      ],
    },
    {
      id: '09-allowance-estimate',
      sectionId: '09-contra',
      kind: 'booking',
      title: 'Estimating bad debts',
      role: 'practice',
      difficulty: 2,
      entityId: 'coffee',
      prompt:
        'Bean There’s catering clients owe it **$3,000**. Experience says about **5%** of catering invoices never get paid, but nobody knows *which* client will default. At month-end, set up an allowance for the estimate. (The allowance is currently zero.)',
      hints: [
        'How much does Bean There expect not to collect?',
        'The expected loss belongs to this month — which expense?',
        'You can’t credit any one client’s receivable — you don’t know who will default. Which contra account holds an estimate?',
      ],
      explanation:
        '**Dr Bad Debt Expense 150 / Cr Allowance for Doubtful Accounts 150** (5% × $3,000).\n\nThe expected loss is recognised now, while the receivables are on the books, rather than later when a specific client defaults (matching). The credit goes to the contra-asset because the loss is an **estimate**: Accounts Receivable still shows the $3,000 clients legally owe, and the balance sheet shows **net** receivables of $2,850 — what Bean There realistically expects to collect.',
      showBalanceSheets: true,
      opening: bs({ cash: 2000, 'accounts-receivable': 3000, 'paid-in-capital': 5000 }),
      trapAccounts: [
        {
          id: 'doubtful-accounts-payable',
          name: 'Doubtful Accounts Payable',
          type: 'liability',
          trap: {
            kind: 'near-synonym',
            explanation: 'Bean There doesn’t owe anyone. The allowance is a **contra-asset** that reduces Accounts Receivable.',
          },
        },
        {
          id: 'uncollectible-revenue',
          name: 'Uncollectible Sales Revenue',
          type: 'contra-revenue',
          contraOf: 'sales-revenue',
          trap: {
            kind: 'other',
            explanation:
              'Expected credit losses are an **expense** (Bad Debt Expense), not a reduction of sales. The sale really happened; the problem is collecting the cash.',
          },
        },
      ],
      diagnosticExplanations: {
        EXTRA_ACCOUNT:
          'Crediting **Accounts Receivable** directly means writing off specific invoices — but you don’t know yet which client won’t pay. Use the **Allowance**.',
        WRONG_AMOUNT: '5% of $3,000 = **$150**.',
        WRONG_TYPE: 'The Allowance for Doubtful Accounts is a **contra-asset**: it reduces Accounts Receivable and is credit-normal.',
      },
      solution: [row('t1', 'Estimate bad debts', dr('bad-debt-expense', 150), cr('allowance-doubtful', 150))],
    },
    {
      id: '09-write-off',
      sectionId: '09-contra',
      kind: 'booking',
      title: 'Writing off a client who went bust',
      role: 'practice',
      difficulty: 3,
      entityId: 'coffee',
      prompt:
        'Last month Bean There set up a **$150** allowance for doubtful accounts (see the opening balance sheet).\n\n1. A catering client that owes **$120** goes bankrupt. Bean There writes off the invoice.\n2. Another client pays a **$500** invoice by bank transfer.\n\nBook both events.',
      hints: [
        'Row 1: Now you know *which* receivable is bad. Which account must lose that $120?',
        'The expected loss was already expensed last month when the allowance was created. Should there be more expense now?',
        'The allowance was set up exactly for this — use it up.',
      ],
      explanation:
        '**Row 1: Dr Allowance for Doubtful Accounts 120 / Cr Accounts Receivable 120.** The specific invoice is removed from AR, and the allowance (the estimate) is used up by the same amount. **No expense** now — it was recognized last month when the allowance was created. Net receivables don’t change: (3,000 − 150) before, (2,880 − 30) after = 2,850 both times.\n\n**Row 2: Dr Cash 500 / Cr Accounts Receivable 500.** An ordinary collection.\n\n$30 of allowance remains for the other invoices.',
      showBalanceSheets: true,
      opening: bs({
        cash: 2000,
        'accounts-receivable': 3000,
        'allowance-doubtful': 150,
        'paid-in-capital': 4000,
        'retained-earnings': 850,
      }),
      trapAccounts: [
        {
          id: 'write-off-expense',
          name: 'Write-off Expense',
          type: 'expense',
          trap: {
            kind: 'near-synonym',
            explanation:
              'The loss was already expensed when the allowance was set up. Expensing again at write-off would count it twice. Debit the **Allowance** instead.',
          },
        },
        {
          id: 'bankrupt-client-payable',
          name: 'Accounts Payable: Bankrupt Client',
          type: 'liability',
          trap: {
            kind: 'counterparty',
            explanation: 'That’s the client’s side of the debt. In Bean There’s books, the debt is an asset (Accounts Receivable) that is now being removed.',
          },
        },
      ],
      diagnosticExplanations: {
        EXTRA_ACCOUNT:
          'Under the allowance method, the write-off doesn’t touch **Bad Debt Expense** — that was booked when the estimate was made. Debit the **Allowance for Doubtful Accounts**.',
        MISSING_ACCOUNT: 'Row 1 uses the Allowance (debit) and removes the specific invoice from Accounts Receivable (credit).',
        WRONG_SIDE: 'The Allowance is credit-normal; using it up is a **debit**. Accounts Receivable shrinks with a **credit**.',
      },
      solution: [
        row('t1', 'Write off bankrupt client', dr('allowance-doubtful', 120), cr('accounts-receivable', 120)),
        row('t2', 'Collect invoice', dr('cash', 500), cr('accounts-receivable', 500)),
      ],
    },
    {
      id: '09-sales-returns',
      sectionId: '09-contra',
      kind: 'booking',
      title: 'Refunds and allowances',
      role: 'practice',
      difficulty: 2,
      entityId: 'coffee',
      prompt:
        '1. A customer returns an unopened **$40** bag of beans bought earlier this month and gets a **cash refund**.\n2. A catering client complains the coffee arrived cold. Bean There gives a **$50 allowance** off the client’s unpaid invoice.\n\nBook both events. (Bean There tracks inventory by month-end count, so the returned bag needs no inventory entry — it’ll simply be counted.)',
      hints: [
        'Which revenue is being given back? Do you want to hide that inside Sales Revenue, or see it separately?',
        'Sales Returns & Allowances is a contra-revenue account. What’s its normal side?',
        'Row 2: no cash moves. What does the client now owe less of?',
      ],
      explanation:
        '**Row 1: Dr Sales Returns & Allowances 40 / Cr Cash 40.**\n\n**Row 2: Dr Sales Returns & Allowances 50 / Cr Accounts Receivable 50.**\n\nSales Returns & Allowances is a **contra-revenue** account: debit-normal, reducing Sales Revenue. The income statement shows Sales 440, less returns & allowances (90), **net sales 350**. Debiting Sales Revenue directly gives the same net, but you’d lose sight of how much is being refunded — a number owners and auditors watch.',
      showBalanceSheets: true,
      opening: bs({ cash: 2040, 'accounts-receivable': 400, 'paid-in-capital': 2000, 'sales-revenue': 440 }),
      trapAccounts: [
        {
          id: 'refund-expense',
          name: 'Refund Expense',
          type: 'expense',
          trap: {
            kind: 'near-synonym',
            explanation: 'A refund reverses revenue; it isn’t a cost of running the business. Use the contra-revenue **Sales Returns & Allowances**.',
          },
        },
        {
          id: 'refunds-payable',
          name: 'Refunds Payable',
          type: 'liability',
          trap: {
            kind: 'other',
            explanation: 'The refund was paid in cash on the spot (row 1) or taken off the invoice (row 2) — nothing remains owed.',
          },
        },
      ],
      diagnosticExplanations: {
        EXTRA_ACCOUNT:
          'Debiting **Sales Revenue** directly hides the returns. Bean There uses the contra account **Sales Returns & Allowances**. Row 2 moves no cash.',
        WRONG_TYPE: 'Sales Returns & Allowances is **contra-revenue** (debit-normal), not an expense.',
        WRONG_SIDE: 'Contra-revenue increases on the **debit** side — opposite to Sales Revenue.',
      },
      solution: [
        row('t1', 'Cash refund for returned beans', dr('sales-returns', 40), cr('cash', 40)),
        row('t2', 'Allowance on catering invoice', dr('sales-returns', 50), cr('accounts-receivable', 50)),
      ],
    },
    {
      id: '09-bs-net',
      sectionId: '09-contra',
      kind: 'statement-fill',
      title: 'Balance sheet with contra accounts',
      role: 'practice',
      difficulty: 2,
      entityId: 'coffee',
      statement: 'balance-sheet',
      prompt:
        'Starting from the opening balances, apply the three month-end transactions and fill in Bean There’s **after balance sheet**: the balance of every account (contra accounts as positive amounts on their normal side).\n\nThen: what is the espresso machine’s **net book value**, and what are **net receivables**?',
      hints: [
        'Contra accounts grow when their normal side (credit) is posted. Accumulated Depreciation: 1,000 + 200.',
        'Accounts Receivable changes only when a specific invoice is paid or written off. The bad-debt estimate touches the allowance, not AR.',
        'Don’t forget the expense accounts — they’re part of equity until closing.',
      ],
      explanation:
        '| Account | Balance |\n|---|---|\n| Cash | 5,300 |\n| Accounts Receivable | 1,700 |\n| Allowance for Doubtful Accounts | (150) |\n| Equipment | 12,000 |\n| Accumulated Depreciation | (1,200) |\n| Accounts Payable | 500 |\n| Paid-in Capital | 15,000 |\n| Retained Earnings | 2,400 |\n| Depreciation Expense | 200 |\n| Bad Debt Expense | 50 |\n\n**Net book value** of equipment = 12,000 − 1,200 = **10,800**. **Net receivables** = 1,700 − 150 = **1,550**. Total assets = 5,300 + 1,550 + 10,800 = 17,650 = liabilities 500 + equity 17,150 (15,000 + 2,400 − 250). ✓',
      opening: bs({
        cash: 5000,
        'accounts-receivable': 2000,
        'allowance-doubtful': 100,
        equipment: 12000,
        'accum-depreciation': 1000,
        'accounts-payable': 500,
        'paid-in-capital': 15000,
        'retained-earnings': 2400,
      }),
      rows: [
        row('t1', 'Monthly depreciation', dr('depreciation-expense', 200), cr('accum-depreciation', 200)),
        row('t2', 'Top up bad-debt allowance', dr('bad-debt-expense', 50), cr('allowance-doubtful', 50)),
        row('t3', 'Client pays invoice', dr('cash', 300), cr('accounts-receivable', 300)),
      ],
      answer: {
        balanceSheet: bs({
          cash: 5300,
          'accounts-receivable': 1700,
          'allowance-doubtful': 150,
          equipment: 12000,
          'accum-depreciation': 1200,
          'accounts-payable': 500,
          'paid-in-capital': 15000,
          'retained-earnings': 2400,
          'depreciation-expense': 200,
          'bad-debt-expense': 50,
        }),
      },
    },
    {
      id: '09-mc-contra',
      sectionId: '09-contra',
      kind: 'multiple-choice',
      title: 'Reading contra accounts',
      role: 'practice',
      difficulty: 2,
      multi: true,
      prompt:
        'Bean There’s balance sheet shows:\n\n| | |\n|---|---|\n| Equipment | 12,000 |\n| Less: Accumulated Depreciation: Equipment | (3,000) |\n| **Net** | **9,000** |\n\nSelect **all** true statements.',
      hints: ['What’s the normal side of a contra-asset?', 'When Bean There recorded the $3,000 of depreciation, did any cash move?'],
      explanation:
        'Accumulated Depreciation is a **contra-asset**: credit-normal, shown as a reduction of Equipment, giving a net book value of $9,000. It’s not a liability (nobody is owed) and not a cash reserve (depreciation moves no cash). At $200/month, $3,000 means 15 months of depreciation have been recorded.',
      options: [
        { text: 'Accumulated Depreciation has a normal **credit** balance.', correct: true, explanation: 'Contra-assets are the opposite of assets: credit-normal.' },
        { text: 'The machine’s net book value is **$9,000**.', correct: true, explanation: 'Cost 12,000 − accumulated depreciation 3,000.' },
        { text: 'Accumulated Depreciation is a liability.', correct: false, explanation: 'Nobody is owed anything. It’s a contra-**asset** that reduces Equipment.' },
        {
          text: 'Bean There has $3,000 of cash set aside to replace the machine.',
          correct: false,
          explanation: 'Depreciation is a non-cash allocation of the machine’s cost. No cash is set aside.',
        },
        { text: 'At $200 a month, 15 months of depreciation have been recorded.', correct: true, explanation: '3,000 ÷ 200 = 15.' },
      ],
    },
    {
      id: '09-rv-prepaid-rent',
      sectionId: '09-contra',
      kind: 'booking',
      title: 'Review: using up prepaid rent',
      role: 'review',
      difficulty: 1,
      entityId: 'coffee',
      prompt:
        'Bean There prepaid three months of rent at $1,500/month; two months remain (**$3,000** of Prepaid Rent, see the opening balance sheet). It’s the end of December. Record December’s rent.',
      hints: ['Did cash move today?', 'One month of the prepaid asset has been used up. Which expense, and which asset shrinks?'],
      explanation:
        '**Dr Rent Expense 1,500 / Cr Prepaid Rent 1,500.** The cash left when the rent was prepaid; now one month of that asset is consumed and becomes December’s expense. $1,500 remains for January.',
      showBalanceSheets: true,
      opening: bs({ cash: 3000, 'prepaid-rent': 3000, 'paid-in-capital': 6000 }),
      trapAccounts: [
        {
          id: 'accum-rent',
          name: 'Accumulated Amortization: Rent',
          type: 'contra-asset',
          contraOf: 'prepaid-rent',
          trap: {
            kind: 'other',
            explanation:
              'Short-term prepaids like rent are simply reduced directly. Contra accounts are for long-lived assets (and receivables) where the gross value matters.',
          },
        },
        {
          id: 'rent-payable-3',
          name: 'Rent Payable',
          type: 'liability',
          trap: { kind: 'near-synonym', explanation: 'Nothing is owed — December’s rent was paid in advance.' },
        },
      ],
      diagnosticExplanations: {
        EXTRA_ACCOUNT: 'No cash moves — the rent was paid in advance. Reduce **Prepaid Rent** instead.',
        WRONG_AMOUNT: 'One month = **$1,500**.',
      },
      solution: [row('t1', 'December rent used', dr('rent-expense', 1500), cr('prepaid-rent', 1500))],
    },
    {
      id: '09-rv-bank-withdrawal',
      sectionId: '09-contra',
      kind: 'booking',
      title: 'Review: Bean There withdraws cash',
      role: 'review',
      difficulty: 2,
      entityId: 'bank',
      prompt:
        'Maya withdraws **$300** in small bills from Bean There’s business checking account to stock the till. Book this in **First Example Bank’s** books (Bean There’s accounts are in **Business Deposits**).',
      hints: ['What leaves the bank physically?', 'After the withdrawal, does the bank owe Bean There more or less?'],
      explanation:
        '**Dr Business Deposits 300 / Cr Cash: Vault 300.** The bank’s liability to Bean There shrinks (debit a liability) and its vault cash shrinks (credit an asset). Both sides of the bank’s balance sheet go down by $300. No expense — the bank is just returning money it owed.',
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
          id: 'withdrawal-expense',
          name: 'Withdrawal Expense',
          type: 'expense',
          trap: { kind: 'other', explanation: 'Paying out a customer’s own money isn’t an expense — it settles a liability (the deposit).' },
        },
        {
          id: 'bt-till-cash',
          name: 'Cash Register (Till)',
          type: 'asset',
          trap: { kind: 'counterparty', explanation: 'The till is **Bean There’s** asset. The bank only sees its vault cash going down and its deposit liability going down.' },
        },
      ],
      diagnosticExplanations: {
        WRONG_SIDE: 'The deposit liability **decreases** → debit. Vault cash **decreases** → credit.',
        EXTRA_ACCOUNT: 'Bean There is a business customer (Business Deposits), and physical bills come from the vault, not the Fed.',
      },
      solution: [row('t1', 'Bean There withdraws cash', dr('deposits-business', 300), cr('vault-cash', 300))],
    },
  ],
};
export default mod;
