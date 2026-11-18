import type { BalanceSheet, SectionModule, TrapAccount } from '@contracts';

/** Owned by C1. Loans — both sides (you and First Example Bank). */

const usd = (dollars: number) => dollars * 100;

/** Same simplified opening balance sheet for First Example Bank as §4. A 2,000,000 = L 1,800,000 + E 200,000. */
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

/** The bank's balance sheet after it has lent you $1,000 (loans and checking deposits each +1,000). */
const bankAfterLoan: BalanceSheet = {
  lines: bankOpening.lines.map((l) =>
    l.accountId === 'loans-receivable' || l.accountId === 'deposits-checking' ? { ...l, amount: l.amount + usd(1000) } : l,
  ),
};

/** Your balance sheet before borrowing. A 2,000 = L 0 + E 2,000. */
const youBeforeLoan: BalanceSheet = {
  lines: [
    { accountId: 'checking', amount: usd(500) },
    { accountId: 'savings', amount: usd(1500) },
    { accountId: 'net-worth', amount: usd(2000) },
  ],
};

/** Your balance sheet after borrowing $1,000. A 3,000 = L 1,000 + E 2,000. */
const youAfterLoan: BalanceSheet = {
  lines: [
    { accountId: 'checking', amount: usd(1500) },
    { accountId: 'savings', amount: usd(1500) },
    { accountId: 'loan-payable', amount: usd(1000) },
    { accountId: 'net-worth', amount: usd(2000) },
  ],
};

const loansReceivableTrapForYou: TrapAccount = {
  id: 'loans-receivable',
  name: 'Loans Receivable',
  type: 'asset',
  trap: {
    kind: 'counterparty',
    explanation: "**Loans Receivable** is the **bank's** asset — it is owed the money. In your books you *owe* it: **Loan Payable** (a liability).",
  },
};

const loanPayableTrapForBank: TrapAccount = {
  id: 'loan-payable',
  name: 'Loan Payable',
  type: 'liability',
  trap: {
    kind: 'counterparty',
    explanation: "**Loan Payable** is the **borrower's** liability. The bank is the lender: it is *owed* the money, so it records an asset, **Loans Receivable**.",
  },
};

const yourCheckingTrap: TrapAccount = {
  id: 'checking',
  name: 'Checking Account',
  type: 'asset',
  trap: {
    kind: 'counterparty',
    explanation: "**Checking Account** is the borrower's asset in *their* books. In the bank's books the same balance is a liability it owes: **Customer Deposits – Checking**.",
  },
};

