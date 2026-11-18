import type { BalanceSheet, SectionModule, TrapAccount } from '@contracts';

/** Owned by C1. Perspectives — the same events in First Example Bank's books. */

const usd = (dollars: number) => dollars * 100;

/** A plausible (simplified) opening balance sheet for First Example Bank. A 2,000,000 = L 1,800,000 + E 200,000. */
const bankOpening: BalanceSheet = {
  lines: [
    { accountId: 'vault-cash', amount: usd(20000) },
    { accountId: 'reserves-fed', amount: usd(180000) },
    { accountId: 'securities', amount: usd(300000) },
    { accountId: 'loans-receivable', amount: usd(1400000) },
    { accountId: 'premises', amount: usd(100000) },
    { accountId: 'deposits-checking', amount: usd(1000000) },
    { accountId: 'deposits-savings', amount: usd(600000) },
    { accountId: 'deposits-business', amount: usd(200000) },
    { accountId: 'paid-in-capital', amount: usd(100000) },
    { accountId: 'retained-earnings', amount: usd(100000) },
  ],
};

/** Your account, as a trap offered in the bank's books. */
const yourCheckingTrap: TrapAccount = {
  id: 'checking',
  name: 'Checking Account',
  type: 'asset',
  trap: {
    kind: 'counterparty',
    explanation:
      "**Checking Account** (an asset) is how *you* record your balance in *your* books. We're in the **bank's** books: the bank *owes* you that money, so it's a liability — **Customer Deposits – Checking**.",
  },
};

const depositRevenueTrap: TrapAccount = {
  id: 'deposit-revenue',
  name: 'Deposit Revenue',
  type: 'revenue',
  trap: {
    kind: 'other',
    explanation:
      "Deposits aren't the bank's income. Every dollar deposited is a dollar the bank **owes back** to the customer on demand — a **liability**. The bank earns revenue from what it does with the money (interest on loans, fees), not from receiving it.",
  },
};

