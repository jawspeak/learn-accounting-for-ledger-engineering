import type { SectionModule } from '@contracts';

/** Owned by C1. Debits, credits, normal balances. */

const mod: SectionModule = {
  section: {
    id: '02-debits-credits',
    number: 2,
    title: 'Debits, Credits & Normal Balances',
    summary: 'Debit = left, credit = right — and which side makes each account type grow.',
    primer: `
**Debit (Dr) means left. Credit (Cr) means right.** That's all. They don't mean "good" or "bad", "add" or "subtract", "money in" or "money out" — those depend on the account.

Every account has a **[[normal side]]**: the side that **increases** it. The other side decreases it.

| Type | Increases with | Decreases with |
|---|---|---|
| Asset | **Dr** | Cr |
| Expense | **Dr** | Cr |
| [[Dividends / draws]] | **Dr** | Cr |
| Liability | **Cr** | Dr |
| [[Equity]] | **Cr** | Dr |
| [[Revenue]] | **Cr** | Dr |

Mnemonic: **DEALER** — Dividends, [[Expenses]], [[Assets]] are debit-normal; [[Liabilities]], Equity, Revenue are credit-normal.

Why this layout? \`A = L + E\`: assets are on the left, so they grow on the left (debit); liabilities and equity are on the right, so they grow on the right (credit). Revenue grows equity → credit. Expenses and dividends shrink equity → debit.

<!-- figure:cheat-sheet -->

**[[Double entry]]'s rule is:** in every transaction, total [[debits]] = total [[credits]]. That keeps the equation balanced automatically.

**To decide Dr or Cr:** (1) What type is the account? (2) Did it go up or down? (3) Up → normal side; down → the other side.
`.trim(),
    callouts: [
      {
        title: 'Why does my bank statement say "credit" when I get paid?',
        body: `
Your bank statement is printed **from the bank's books, not yours**. To the bank, your balance is a **liability** — money it owes you. Liabilities increase with a **credit**, so when your paycheck lands, the bank *credits* your deposit account.

In **your** books the same money is an **asset** (Checking Account), and it increases with a **debit**.

Same event, two sets of books, opposite sides. That's why "credit = money coming in" feels true on a statement but is backwards for your own books. You'll see this again in §4 (Perspectives).
`.trim(),
      },
    ],
    lens: `
**Ledger-engineer's lens.** Most [[ledgers]] store each [[posting]] as either (\`side\`, positive \`amount\`) or a single **signed** amount (commonly Dr = +, Cr = −). With signed amounts, an account's raw balance is \`SUM(amount)\`; for credit-normal accounts (liabilities, equity, revenue) you **flip the sign for display**. So a customer's deposit account at a bank naturally sums to a *negative* number — that's not a bug, it's a credit balance. Decide the sign convention once, document it, and derive "normal side" from the account type rather than storing it per posting.
`.trim(),
    problemIds: [
      '02-predict-worked',
      '02-predict-faded',
      '02-predict-increases',
      '02-predict-decreases',
      '02-predict-bank',
      '02-bank-statement-credit',
      '02-reverse-credit-checking',
      '02-reverse-which-went-up',
      '02-signed-amounts',
      '02-review-classify',
      '02-review-equation',
    ],
  },
  problems: [
    {
      id: '02-predict-worked',
      sectionId: '02-debits-credits',
      kind: 'dr-cr-predict',
      title: 'Dr or Cr? (worked)',
      role: 'worked',
      difficulty: 1,
      prompt: 'For each change in **your** books, choose the side it is recorded on. Step through the walkthrough first.',
      walkthrough: [
        'Use the same three questions every time: **type? up or down? normal side?**',
        '**Cash increases.** Asset → normal side Dr → increase = **Dr**.',
        '**Credit Card Payable increases.** Liability → normal side Cr → increase = **Cr**.',
        '**Salary Income increases.** Revenue (grows equity) → normal side Cr → increase = **Cr**.',
        '**Rent Expense increases.** Expense (shrinks equity) → normal side Dr → increase = **Dr**.',
      ],
      hints: ['Type → up or down → normal side.', 'DEALER: Dividends, Expenses, Assets are debit-normal.'],
      explanation:
        'Increases go on the normal side: Cash **Dr**, Credit Card Payable **Cr**, Salary Income **Cr**, Rent Expense **Dr**. The cheat sheet shows the normal side of every account type at a glance:\n\n<!-- figure:cheat-sheet -->',
      items: [
        { accountName: 'Cash', accountType: 'asset', change: 'increase', answer: 'dr', explanation: 'Assets increase with a debit.' },
        { accountName: 'Credit Card Payable', accountType: 'liability', change: 'increase', answer: 'cr', explanation: 'Liabilities increase with a credit.' },
        { accountName: 'Salary Income', accountType: 'revenue', change: 'increase', answer: 'cr', explanation: 'Revenue increases with a credit.' },
        { accountName: 'Rent Expense', accountType: 'expense', change: 'increase', answer: 'dr', explanation: 'Expenses increase with a debit.' },
      ],
    },
    {
      id: '02-predict-faded',
      sectionId: '02-debits-credits',
      kind: 'dr-cr-predict',
      title: 'Dr or Cr? (increases and decreases, partly worked)',
      role: 'faded',
      difficulty: 1,
      prompt: 'Now a mix of **increases and decreases** — read each arrow. The walkthrough does the first one; you do the rest.',
      walkthrough: [
        '**Savings Account decreases.** Asset → normal side Dr → a *decrease* goes on the **other** side = **Cr**.',
        'Now you: for each remaining account, find its normal side, then flip it if the account went down.',
      ],
      hints: ['A decrease goes on the side opposite the normal side.', 'Liabilities are credit-normal, so paying one down is a…?'],
      explanation:
        'Savings ↓ → **Cr**. Net Worth ↑ → **Cr** (equity is credit-normal). Car Loan Payable ↓ → **Dr** (opposite of its normal credit side). Groceries Expense ↑ → **Dr**.',
      items: [
        { accountName: 'Savings Account', accountType: 'asset', change: 'decrease', answer: 'cr', explanation: 'Asset decreases are credits.' },
        { accountName: 'Net Worth', accountType: 'equity', change: 'increase', answer: 'cr', explanation: 'Equity increases with a credit.' },
        { accountName: 'Car Loan Payable', accountType: 'liability', change: 'decrease', answer: 'dr', explanation: 'Paying down a liability is a debit.' },
        { accountName: 'Groceries Expense', accountType: 'expense', change: 'increase', answer: 'dr', explanation: 'Expenses increase with a debit.' },
      ],
    },
    {
      id: '02-predict-increases',
      sectionId: '02-debits-credits',
      kind: 'dr-cr-predict',
      title: 'Increases across all types',
      role: 'practice',
      difficulty: 1,
      prompt: 'Each account **increases**. Which side is it recorded on?',
      hints: ['An increase always goes on the normal side.', 'DEALER: D-E-A on the debit side, L-E-R on the credit side.'],
      explanation: 'Increases follow DEALER: Car, Utilities Expense, Owner Draws → **Dr**; Loan Payable, Net Worth, Interest Income, Gifts Received → **Cr**.',
      items: [
        { accountName: 'Car', accountType: 'asset', change: 'increase', answer: 'dr', explanation: 'Asset → debit-normal.' },
        { accountName: 'Loan Payable', accountType: 'liability', change: 'increase', answer: 'cr', explanation: 'Liability → credit-normal.' },
        { accountName: 'Net Worth', accountType: 'equity', change: 'increase', answer: 'cr', explanation: 'Equity → credit-normal.' },
        { accountName: 'Interest Income', accountType: 'revenue', change: 'increase', answer: 'cr', explanation: 'Revenue → credit-normal.' },
        { accountName: 'Utilities Expense', accountType: 'expense', change: 'increase', answer: 'dr', explanation: 'Expense → debit-normal.' },
        { accountName: 'Owner Draws', accountType: 'dividend', change: 'increase', answer: 'dr', explanation: 'Draws/dividends reduce equity → debit-normal.' },
        { accountName: 'Gifts Received', accountType: 'revenue', change: 'increase', answer: 'cr', explanation: 'Income of any kind is revenue → credit-normal.' },
      ],
    },
    {
      id: '02-predict-decreases',
      sectionId: '02-debits-credits',
      kind: 'dr-cr-predict',
      title: 'Decreases across all types',
      role: 'practice',
      difficulty: 2,
      prompt: 'Each account **decreases**. Which side is it recorded on?',
      hints: [
        'Find the normal side first, then take the opposite.',
        'A decrease to an expense is unusual (think: a refund), but the rule is the same.',
      ],
      explanation:
        'Decreases go opposite the normal side: Checking, Loan to a Friend → **Cr**; Credit Card Payable, Net Worth, Salary Income → **Dr**; Dining Out Expense (a refund) → **Cr**.',
      items: [
        { accountName: 'Checking Account', accountType: 'asset', change: 'decrease', answer: 'cr', explanation: 'Asset is debit-normal → decrease is a credit.' },
        { accountName: 'Credit Card Payable', accountType: 'liability', change: 'decrease', answer: 'dr', explanation: 'Liability is credit-normal → decrease (paying it off) is a debit.' },
        { accountName: 'Net Worth', accountType: 'equity', change: 'decrease', answer: 'dr', explanation: 'Equity is credit-normal → decrease is a debit.' },
        { accountName: 'Salary Income', accountType: 'revenue', change: 'decrease', answer: 'dr', explanation: 'Revenue is credit-normal → decrease (e.g. correcting an overpayment) is a debit.' },
        { accountName: 'Dining Out Expense', accountType: 'expense', change: 'decrease', answer: 'cr', explanation: 'Expense is debit-normal → decrease (a refund) is a credit.' },
        { accountName: 'Loan to a Friend', accountType: 'asset', change: 'decrease', answer: 'cr', explanation: 'When your friend pays you back, this asset goes down → credit.' },
      ],
    },
    {
      id: '02-predict-bank',
      sectionId: '02-debits-credits',
      kind: 'dr-cr-predict',
      title: "In the bank's books",
      role: 'practice',
      difficulty: 2,
      prompt: "These changes happen in **First Example Bank's** books. Which side?",
      hints: [
        'Customer deposits are money the bank **owes**. What type does that make them?',
        'Same rules, different entity: type → up/down → normal side.',
      ],
      explanation:
        'Customer Deposits (liability) ↑ → **Cr**, ↓ → **Dr**. Loans Receivable (asset) ↑ → **Dr**. Reserves at the Fed (asset) ↓ → **Cr**. Fee Income (revenue) ↑ → **Cr**. Interest Expense ↑ → **Dr**.',
      items: [
        { accountName: 'Customer Deposits: Checking', accountType: 'liability', change: 'increase', answer: 'cr', explanation: 'A customer deposits money → the bank owes more → liability up → credit.' },
        { accountName: 'Customer Deposits: Checking', accountType: 'liability', change: 'decrease', answer: 'dr', explanation: 'A customer withdraws → the bank owes less → liability down → debit.' },
        { accountName: 'Loans Receivable', accountType: 'asset', change: 'increase', answer: 'dr', explanation: 'The bank makes a loan → it is owed more → asset up → debit.' },
        { accountName: 'Reserves at the Federal Reserve', accountType: 'asset', change: 'decrease', answer: 'cr', explanation: "Money leaves the bank's Fed account → asset down → credit." },
        { accountName: 'Fee Income', accountType: 'revenue', change: 'increase', answer: 'cr', explanation: 'Revenue up → credit.' },
        { accountName: 'Interest Expense', accountType: 'expense', change: 'increase', answer: 'dr', explanation: 'Interest the bank pays savers is an expense → debit.' },
      ],
    },
    {
      id: '02-bank-statement-credit',
      sectionId: '02-debits-credits',
      kind: 'multiple-choice',
      title: 'The bank statement says "CREDIT"',
      role: 'practice',
      difficulty: 2,
      multi: false,
      prompt:
        'Your $2,000 paycheck lands, and your bank statement shows **"CREDIT $2,000"**. In **your own** books you record **Dr Checking Account 2,000**. Who is right?',
      hints: ['Whose books is the bank statement printed from?', "What type is your balance in the bank's books?"],
      explanation:
        "Both. The statement is the **bank's** view: your balance is the bank's **liability** (Customer Deposits), which increases with a credit. In **your** books it is an **asset**, which increases with a debit. Same event, two sets of books, opposite sides.",
      options: [
        { text: "Both: the statement shows the bank's books, where your balance is a liability (credit-normal); in your books it is an asset (debit-normal).", correct: true, explanation: 'Right — perspective decides the type, and the type decides the side.' },
        { text: 'The bank: money coming in is always a credit.', correct: false, explanation: "\"Credit\" means right side, not \"money in\". Cash coming into *your* asset account is a debit." },
        { text: 'You: the bank statement is using the word loosely.', correct: false, explanation: 'The bank is using it precisely — for **its** books. It owes you more, so its liability is credited.' },
        { text: 'Neither: it should be a credit to Salary Income only.', correct: false, explanation: 'Salary Income *is* credited in your books, but every entry needs a matching debit too — to Checking Account.' },
      ],
    },
    {
      id: '02-reverse-credit-checking',
      sectionId: '02-debits-credits',
      kind: 'multiple-choice',
      title: 'Read it backwards: a credit to Checking',
      role: 'practice',
      difficulty: 2,
      multi: false,
      prompt: 'In **your** books, an entry **credits Checking Account $75**. Which of these could the event be?',
      hints: ['Checking is an asset. What does a credit do to an asset?', 'Then ask which event makes your checking balance go that way.'],
      explanation: 'Checking is an asset (debit-normal), so a credit **decreases** it. Of the options, only paying a $75 utility bill from checking reduces your checking balance.',
      options: [
        { text: 'You paid a $75 utility bill from checking.', correct: true, explanation: 'Checking goes down → credit. (The other side: Dr Utilities Expense 75.)' },
        { text: 'You deposited $75 of cash into checking.', correct: false, explanation: 'That *increases* Checking → it would be a debit.' },
        { text: 'A friend sent you $75 for concert tickets.', correct: false, explanation: 'Money arriving in checking increases it → debit.' },
        { text: 'The bank credited your account with $75 of interest.', correct: false, explanation: "The bank's *credit* is in the bank's books. In yours, checking went up → debit." },
      ],
    },
    {
      id: '02-reverse-which-went-up',
      sectionId: '02-debits-credits',
      kind: 'multiple-choice',
      title: 'Which balances went up?',
      role: 'practice',
      difficulty: 2,
      multi: true,
      prompt: 'In your books, each account below received a **credit** of $100 (and nothing else). Select **every account whose balance went up**.',
      hints: ['A credit increases only credit-normal accounts.', 'L, E, R are the credit-normal types.'],
      explanation:
        "A credit increases credit-normal accounts (liabilities, equity, revenue) and decreases debit-normal ones (assets, expenses). So Credit Card Payable, Net Worth and Salary Income went **up**; Savings and Groceries Expense went **down**.",
      options: [
        { text: 'Credit Card Payable', correct: true, explanation: 'Liability → credit-normal → up.' },
        { text: 'Savings Account', correct: false, explanation: 'Asset → debit-normal → a credit makes it go down.' },
        { text: 'Net Worth', correct: true, explanation: 'Equity → credit-normal → up.' },
        { text: 'Salary Income', correct: true, explanation: 'Revenue → credit-normal → up.' },
        { text: 'Groceries Expense', correct: false, explanation: 'Expense → debit-normal → a credit makes it go down (e.g. a refund).' },
      ],
    },
    {
      id: '02-signed-amounts',
      sectionId: '02-debits-credits',
      kind: 'multiple-choice',
      title: 'A negative balance in the database',
      role: 'practice',
      difficulty: 3,
      multi: false,
      prompt:
        "First Example Bank's ledger stores postings as signed amounts: **debit = positive, credit = negative**. For one customer's account in **Customer Deposits: Checking**, `SUM(amount)` returns **−1,000.00**. What should the bank's app show the customer?",
      hints: ["What type is Customer Deposits in the bank's books, and what is its normal side?", 'Under this convention, a normal credit balance sums to a negative number.'],
      explanation:
        "Customer Deposits is a **liability** — credit-normal. Under a Dr = +, Cr = − convention, a healthy credit balance sums **negative**. Flip the sign for display: the bank owes the customer **$1,000**, a perfectly normal balance.",
      options: [
        { text: 'A balance of $1,000 — the bank owes the customer $1,000.', correct: true, explanation: 'A credit-normal account with a credit balance; flip the sign for display.' },
        { text: 'An overdraft of $1,000.', correct: false, explanation: 'An overdraft would be a *debit* balance (positive sum) in a liability account — the customer would owe the bank.' },
        { text: 'An error: balances can never be negative.', correct: false, explanation: 'Under a signed convention, every credit-normal account normally sums negative. The sign is a storage convention, not an error.' },
        { text: '$0 — debits and credits cancel out.', correct: false, explanation: 'Debits equal credits **across a whole transaction**, not within one account.' },
      ],
    },
    {
      id: '02-review-classify',
      sectionId: '02-debits-credits',
      kind: 'classify',
      title: 'Review: classify mixed accounts',
      role: 'review',
      difficulty: 1,
      prompt: 'Review from §1. Classify each account (whose books it is in is shown in brackets).',
      hints: ['Own → asset, owe → liability, owner\'s leftover → equity.', "For the bank, a customer's deposit is something it owes."],
      explanation: 'Car and Loans Receivable are owned/owed-to → **Assets**. Customer Deposits: Savings and Credit Card Payable are owed → **Liabilities**. Retained Earnings → **Equity**. Fee Income → **Revenue**. Transportation Expense → **Expense**.',
      buckets: ['asset', 'liability', 'equity', 'revenue', 'expense'],
      items: [
        { label: 'Car [you]', entityId: 'you', answer: 'asset', explanation: 'You own it.' },
        { label: 'Loans Receivable [bank]', entityId: 'bank', answer: 'asset', explanation: 'Borrowers owe the bank.' },
        { label: 'Customer Deposits: Savings [bank]', entityId: 'bank', answer: 'liability', explanation: 'The bank owes savers.' },
        { label: 'Credit Card Payable [you]', entityId: 'you', answer: 'liability', explanation: 'You owe the card issuer.' },
        { label: 'Retained Earnings [bank]', entityId: 'bank', answer: 'equity', explanation: "Accumulated profits — owners' equity." },
        { label: 'Fee Income [bank]', entityId: 'bank', answer: 'revenue', explanation: 'Fees charged to customers.' },
        { label: 'Transportation Expense [you]', entityId: 'you', answer: 'expense', explanation: 'Gas and fares are spent.' },
      ],
    },
    {
      id: '02-review-equation',
      sectionId: '02-debits-credits',
      kind: 'equation-fill',
      title: 'Review: missing numbers',
      role: 'review',
      difficulty: 1,
      prompt: 'Review from §1. Fill the blank (whole dollars) so that A = L + E.',
      hints: ['Rearrange A = L + E for the blank.'],
      explanation: 'Line 1: E = 2,500 − 500 = **2,000**. Line 2: A = 16,000 + 4,000 = **20,000**. Line 3: L = 1,000 − (−300) = **1,300**.',
      items: [
        { assets: 2500, liabilities: 500, equity: null, explanation: '2,500 − 500 = 2,000.' },
        { assets: null, liabilities: 16000, equity: 4000, explanation: '16,000 + 4,000 = 20,000.' },
        { assets: 1000, liabilities: null, equity: -300, explanation: 'L = A − E = 1,000 − (−300) = 1,300.' },
      ],
    },
  ],
};
export default mod;