const mod: SectionModule = {
  section: {
    id: '06-loans',
    number: 6,
    title: 'Loans — Both Sides',
    summary: 'Borrowing and repaying, in your books and the bank\'s — including compound entries with interest.',
    primer: `
A loan is one claim seen from two sides:

| | **Your** books (borrower) | **Bank's** books (lender) |
|---|---|---|
| The claim | **Loan Payable** — liability | **Loans Receivable** — asset |
| The money | **Checking Account** — asset | **Customer Deposits – Checking** — liability |
| The price of borrowing | **Interest Expense** | **Interest Income** |

**Principal vs. interest.** *Principal* is the amount borrowed; repaying it just shrinks the debt (no gain or loss for anyone). *Interest* is the cost of borrowing: an **expense** for the borrower and **revenue** for the lender. A single repayment usually contains both, so it's booked as **one compound entry** with three lines:

\`\`\`tentry
You make a repayment on the loan ($1,000 principal + $50 interest)
Loan Payable (liability): Dr 1,000
Interest Expense (expense): Dr 50
Checking Account (asset): Cr 1,050

The bank receives your payment
Customer Deposits – Checking (liability): Dr 1,050
Loans Receivable (asset): Cr 1,000
Interest Income (revenue): Cr 50
\`\`\`

Check both: Σ Dr = Σ Cr, and every account mirrors its counterpart on the other side.

*Simplification:* in this section the bank records interest when it's paid. Real banks (accrual basis) record interest **daily** as it's earned — you'll do that in §8.
`.trim(),
    callouts: [
      {
        title: 'The loan created a deposit',
        body: `
When First Example Bank lends you $1,000, it doesn't take $1,000 out of anyone else's account, and it doesn't touch its reserves. It records two new things at once:

- an **asset**: Loans Receivable +1,000 (you owe it), and
- a **liability**: Customer Deposits – Checking +1,000 (it owes you).

The bank's balance sheet **grows on both sides**. The $1,000 in your checking account is a **brand-new deposit** — new money that didn't exist before the loan. (When you repay, the reverse happens and the deposit disappears.)

Reserves (or vault cash) only come into it when you **spend** the money at another bank or withdraw it as cash: then the bank must settle by sending reserves at the Fed, or hand over bills from the vault. That — along with capital rules, liquidity needs and whether the loan is profitable — is what limits how much a bank lends, not a fixed slice of existing deposits.
`.trim(),
      },
    ],
    lens: `
**Ledger-engineer's lens.** A loan payment is **one event → one transaction** with several postings (principal, interest, cash). Don't book principal and interest as separate transactions, and don't net them into one "loan balance" account — keep **principal** (balance sheet) and **interest** (income statement) in separate accounts so reports are right. A lending system usually keeps a **loan sub-ledger** (per-loan principal, accrued interest, fees) whose totals must reconcile to the GL's Loans Receivable every day.
`.trim(),
    problemIds: [
      '06-you-borrow',
      '06-bank-lends',
      '06-you-repay',
      '06-bank-repaid',
      '06-car-payment',
      '06-rewrite-partial-payment',
      '06-loan-spent-elsewhere',
      '06-loan-created-deposit',
      '06-review-rent-compound',
      '06-review-overdraft-fee',
    ],
  },
  problems: [
    {
      id: '06-you-borrow',
      sectionId: '06-loans',
      kind: 'booking',
      title: 'You borrow $1,000 (worked)',
      role: 'worked',
      difficulty: 2,
      entityId: 'you',
      prompt: 'First Example Bank lends you **$1,000**, deposited straight into your **checking account**. Book it in **your** books.',
      walkthrough: [
        "**Start from the account you're sure about:** Checking went **up** $1,000 → asset increase → **Dr Checking Account 1,000**.",
        'The row needs a $1,000 credit. Is the $1,000 income? No — you have to pay it back.',
        'Something you must pay back is a **liability**: **Loan Payable** goes **up** → liability increase → **Cr Loan Payable 1,000**.',
        'Balance sheet: assets 2,000 → 3,000 and liabilities 0 → 1,000. **Net worth stays 2,000** — borrowing doesn\'t make you richer.',
      ],
      hints: ['Which account are you sure about?', 'Do you get to keep the $1,000 for free? If not, what do you have now?'],
      explanation:
        "Checking (Asset) ↑ → **Dr Checking Account 1,000**. You owe the bank → Loan Payable (Liability) ↑ → **Cr Loan Payable 1,000**. Assets and liabilities both rise by 1,000; net worth is unchanged. Borrowed money is not income.",
      diagnosticExplanations: {
        WRONG_SIDE: 'Loan Payable is a liability (credit-normal) going **up** → credit. Checking is an asset going up → debit.',
        EXTRA_ACCOUNT: "Borrowed money isn't income — you have to pay it back. No revenue account belongs here.",
      },
      showBalanceSheets: true,
      opening: youBeforeLoan,
      trapAccounts: [
        loansReceivableTrapForYou,
        {
          id: 'loan-income',
          name: 'Loan Income',
          type: 'revenue',
          trap: {
            kind: 'other',
            explanation: "A loan isn't income: every dollar comes with a matching obligation to repay. Your net worth doesn't change.",
          },
        },
      ],
      perspectivePairId: '06-bank-lends',
      solution: [
        {
          id: 't1',
          label: 'Borrow $1,000',
          postings: [
            { accountId: 'checking', side: 'dr', amount: usd(1000) },
            { accountId: 'loan-payable', side: 'cr', amount: usd(1000) },
          ],
        },
      ],
    },
    {
      id: '06-bank-lends',
      sectionId: '06-loans',
      kind: 'booking',
      title: 'The bank lends $1,000 (partly filled)',
      role: 'faded',
      difficulty: 2,
      entityId: 'bank',
      prompt:
        "Same loan, **First Example Bank's** books: it lends you **$1,000** and puts it into your checking account. The loan side is filled in. **Complete the entry** — and read the callout \"The loan created a deposit\".",
      hints: [
        'The bank is now owed $1,000 (given). The row needs a $1,000 credit. Did any cash or reserves leave the bank?',
        'Where did the $1,000 go? Into your checking account — which the bank records how?',
        'The bank now **owes** you $1,000 more. Which liability, and which side increases it?',
      ],
      explanation:
        "The bank is owed $1,000 → **Dr Loans Receivable 1,000** (given). It credited your checking account, so it owes you $1,000 more → **Cr Customer Deposits – Checking 1,000**. No cash or reserves moved: **the loan created a deposit**. The bank's balance sheet grows on both sides by 1,000; its equity is unchanged.",
      diagnosticExplanations: {
        WRONG_SIDE: 'Customer Deposits – Checking is a liability going **up** → credit.',
        EXTRA_ACCOUNT:
          "Reserves at the Federal Reserve and Cash – Vault don't change: no money left the bank. The loan was paid out by creating a deposit. Reserves only move later, if you spend the money at another bank.",
        MISSING_ACCOUNT: 'The $1,000 landed in your checking account. In the bank\'s books, that is **Customer Deposits – Checking**.',
      },
      showBalanceSheets: true,
      opening: bankOpening,
      trapAccounts: [loanPayableTrapForBank, yourCheckingTrap],
      perspectivePairId: '06-you-borrow',
      prefill: {
        locked: true,
        rows: [{ id: 't1', label: 'Make loan', postings: [{ accountId: 'loans-receivable', side: 'dr', amount: usd(1000) }] }],
      },
      solution: [
        {
          id: 't1',
          label: 'Make loan',
          postings: [
            { accountId: 'loans-receivable', side: 'dr', amount: usd(1000) },
            { accountId: 'deposits-checking', side: 'cr', amount: usd(1000) },
          ],
        },
      ],
    },
    {
      id: '06-you-repay',
      sectionId: '06-loans',
      kind: 'booking',
      title: 'You repay $1,000 + $50 interest',
      role: 'practice',
      difficulty: 3,
      entityId: 'you',
      prompt:
        'A few months later you repay the loan in full: **$1,000 principal plus $50 interest**, a single **$1,050** payment from **checking**. Book it in **your** books as **one** entry.',
      hints: [
        'Start with Checking: how much left, and which side?',
        'That $1,050 credit needs $1,050 of debits. Part of it pays off what you owe — which account, which side?',
        "The other $50 isn't paying off debt; it's the price of borrowing. Did it make you richer or poorer?",
      ],
      explanation:
        '```journal\nDr  Loan Payable        1,000\nDr  Interest Expense       50\n    Cr  Checking Account      1,050\n```\nChecking (Asset) ↓ 1,050 → credit. The debt is gone → Loan Payable (Liability) ↓ 1,000 → debit. The $50 is the cost of borrowing → Interest Expense ↑ → debit. Assets fall 1,050 = liabilities fall 1,000 + equity falls 50. Repaying principal doesn\'t change your net worth; only the interest does.',
      diagnosticExplanations: {
        WRONG_SIDE:
          'Paying down a liability is a **debit** (Loan Payable is credit-normal). Interest Expense going up is a debit. Checking going down is a credit.',
        WRONG_AMOUNT: 'Split the payment: **1,000** reduces Loan Payable (principal), **50** is Interest Expense, and Checking falls by the full **1,050**.',
        SPLIT_ENTRY: 'One payment = one transaction. Book principal and interest as two lines of a single compound entry, not two separate transactions.',
        MISSING_ACCOUNT: 'The $50 of interest is the cost of borrowing — it belongs in **Interest Expense**, not in Loan Payable.',
      },
      showBalanceSheets: true,
      opening: youAfterLoan,
      trapAccounts: [
        loansReceivableTrapForYou,
        {
          id: 'interest-payable',
          name: 'Interest Payable',
          type: 'liability',
          trap: {
            kind: 'near-synonym',
            explanation: "**Interest Payable** is interest you *owe but haven't paid*. You're paying it now, and on a cash basis you record it as **Interest Expense** when paid.",
          },
        },
        {
          id: 'loan-expense',
          name: 'Loan Expense',
          type: 'expense',
          trap: {
            kind: 'near-synonym',
            explanation: "Repaying the **principal** isn't an expense — it just clears a debt (Loan Payable). Only the $50 of **interest** is a cost.",
          },
        },
      ],
      perspectivePairId: '06-bank-repaid',
      solution: [
        {
          id: 't1',
          label: 'Repay loan with interest',
          postings: [
            { accountId: 'loan-payable', side: 'dr', amount: usd(1000) },
            { accountId: 'interest-expense', side: 'dr', amount: usd(50) },
            { accountId: 'checking', side: 'cr', amount: usd(1050) },
          ],
        },
      ],
    },
    {
      id: '06-bank-repaid',
      sectionId: '06-loans',
      kind: 'booking',
      title: 'The bank is repaid $1,000 + $50 interest',
      role: 'practice',
      difficulty: 3,
      entityId: 'bank',
      prompt:
        "Same repayment, **First Example Bank's** books: you pay **$1,050** from your checking account at the bank — **$1,000 principal + $50 interest**. Book it as **one** entry. (Simplification: the bank records the interest when it's paid; in §8 you'll accrue it daily.)",
      hints: [
        'The money came from your checking account at this bank. What happens to what the bank owes you?',
        "The bank is no longer owed the principal. Which asset goes down?",
        "The $50 isn't returning principal — it's what the bank earned for lending. What type of account?",
      ],
      explanation:
        "```journal\nDr  Customer Deposits – Checking   1,050\n    Cr  Loans Receivable                1,000\n    Cr  Interest Income                    50\n```\nThe bank owes you 1,050 less (liability ↓ → debit). It is no longer owed the 1,000 principal (asset ↓ → credit). It earned 50 (revenue ↑ → credit). Liabilities fall 1,050 = assets fall 1,000 + equity rises 50. Mirror image of your entry: your Interest Expense is its Interest Income. And notice the repayment **destroyed** $1,050 of deposits.",
      diagnosticExplanations: {
        WRONG_SIDE:
          'Customer Deposits (liability) ↓ → debit. Loans Receivable (asset) ↓ → credit. Interest Income (revenue) ↑ → credit.',
        WRONG_AMOUNT: 'Only the **1,000** of principal reduces Loans Receivable; the **50** is Interest Income; your deposit falls by the full **1,050**.',
        EXTRA_ACCOUNT:
          "**Interest Receivable** is used when interest has been *accrued* earlier (§8). Here we assume nothing was accrued, so the $50 goes straight to **Interest Income**. And no reserves or vault cash move — you paid from an account at this bank.",
        SPLIT_ENTRY: 'One repayment = one transaction with three lines.',
      },
      showBalanceSheets: true,
      opening: bankAfterLoan,
      trapAccounts: [
        loanPayableTrapForBank,
        yourCheckingTrap,
        {
          id: 'interest-expense-borrower',
          name: 'Interest Expense – Borrowers',
          type: 'expense',
          trap: {
            kind: 'counterparty',
            explanation: "The borrower's interest **expense** is the bank's interest **income**. The bank earned the $50 — credit **Interest Income**.",
          },
        },
      ],
      perspectivePairId: '06-you-repay',
      solution: [
        {
          id: 't1',
          label: 'Loan repaid with interest',
          postings: [
            { accountId: 'deposits-checking', side: 'dr', amount: usd(1050) },
            { accountId: 'loans-receivable', side: 'cr', amount: usd(1000) },
            { accountId: 'interest-income', side: 'cr', amount: usd(50) },
          ],
        },
      ],
    },
    {
      id: '06-car-payment',
      sectionId: '06-loans',
      kind: 'booking',
      title: 'A monthly car-loan payment',
      role: 'practice',
      difficulty: 3,
      entityId: 'you',
      prompt:
        'Your car-loan statement says this month\'s **$400 payment** is **$350 principal and $50 interest**. You pay it from **checking**. Book it in **your** books, then **fill in the after balance sheet**. (In the after balance sheet, Net Worth keeps its opening balance until period-end; the expense appears as its own line on the equity side.)',
      hints: [
        'Start from Checking: down 400 → which side?',
        'Split the $400 the way the statement does. Which part reduces what you owe?',
        "For the balance sheet: the car itself is unaffected. Interest Expense appears as its own line on the equity side; Net Worth itself doesn't change until period-end.",
      ],
      explanation:
        '```journal\nDr  Car Loan Payable     350\nDr  Interest Expense      50\n    Cr  Checking Account      400\n```\nAfter: Checking 1,600; Car 18,000 (unchanged — paying the loan doesn\'t change the car); Car Loan Payable 14,650; equity = Net Worth 5,000 − Interest Expense 50 = 4,950. Check: 19,600 = 14,650 + 4,950 ✓.',
      diagnosticExplanations: {
        WRONG_SIDE: 'Car Loan Payable (liability) ↓ → debit. Interest Expense ↑ → debit. Checking ↓ → credit.',
        WRONG_AMOUNT: 'Only the **350** of principal reduces the loan. The **50** of interest is an expense. Checking falls by the full **400**.',
        EXTRA_ACCOUNT: "The car is still yours and still worth what you recorded; a loan payment doesn't touch the **Car** account.",
        BS_MISMATCH: 'After: Checking 2,000 − 400 = 1,600; Car Loan Payable 15,000 − 350 = 14,650; Interest Expense 50; Car and Net Worth unchanged.',
      },
      showBalanceSheets: true,
      askAfterBalanceSheet: true,
      opening: {
        lines: [
          { accountId: 'checking', amount: usd(2000) },
          { accountId: 'car', amount: usd(18000) },
          { accountId: 'car-loan-payable', amount: usd(15000) },
          { accountId: 'net-worth', amount: usd(5000) },
        ],
      },
      trapAccounts: [
        {
          id: 'car-expense',
          name: 'Car Expense',
          type: 'expense',
          trap: {
            kind: 'near-synonym',
            explanation: "The principal part of a loan payment isn't an expense — it reduces **Car Loan Payable**. Only the interest is a cost of borrowing.",
          },
        },
        {
          id: 'car-loan-receivable',
          name: 'Car Loan Receivable',
          type: 'asset',
          trap: {
            kind: 'counterparty',
            explanation: "That's the **lender's** asset. You owe the money: **Car Loan Payable**.",
          },
        },
      ],
      solution: [
        {
          id: 't1',
          label: 'Car loan payment',
          postings: [
            { accountId: 'car-loan-payable', side: 'dr', amount: usd(350) },
            { accountId: 'interest-expense', side: 'dr', amount: usd(50) },
            { accountId: 'checking', side: 'cr', amount: usd(400) },
          ],
        },
      ],
    },
    {
      id: '06-rewrite-partial-payment',
      sectionId: '06-loans',
      kind: 'booking',
      title: "Rewrite: a partial payment in the bank's books",
      role: 'practice',
      difficulty: 3,
      entityId: 'bank',
      prompt:
        "Later you take out another personal loan, and this month you make a **$200** payment on it from your checking account at First Example Bank. **Your** entry is shown alongside. **Write the bank's entry** (record the interest when paid).",
      reference: {
        entityId: 'you',
        caption: 'Your books',
        rows: [
          {
            id: 'y1',
            label: 'Loan payment',
            postings: [
              { accountId: 'loan-payable', side: 'dr', amount: usd(180) },
              { accountId: 'interest-expense', side: 'dr', amount: usd(20) },
              { accountId: 'checking', side: 'cr', amount: usd(200) },
            ],
          },
        ],
      },
      hints: [
        "Translate one account at a time. The borrower's Checking went down 200 — what does that mean for the bank?",
        "The borrower's Loan Payable went down 180. What is that same claim called in the bank's books?",
        "The borrower's Interest Expense is the bank's…?",
      ],
      explanation:
        "```journal\nDr  Customer Deposits – Checking   200\n    Cr  Loans Receivable                180\n    Cr  Interest Income                  20\n```\nEach account flips: borrower's Checking (asset, Cr) ↔ bank's Customer Deposits (liability, **Dr**); Loan Payable (liability, Dr) ↔ Loans Receivable (asset, **Cr**); Interest Expense (Dr) ↔ Interest Income (**Cr**).",
      diagnosticExplanations: {
        WRONG_SIDE: "Every account flips sides between borrower and lender. Don't copy the reference's sides.",
        COUNTERPARTY_ACCOUNT: "Loan Payable, Interest Expense and Checking Account are the borrower's accounts (the reference). The bank uses Loans Receivable, Interest Income and Customer Deposits – Checking.",
        WRONG_AMOUNT: 'Principal 180 → Loans Receivable; interest 20 → Interest Income; deposit falls by 200.',
      },
      showBalanceSheets: false,
      trapAccounts: [loanPayableTrapForBank, yourCheckingTrap],
      solution: [
        {
          id: 't1',
          label: 'Loan payment received',
          postings: [
            { accountId: 'deposits-checking', side: 'dr', amount: usd(200) },
            { accountId: 'loans-receivable', side: 'cr', amount: usd(180) },
            { accountId: 'interest-income', side: 'cr', amount: usd(20) },
          ],
        },
      ],
    },
    {
      id: '06-loan-spent-elsewhere',
      sectionId: '06-loans',
      kind: 'statement-fill',
      title: 'When do reserves move?',
      role: 'practice',
      difficulty: 3,
      entityId: 'bank',
      statement: 'balance-sheet',
      prompt:
        "Two events in **First Example Bank's** books (already booked): (1) it lends you **$1,000** into your checking account; (2) you spend **$400** of it at a store whose account is at **another bank**, and the payment settles through the Fed. **Fill in the bank's balance sheet after both.**",
      hints: [
        'Event 1 adds the same amount to one asset and one liability. Which ones?',
        'Event 2: the bank owes you less, and it must pay the other bank. Which asset does it use to settle?',
        'Accounts not touched by either event keep their opening balance.',
      ],
      explanation:
        'Loans Receivable 1,400,000 + 1,000 = **1,401,000**. Customer Deposits – Checking 1,000,000 + 1,000 − 400 = **1,000,600**. Reserves at the Fed 180,000 − 400 = **179,600**. Everything else unchanged. Totals: assets 2,000,600 = liabilities 1,800,600 + equity 200,000. The loan created a deposit without touching reserves; reserves left only when the money was spent at another bank.',
      opening: bankOpening,
      rows: [
        {
          id: 't1',
          label: 'Make loan',
          postings: [
            { accountId: 'loans-receivable', side: 'dr', amount: usd(1000) },
            { accountId: 'deposits-checking', side: 'cr', amount: usd(1000) },
          ],
        },
        {
          id: 't2',
          label: 'Customer pays another bank',
          postings: [
            { accountId: 'deposits-checking', side: 'dr', amount: usd(400) },
            { accountId: 'reserves-fed', side: 'cr', amount: usd(400) },
          ],
        },
      ],
      answer: {
        balanceSheet: {
          lines: [
            { accountId: 'vault-cash', amount: usd(20000) },
            { accountId: 'reserves-fed', amount: usd(179600) },
            { accountId: 'securities', amount: usd(300000) },
            { accountId: 'loans-receivable', amount: usd(1401000) },
            { accountId: 'premises', amount: usd(100000) },
            { accountId: 'deposits-checking', amount: usd(1000600) },
            { accountId: 'deposits-savings', amount: usd(600000) },
            { accountId: 'deposits-business', amount: usd(200000) },
            { accountId: 'paid-in-capital', amount: usd(100000) },
            { accountId: 'retained-earnings', amount: usd(100000) },
          ],
        },
      },
    },
    {
      id: '06-loan-created-deposit',
      sectionId: '06-loans',
      kind: 'multiple-choice',
      title: 'Where did the loan money come from?',
      role: 'practice',
      difficulty: 2,
      multi: true,
      prompt: "Right after First Example Bank lends you $1,000 into your checking account (and before you spend any of it), which statements are **true**?",
      hints: ["Look at the bank's entry: which accounts changed?", 'Did any asset decrease?'],
      explanation:
        "The bank's entry is Dr Loans Receivable 1,000 / Cr Customer Deposits – Checking 1,000. Both sides of its balance sheet grew; nothing was taken from other depositors or from reserves. The loan **created** a new deposit. Equity doesn't change — the bank only earns from the loan later, as interest.",
      options: [
        { text: "The bank's Loans Receivable and Customer Deposits both rose by $1,000.", correct: true, explanation: 'Yes — the balance sheet grew on both sides.' },
        { text: "The bank's reserves at the Fed fell by $1,000.", correct: false, explanation: 'No money left the bank. Reserves move only if you pay someone at another bank.' },
        { text: "The bank moved $1,000 out of other customers' deposit accounts.", correct: false, explanation: "No other depositor's balance changed. The deposit in your account is brand new." },
        { text: 'The loan created a new $1,000 deposit that did not exist before.', correct: true, explanation: 'Exactly — this is how bank lending creates money.' },
        { text: "The bank's equity rose by $1,000.", correct: false, explanation: "Making a loan isn't income: a new asset is matched by a new liability. Equity only rises later as interest is earned." },
      ],
    },
    {
      id: '06-review-rent-compound',
      sectionId: '06-loans',
      kind: 'booking',
      title: 'Review: rent paid two ways',
      role: 'review',
      difficulty: 2,
      entityId: 'you',
      prompt:
        'Review from §5. You pay your **$1,200 rent**: **$1,000 by transfer from checking** and **$200 in cash**. Book it in **your** books as **one** journal entry.',
      hints: ['One event, one entry — how many lines?', 'Which accounts did the money come out of, and what did it pay for?', 'Two credits, one debit.'],
      explanation:
        '```journal\nDr  Rent Expense        1,200\n    Cr  Checking Account      1,000\n    Cr  Cash                    200\n```\nOne rent payment, paid from two sources: a compound entry with one debit and two credits.',
      diagnosticExplanations: {
        SPLIT_ENTRY: 'It\'s one rent payment, so book one transaction with three lines rather than two separate entries.',
        WRONG_AMOUNT: 'Rent Expense is the full 1,200; Checking falls 1,000 and Cash falls 200.',
        WRONG_SIDE: 'Rent Expense ↑ → debit. Checking and Cash (assets) ↓ → credit.',
      },
      showBalanceSheets: false,
      journalView: true,
      trapAccounts: [
        {
          id: 'rent-payable',
          name: 'Rent Payable',
          type: 'liability',
          trap: {
            kind: 'near-synonym',
            explanation: "You paid in full, so you don't owe anything. Rent Payable is for rent you owe but haven't paid.",
          },
        },
        {
          id: 'rent-income',
          name: 'Rent Income',
          type: 'revenue',
          trap: {
            kind: 'counterparty',
            explanation: "Rent Income belongs in your **landlord's** books.",
          },
        },
      ],
      solution: [
        {
          id: 't1',
          label: 'Pay rent',
          postings: [
            { accountId: 'rent-expense', side: 'dr', amount: usd(1200) },
            { accountId: 'checking', side: 'cr', amount: usd(1000) },
            { accountId: 'cash', side: 'cr', amount: usd(200) },
          ],
        },
      ],
    },
    {
      id: '06-review-overdraft-fee',
      sectionId: '06-loans',
      kind: 'booking',
      title: "Review: a fee in the bank's books",
      role: 'review',
      difficulty: 2,
      entityId: 'bank',
      prompt: "Review from §4. First Example Bank charges a customer a **$35 overdraft fee**, taken from the customer's **checking account**. Book it in **the bank's** books.",
      hints: ['What does the bank owe the customer after the fee?', 'Did the bank earn something? What type of account?'],
      explanation:
        "The bank owes the customer $35 less → **Dr Customer Deposits – Checking 35**. It earned a fee → **Cr Fee Income 35**. Liabilities fall 35, equity rises 35. (The customer books the mirror image: Dr Bank Fees Expense / Cr Checking.)",
      diagnosticExplanations: {
        WRONG_SIDE: 'Customer Deposits (liability) ↓ → debit. Fee Income (revenue) ↑ → credit.',
        EXTRA_ACCOUNT: 'No cash or reserves move: the fee is taken from a balance the bank already holds — it simply owes the customer less.',
      },
      showBalanceSheets: false,
      trapAccounts: [
        {
          id: 'bank-fees-expense',
          name: 'Bank Fees Expense',
          type: 'expense',
          trap: {
            kind: 'counterparty',
            explanation: "That's the **customer's** expense. For the bank the same fee is revenue: **Fee Income**.",
          },
        },
        yourCheckingTrap,
      ],
      solution: [
        {
          id: 't1',
          label: 'Overdraft fee',
          postings: [
            { accountId: 'deposits-checking', side: 'dr', amount: usd(35) },
            { accountId: 'fee-income', side: 'cr', amount: usd(35) },
          ],
        },
      ],
    },
  ],
};
export default mod;