const mod: SectionModule = {
  section: {
    id: '04-perspectives',
    number: 4,
    title: "Perspectives — the Bank's Books",
    summary: 'The same events, booked by First Example Bank. Your asset is its liability.',
    primer: `
Every event between two parties is recorded **twice — once in each party's books** — and the two entries mirror each other.

| Event | **Your** books | **Bank's** books |
|---|---|---|
| You deposit $100 cash | Dr Checking (A↑) / Cr Cash (A↓) | Dr Cash – Vault (A↑) / Cr Customer Deposits – Checking (L↑) |
| Checking → savings $500 | Dr Savings (A↑) / Cr Checking (A↓) | Dr Deposits – Checking (L↓) / Cr Deposits – Savings (L↑) |

Notice:

- **Your asset is the bank's liability.** Your $1,000 "Checking Account" is, to the bank, $1,000 it **owes** you: *Customer Deposits – Checking*.
- **An asset swap for you can be a liability swap for the bank.** Moving money between your own accounts changes *which* debt the bank owes you, not how much.
- **Accounts never cross the boundary.** "Customer Deposits" never appears in your books; "Checking Account" never appears in the bank's. Using the other party's account is the most common perspective error.

**How to rewrite an entry for the other party:** for each account, ask "what is the *other side* of this claim?" — my asset owed by you ↔ your liability owed to me; my expense paid to you ↔ your revenue (or, if the money is just passing through, a deposit movement). Then check: does each side of the new entry make sense **in that entity's** books?
`.trim(),
    callouts: [
      {
        title: "Where is the bank's money?",
        body: `
When you deposit $100, where does "your" money go? Not into a box with your name on it.

- **A bank's "cash" is mostly its reserve balance at the Federal Reserve** — the bank's own account at the Fed, used to settle payments with other banks — plus **vault cash** (bills in the vault, teller drawers and ATMs). (Some smaller banks hold much of it as balances at a larger *correspondent* bank instead — same idea, one more hop.)
- **Your deposit is the bank's liability**, not a pot of money. The bank owes you $100. The $100 of bills you handed over became the bank's asset (Cash – Vault), and it's **fungible**: the bank may ship surplus bills to the Fed (vault cash ↓, reserves ↑), use reserves to settle other customers' payments, buy securities, or fund loans.
- **There is no 1:1 mapping** from your deposit to a slice of the Fed balance — and there won't be. Deposits sit on the right side of the bank's balance sheet; reserves, securities and loans sit on the left. Only the totals tie out (A = L + E).
- **Banks hold only a fraction of deposits as reserves.** For accuracy: the US statutory reserve requirement has been **0% since March 2020**. Banks hold reserves for liquidity, payment settlement and other regulatory reasons (such as liquidity rules), not because of a fixed ratio.
- What protects you is the bank's **equity** (a loss-absorbing cushion), regulation, and deposit insurance (FDIC, up to the insured limit — currently $250,000 per depositor, per bank, per ownership category) — not segregation of your particular dollars.
`.trim(),
      },
    ],
    lens: `
**Ledger-engineer's lens.** Each entity has its **own ledger**; one real-world event produces **one transaction per ledger**, never a shared one. In a bank's core ledger, every customer's balance is a **sub-ledger account** that rolls up into a **GL control account** (\`Customer Deposits – Checking\`) — and both are **liabilities** (credit-normal). If your fintech or bank data model shows customer balances as assets, you've modeled the customer's perspective by mistake. A good test: the sum of all customer sub-ledger balances must equal the GL control account, every day.
`.trim(),
    problemIds: [
      '04-bank-atm-withdrawal',
      '04-bank-payroll-deposit',
      '04-bank-cash-deposit',
      '04-bank-checking-to-savings',
      '04-rewrite-savings-to-checking',
      '04-rewrite-rent-same-bank',
      '04-rewrite-monthly-fee',
      '04-rewrite-utilities-other-bank',
      '04-where-is-the-money',
      '04-review-savings-interest',
      '04-review-dinner-on-card',
    ],
  },
  problems: [
    {
      id: '04-bank-atm-withdrawal',
      sectionId: '04-perspectives',
      kind: 'booking',
      title: "ATM withdrawal — the bank's view (worked)",
      role: 'worked',
      difficulty: 1,
      entityId: 'bank',
      prompt:
        "You withdraw **$60 in cash from your checking account** at one of First Example Bank's ATMs. You booked this in §3 in your own books. Now book it in **the bank's** books.",
      walkthrough: [
        "**Whose books?** First Example Bank's. Forget your Cash and Checking accounts — they don't exist here.",
        "**Start from the account you're sure about:** $60 of bills physically left the ATM. The ATM's cash is the bank's asset **Cash – Vault**, and it went **down**.",
        'Asset ↓ → **Cr Cash – Vault 60**.',
        'The row needs a $60 debit. What else changed? The bank now **owes you $60 less** — your deposit balance dropped.',
        'What the bank owes depositors is a **liability**: Customer Deposits – Checking. Liability ↓ → **Dr Customer Deposits – Checking 60**.',
        'Compare with your books (Dr Cash / Cr Checking): your asset swap is the bank\'s **shrinking balance sheet** — assets and liabilities both fall by 60. The bank\'s equity is untouched.',
      ],
      hints: [
        "Whose books are we in? Which bank account holds the ATM's bills?",
        'After the withdrawal, does the bank owe you more or less? What type of account records what the bank owes?',
      ],
      explanation:
        "Cash – Vault (Asset) ↓ → **Cr Cash – Vault 60**. The bank owes you $60 less → Customer Deposits – Checking (Liability) ↓ → **Dr Customer Deposits – Checking 60**. Assets and liabilities both fall by 60; equity unchanged. In your books the same event was an asset swap (Dr Cash / Cr Checking).",
      diagnosticExplanations: {
        WRONG_SIDE:
          'Customer Deposits is a **liability** (credit-normal). The bank owes you *less*, so it is **debited**. Cash – Vault is an asset that went down → credited.',
        EXTRA_ACCOUNT:
          'Only two accounts change. Bills left the ATM, so the asset that falls is **Cash – Vault**, not Reserves at the Federal Reserve. Reserves only move when money moves between banks (or when the bank orders/ships cash with the Fed).',
      },
      showBalanceSheets: true,
      opening: bankOpening,
      trapAccounts: [
        yourCheckingTrap,
        {
          id: 'cash',
          name: 'Cash',
          type: 'asset',
          trap: {
            kind: 'counterparty',
            explanation: "**Cash** (your wallet) is in *your* books. In the bank's books the bills that left the ATM were **Cash – Vault**.",
          },
        },
      ],
      perspectivePairId: '03-atm-withdrawal',
      solution: [
        {
          id: 't1',
          label: 'ATM withdrawal',
          postings: [
            { accountId: 'deposits-checking', side: 'dr', amount: usd(60) },
            { accountId: 'vault-cash', side: 'cr', amount: usd(60) },
          ],
        },
      ],
    },
    {
      id: '04-bank-payroll-deposit',
      sectionId: '04-perspectives',
      kind: 'booking',
      title: "Payday — the bank's view (partly filled)",
      role: 'faded',
      difficulty: 2,
      entityId: 'bank',
      prompt:
        "Your employer, **Maple Street Robotics**, also banks at First Example Bank. It pays your **$2,000 salary** from its business account into your checking account. The credit to your deposit is filled in. **Complete the bank's entry.**",
      hints: [
        "The bank owes **you** $2,000 more (given). Where did that $2,000 come from?",
        'Did any money leave the bank? Both accounts are at First Example Bank.',
        "Maple Street Robotics' balance went down. In the bank's books, what type of account is a business customer's balance, and which side decreases it?",
      ],
      explanation:
        "The bank owes you more → **Cr Customer Deposits – Checking 2,000** (given). It owes Maple Street Robotics less → **Dr Business Deposits 2,000**. No money left the bank, so no asset changes: it's a **liability swap**. Your *Salary Income* and your employer's *Salary Expense* don't appear here — the bank only records what it owes whom.",
      diagnosticExplanations: {
        WRONG_SIDE: "Business Deposits is a liability. The bank owes the employer **less**, so it is **debited**.",
        EXTRA_ACCOUNT:
          "No money left the bank — both customers bank here — so no asset (Cash – Vault or Reserves) changes. And salary isn't the bank's income or expense.",
        MISSING_ACCOUNT: "The $2,000 came out of Maple Street Robotics' account. What the bank owes a business customer is **Business Deposits**.",
      },
      showBalanceSheets: true,
      opening: bankOpening,
      trapAccounts: [
        {
          id: 'salary-expense',
          name: 'Salary Expense',
          type: 'expense',
          trap: {
            kind: 'counterparty',
            explanation: "Salary Expense belongs in **Maple Street Robotics'** books. The bank isn't paying anyone a salary here — it just moved a balance from one customer to another. (The bank's own payroll would be *Salaries Expense*.)",
          },
        },
        {
          id: 'salary-income',
          name: 'Salary Income',
          type: 'revenue',
          trap: {
            kind: 'counterparty',
            explanation: "Salary Income is in **your** books. The bank earns nothing from your paycheck.",
          },
        },
        yourCheckingTrap,
      ],
      perspectivePairId: '03-salary',
      prefill: {
        locked: true,
        rows: [{ id: 't1', label: 'Payroll deposit', postings: [{ accountId: 'deposits-checking', side: 'cr', amount: usd(2000) }] }],
      },
      solution: [
        {
          id: 't1',
          label: 'Payroll deposit',
          postings: [
            { accountId: 'deposits-business', side: 'dr', amount: usd(2000) },
            { accountId: 'deposits-checking', side: 'cr', amount: usd(2000) },
          ],
        },
      ],
    },
    {
      id: '04-bank-cash-deposit',
      sectionId: '04-perspectives',
      kind: 'booking',
      title: "Cash deposit — the bank's view",
      role: 'practice',
      difficulty: 1,
      entityId: 'bank',
      prompt:
        "You hand a teller **$100 in cash** and it's deposited into your **checking account**. Book it in **First Example Bank's** books.",
      hints: [
        "Whose books? The bank's. Your \"Checking Account\" is *your* name for this money — what is it to the bank?",
        "Start with what you're sure of: the teller drawer has $100 more bills. Which account and which side?",
        'The bank now owes you $100 more. Liabilities increase on which side?',
      ],
      explanation:
        "Bills in the teller drawer ↑ → Cash – Vault (Asset) → **Dr Cash – Vault 100**. The bank owes you $100 more → Customer Deposits – Checking (Liability) ↑ → **Cr Customer Deposits – Checking 100**. Both assets and liabilities grow by 100; the bank's equity is unchanged — taking a deposit doesn't make the bank richer. In your books the same event was an asset swap (Dr Checking / Cr Cash).",
      diagnosticExplanations: {
        WRONG_SIDE:
          "Customer Deposits – Checking is a liability (credit-normal) that went **up** → credit. Cash – Vault is an asset that went **up** → debit.",
        EXTRA_ACCOUNT:
          "The bills went into the teller drawer — **Cash – Vault** — not to the Fed. (Later the bank may ship surplus bills to the Fed: Dr Reserves / Cr Cash – Vault. That's a separate event.)",
        WRONG_TYPE: "To the bank, your deposit is money it **owes** you on demand — a **Liability**.",
      },
      showBalanceSheets: true,
      opening: bankOpening,
      trapAccounts: [yourCheckingTrap, depositRevenueTrap],
      perspectivePairId: '03-cash-to-checking',
      solution: [
        {
          id: 't1',
          label: 'Cash deposit',
          postings: [
            { accountId: 'vault-cash', side: 'dr', amount: usd(100) },
            { accountId: 'deposits-checking', side: 'cr', amount: usd(100) },
          ],
        },
      ],
    },
    {
      id: '04-bank-checking-to-savings',
      sectionId: '04-perspectives',
      kind: 'booking',
      title: "Checking → savings — the bank's view",
      role: 'practice',
      difficulty: 2,
      entityId: 'bank',
      prompt: "You **transfer $500 from your checking to your savings account** in the app. Book it in **First Example Bank's** books.",
      hints: [
        "Did any money enter or leave the bank? If not, do any of the bank's assets change?",
        'The bank owes you the same total — but in a different form. Which liability went down, and which went up?',
        'Liabilities decrease on the debit side and increase on the credit side.',
      ],
      explanation:
        "Nothing entered or left the bank, so no asset changes. The bank owes you $500 less on checking → **Dr Customer Deposits – Checking 500**, and $500 more on savings → **Cr Customer Deposits – Savings 500**. A **liability swap**: total liabilities and equity are unchanged. Your asset swap is the bank's liability swap.",
      diagnosticExplanations: {
        WRONG_SIDE: 'Both are liabilities (credit-normal). Checking deposits went **down** → debit; savings deposits went **up** → credit.',
        EXTRA_ACCOUNT: "No money moved in or out of the bank, so no cash or reserves account changes — and moving your balance isn't income or expense for the bank.",
      },
      showBalanceSheets: true,
      opening: bankOpening,
      trapAccounts: [
        yourCheckingTrap,
        {
          id: 'savings',
          name: 'Savings Account',
          type: 'asset',
          trap: {
            kind: 'counterparty',
            explanation: "**Savings Account** (asset) is *your* record. To the bank, your savings balance is a liability: **Customer Deposits – Savings**.",
          },
        },
      ],
      perspectivePairId: '03-checking-to-savings',
      solution: [
        {
          id: 't1',
          label: 'Transfer to savings',
          postings: [
            { accountId: 'deposits-checking', side: 'dr', amount: usd(500) },
            { accountId: 'deposits-savings', side: 'cr', amount: usd(500) },
          ],
        },
      ],
    },
    {
      id: '04-rewrite-savings-to-checking',
      sectionId: '04-perspectives',
      kind: 'booking',
      title: "Rewrite: the bank's entry → yours",
      role: 'practice',
      difficulty: 2,
      entityId: 'you',
      prompt:
        "First Example Bank booked the entry shown alongside when you moved some money between your accounts. **Write the matching entry in your own books.**",
      reference: {
        entityId: 'bank',
        caption: "First Example Bank's books",
        rows: [
          {
            id: 'b1',
            label: 'Customer transfer',
            postings: [
              { accountId: 'deposits-savings', side: 'dr', amount: usd(250) },
              { accountId: 'deposits-checking', side: 'cr', amount: usd(250) },
            ],
          },
        ],
      },
      hints: [
        "Read the bank's entry: it owes you $250 less on *savings* and $250 more on *checking*. Which way did your money move?",
        "Each bank liability is one of your assets. Which of your assets went up, and which went down?",
        'Asset up → debit; asset down → credit.',
      ],
      explanation:
        "The bank debited (reduced) what it owes you on savings and credited (increased) what it owes you on checking — you moved $250 **from savings to checking**. In your books: Checking (Asset) ↑ → **Dr Checking Account 250**; Savings (Asset) ↓ → **Cr Savings Account 250**. Notice that every account **flips sides** between the two books: the bank *credited* checking deposits and you *debit* Checking — because the bank's liability is your asset.",
      diagnosticExplanations: {
        WRONG_SIDE:
          "Don't copy the bank's sides. The bank's *liability* to you went up on checking (credit) — so *your asset* Checking went up, which is a **debit** in your books.",
        COUNTERPARTY_ACCOUNT: "Customer Deposits accounts live in the bank's books. In yours, use **Checking Account** and **Savings Account**.",
      },
      showBalanceSheets: false,
      // Starting balances so the entry doesn't take an account below zero.
      opening: { lines: [{ accountId: 'savings', amount: usd(250) }, { accountId: 'net-worth', amount: usd(250) }] },
      trapAccounts: [
        {
          id: 'deposits-checking',
          name: 'Customer Deposits – Checking',
          type: 'liability',
          trap: {
            kind: 'counterparty',
            explanation: "That's the bank's account (shown in the reference). In **your** books the same balance is your asset **Checking Account**.",
          },
        },
        {
          id: 'deposits-savings',
          name: 'Customer Deposits – Savings',
          type: 'liability',
          trap: {
            kind: 'counterparty',
            explanation: "That's the bank's account (shown in the reference). In **your** books the same balance is your asset **Savings Account**.",
          },
        },
      ],
      solution: [
        {
          id: 't1',
          label: 'Move savings to checking',
          postings: [
            { accountId: 'checking', side: 'dr', amount: usd(250) },
            { accountId: 'savings', side: 'cr', amount: usd(250) },
          ],
        },
      ],
    },
    {
      id: '04-rewrite-rent-same-bank',
      sectionId: '04-perspectives',
      kind: 'booking',
      title: "Rewrite: your rent payment → the bank's entry",
      role: 'practice',
      difficulty: 2,
      entityId: 'bank',
      prompt:
        "You paid **$1,200 rent** from checking (your entry is shown alongside). Your landlord, **Oakwood Property Management**, keeps its business account at **First Example Bank** too. **Write First Example Bank's entry.**",
      reference: {
        entityId: 'you',
        caption: 'Your books',
        rows: [
          {
            id: 'y1',
            label: 'Pay rent',
            postings: [
              { accountId: 'rent-expense', side: 'dr', amount: usd(1200) },
              { accountId: 'checking', side: 'cr', amount: usd(1200) },
            ],
          },
        ],
      },
      hints: [
        "Translate your accounts one at a time. Your Checking went down — what does that mean for what the bank owes you?",
        "Your Rent Expense is about *your* net worth. Does the bank have any rent expense here? Where did the money go instead?",
        "Did any money leave the bank? The landlord banks here too. What does the bank now owe the landlord?",
      ],
      explanation:
        "The bank owes you $1,200 less → **Dr Customer Deposits – Checking 1,200**. It owes Oakwood Property Management $1,200 more → **Cr Business Deposits 1,200**. No money left the bank, so no asset changes. Your **Rent Expense** has no counterpart in the bank's books: the expense is about *your* net worth; the bank just moved a balance from one depositor to another.",
      diagnosticExplanations: {
        WRONG_SIDE: "Both bank accounts are liabilities. Yours shrinks (debit); the landlord's grows (credit).",
        COUNTERPARTY_ACCOUNT: "Rent Expense and Checking Account are in *your* books (the reference). The bank records deposits it owes — **Customer Deposits – Checking** and **Business Deposits**.",
        EXTRA_ACCOUNT:
          "No cash or reserves moved — both parties bank at First Example Bank. And the bank isn't paying rent: its Occupancy Expense is for its own branches.",
      },
      showBalanceSheets: false,
      // Starting balances so the entry doesn't take an account below zero.
      opening: { lines: [{ accountId: 'reserves-fed', amount: usd(1200) }, { accountId: 'deposits-checking', amount: usd(1200) }] },
      trapAccounts: [
        {
          id: 'rent-expense',
          name: 'Rent Expense',
          type: 'expense',
          trap: {
            kind: 'counterparty',
            explanation: "Rent Expense is in **your** books (the reference). The bank didn't pay any rent — it only moved $1,200 from your deposit to the landlord's.",
          },
        },
        yourCheckingTrap,
        {
          id: 'rent-income',
          name: 'Rent Income',
          type: 'revenue',
          trap: {
            kind: 'counterparty',
            explanation: "Rent Income belongs in **the landlord's** books. The bank earns nothing from moving your rent.",
          },
        },
      ],
      perspectivePairId: '03-pay-rent',
      solution: [
        {
          id: 't1',
          label: 'Rent payment between customers',
          postings: [
            { accountId: 'deposits-checking', side: 'dr', amount: usd(1200) },
            { accountId: 'deposits-business', side: 'cr', amount: usd(1200) },
          ],
        },
      ],
    },
    {
      id: '04-rewrite-monthly-fee',
      sectionId: '04-perspectives',
      kind: 'booking',
      title: "Rewrite: the bank's fee → your entry",
      role: 'practice',
      difficulty: 2,
      entityId: 'you',
      prompt:
        "First Example Bank charges you its **$10 monthly maintenance fee**, taken straight out of your checking account. The bank's entry is shown alongside. **Write the entry in your own books.**",
      reference: {
        entityId: 'bank',
        caption: "First Example Bank's books",
        rows: [
          {
            id: 'b1',
            label: 'Monthly maintenance fee',
            postings: [
              { accountId: 'deposits-checking', side: 'dr', amount: usd(10) },
              { accountId: 'fee-income', side: 'cr', amount: usd(10) },
            ],
          },
        ],
      },
      hints: [
        'The bank owes you $10 less. What happened to your Checking Account?',
        "The bank earned $10 of revenue from you. What is the mirror image of someone else's revenue, in your books?",
        'Expenses increase on which side?',
      ],
      explanation:
        "The bank's liability to you fell → your asset **Checking Account** fell → **Cr Checking Account 10**. The bank's **Fee Income** is your **Bank Fees Expense** → **Dr Bank Fees Expense 10**. One party's revenue is the other's expense; one party's liability is the other's asset — and every side flips.",
      diagnosticExplanations: {
        WRONG_SIDE: "Checking is your asset and went down → credit. Bank Fees Expense went up → debit. Don't copy the bank's sides — they flip.",
        COUNTERPARTY_ACCOUNT: "Fee Income and Customer Deposits are the bank's accounts. In your books: **Bank Fees Expense** and **Checking Account**.",
      },
      showBalanceSheets: false,
      // Starting balances so the entry doesn't take an account below zero.
      opening: { lines: [{ accountId: 'checking', amount: usd(10) }, { accountId: 'net-worth', amount: usd(10) }] },
      trapAccounts: [
        {
          id: 'fee-income',
          name: 'Fee Income',
          type: 'revenue',
          trap: {
            kind: 'counterparty',
            explanation: "Fee Income is the **bank's** revenue. Paying a fee makes *you* poorer — in your books it is **Bank Fees Expense**.",
          },
        },
        {
          id: 'deposits-checking',
          name: 'Customer Deposits – Checking',
          type: 'liability',
          trap: {
            kind: 'counterparty',
            explanation: "That's the bank's liability account. Your side of the same balance is your asset **Checking Account**.",
          },
        },
      ],
      solution: [
        {
          id: 't1',
          label: 'Monthly maintenance fee',
          postings: [
            { accountId: 'bank-fees-expense', side: 'dr', amount: usd(10) },
            { accountId: 'checking', side: 'cr', amount: usd(10) },
          ],
        },
      ],
    },
    {
      id: '04-rewrite-utilities-other-bank',
      sectionId: '04-perspectives',
      kind: 'booking',
      title: 'Rewrite: paying someone at another bank',
      role: 'practice',
      difficulty: 3,
      entityId: 'bank',
      prompt:
        "You paid your **$90 electric bill** from checking (your entry is shown alongside — you booked it in §3). The electric company banks at **a different bank**. Assume the payment settles the same day between the two banks' accounts at the Federal Reserve. **Write First Example Bank's entry.**",
      reference: {
        entityId: 'you',
        caption: 'Your books',
        rows: [
          {
            id: 'y1',
            label: 'Pay electric bill',
            postings: [
              { accountId: 'utilities-expense', side: 'dr', amount: usd(90) },
              { accountId: 'checking', side: 'cr', amount: usd(90) },
            ],
          },
        ],
      },
      hints: [
        'Start with the part you know: your Checking went down. What does that mean for the bank?',
        "This time the money goes to **another bank**. The bank doesn't owe the electric company anything — so what does it give up?",
        "Banks settle with each other through their accounts at the Fed. Which of First Example Bank's assets went down?",
      ],
      explanation:
        "The bank owes you $90 less → **Dr Customer Deposits – Checking 90**. To pay the electric company's bank, First Example Bank transfers $90 of its **reserves at the Fed** → **Cr Reserves at the Federal Reserve 90**. Compare with the previous rewrite: when the payee banks *at the same bank*, it's a liability swap; when the payee banks *elsewhere*, the bank's reserves leave. (In reality payments like ACH settle in batches, with an in-transit step — we skip that here and revisit clearing in §11.)",
      diagnosticExplanations: {
        WRONG_SIDE: 'Customer Deposits (liability) went down → debit. Reserves (asset) went down → credit.',
        COUNTERPARTY_ACCOUNT: "Utilities Expense and Checking Account are your accounts. The bank has no electricity expense here.",
        EXTRA_ACCOUNT:
          "The electric company isn't a customer of First Example Bank, so **Business Deposits** doesn't change, and no bills leave the vault — the payment settles through **Reserves at the Federal Reserve**.",
        MISSING_ACCOUNT: "Money left the bank for another bank. Interbank payments settle in the banks' **reserve accounts at the Fed**.",
      },
      showBalanceSheets: false,
      // Starting balances so the entry doesn't take an account below zero.
      opening: { lines: [{ accountId: 'reserves-fed', amount: usd(90) }, { accountId: 'deposits-checking', amount: usd(90) }] },
      trapAccounts: [
        {
          id: 'utilities-expense',
          name: 'Utilities Expense',
          type: 'expense',
          trap: {
            kind: 'counterparty',
            explanation: "That's **your** expense (the reference). The bank didn't buy any electricity — it just paid out money it owed you.",
          },
        },
        yourCheckingTrap,
      ],
      perspectivePairId: '03-pay-utilities',
      solution: [
        {
          id: 't1',
          label: 'Outgoing payment to another bank',
          postings: [
            { accountId: 'deposits-checking', side: 'dr', amount: usd(90) },
            { accountId: 'reserves-fed', side: 'cr', amount: usd(90) },
          ],
        },
      ],
    },
    {
      id: '04-where-is-the-money',
      sectionId: '04-perspectives',
      kind: 'multiple-choice',
      title: 'Where is your $100 now?',
      role: 'practice',
      difficulty: 2,
      multi: true,
      prompt:
        'You deposited **$100 in cash** at First Example Bank. Read the callout **"Where is the bank\'s money?"**, then select **every true statement** about the situation a week later.',
      hints: [
        "Which side of the bank's balance sheet is your deposit on?",
        'Is there anything on the asset side labeled with your name?',
      ],
      explanation:
        "Your deposit is a **liability** of the bank: it owes you $100. The bills became the bank's asset and are **fungible** — the bank can move them around its asset side (vault → Fed reserves → securities or loans) without changing what it owes you. There's no account at the Fed with your name on it, and since March 2020 the US statutory reserve requirement has been 0%.",
      options: [
        { text: 'The bank owes you $100; on its books that is a liability.', correct: true, explanation: 'Yes — Customer Deposits – Checking.' },
        { text: "Your $100 sits in a sub-account at the Federal Reserve with your name on it.", correct: false, explanation: "No. The Fed holds one reserve balance for the whole bank. There's no 1:1 mapping from your deposit to any slice of it." },
        { text: 'By law, the bank must keep at least 10% of your deposit as reserves.', correct: false, explanation: 'The US statutory reserve requirement has been **0% since March 2020**. Banks hold reserves for liquidity and other regulatory reasons, not a fixed ratio.' },
        { text: 'The bank may have shipped the bills to the Fed or used the money to fund loans or buy securities — and it still owes you exactly $100.', correct: true, explanation: 'Right. Moves on the asset side don\'t change the liability to you.' },
        { text: 'If the bank uses some of its money to buy securities, your balance goes down.', correct: false, explanation: 'Buying securities is an asset swap for the bank (Dr Securities / Cr Reserves). Your deposit — a liability — is unchanged.' },
      ],
    },
    {
      id: '04-review-savings-interest',
      sectionId: '04-perspectives',
      kind: 'booking',
      title: 'Review: interest lands in your savings',
      role: 'review',
      difficulty: 2,
      entityId: 'you',
      prompt: 'Review from §3. The bank pays **$50 of interest** into your **savings account**. Book it in **your** books.',
      hints: [
        'Start with the account you can see changing: Savings. Up or down?',
        "You didn't give anything up and you don't owe it back. What kind of account explains a gain?",
      ],
      explanation:
        "Savings (Asset) ↑ → **Dr Savings Account 50**. You earned it → **Cr Interest Income 50** (Revenue ↑ → credit). Your net worth rose by $50. (In the bank's books, the mirror image is Dr Interest Expense / Cr Customer Deposits – Savings.)",
      diagnosticExplanations: {
        WRONG_SIDE: 'Interest Income is revenue → credit-normal → credited when it goes up. Savings is an asset going up → debit.',
        EXTRA_ACCOUNT: "Only Savings and Interest Income change. Don't credit Net Worth directly — use the income account so you can see where the gain came from.",
      },
      showBalanceSheets: false,
      trapAccounts: [
        {
          id: 'interest-receivable',
          name: 'Interest Receivable',
          type: 'asset',
          trap: {
            kind: 'near-synonym',
            explanation: "Interest Receivable would mean the bank still *owes* you the interest. It's already in your savings account, and as a cash-basis person you record it when you get it: **Interest Income**.",
          },
        },
        {
          id: 'deposits-savings',
          name: 'Customer Deposits – Savings',
          type: 'liability',
          trap: {
            kind: 'counterparty',
            explanation: "That's the bank's account. In your books your savings balance is the asset **Savings Account**.",
          },
        },
      ],
      solution: [
        {
          id: 't1',
          label: 'Interest received',
          postings: [
            { accountId: 'savings', side: 'dr', amount: usd(50) },
            { accountId: 'interest-income', side: 'cr', amount: usd(50) },
          ],
        },
      ],
    },
    {
      id: '04-review-dinner-on-card',
      sectionId: '04-perspectives',
      kind: 'booking',
      title: 'Review: dinner on the credit card',
      role: 'review',
      difficulty: 1,
      entityId: 'you',
      prompt: 'Review from §3. You pay for a **$45 dinner** with your **credit card**. Book it in **your** books.',
      hints: ['Did money leave checking today?', 'What do you now owe, and what did you spend it on?'],
      explanation:
        "You owe the card issuer $45 more → **Cr Credit Card Payable 45**. The dinner is eaten → **Dr Dining Out Expense 45**. Checking isn't touched until you pay the card bill.",
      diagnosticExplanations: {
        WRONG_SIDE: 'Credit Card Payable is a liability (credit-normal) going up → credit. Dining Out Expense going up → debit.',
        EXTRA_ACCOUNT: 'No money left your checking account today — only the card balance changed.',
      },
      showBalanceSheets: false,
      trapAccounts: [
        {
          id: 'credit-card-expense',
          name: 'Credit Card Expense',
          type: 'expense',
          trap: {
            kind: 'near-synonym',
            explanation: 'The card is how you paid; the expense is for what you bought — **Dining Out Expense**.',
          },
        },
        {
          id: 'credit-card-receivable',
          name: 'Credit Card Receivable',
          type: 'asset',
          trap: {
            kind: 'counterparty',
            explanation: "That's the card issuer's account for what you owe them. Yours is **Credit Card Payable**.",
          },
        },
      ],
      solution: [
        {
          id: 't1',
          label: 'Dinner on card',
          postings: [
            { accountId: 'dining-expense', side: 'dr', amount: usd(45) },
            { accountId: 'credit-card-payable', side: 'cr', amount: usd(45) },
          ],
        },
      ],
    },
  ],
};
export default mod;
