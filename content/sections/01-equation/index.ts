import type { SectionModule } from '@contracts';

/** Owned by C1. The accounting equation and the five account types. */

const usd = (dollars: number) => dollars * 100;

const mod: SectionModule = {
  section: {
    id: '01-equation',
    number: 1,
    title: 'The Accounting Equation & Five Account Types',
    summary: 'A = L + E, and the five kinds of accounts every ledger is built from.',
    primer: `
Every set of books — yours, a bank's, a coffee shop's — obeys one equation:

\`\`\`
Assets = Liabilities + Equity
\`\`\`

- **[[Asset]]** — something you *own* or are *owed* that has value: cash, a checking account, a car, a loan you made to a friend.
- **[[Liability]]** — something you *owe* someone else: a credit-card balance, a car loan.
- **[[Equity]]** — what's left for the owner: \`Assets − Liabilities\`. For a person we call it **[[Net Worth]]**; for a company, owners' or shareholders' equity. It can be negative.

Equity changes for two reasons: owners put money in or take it out, or the entity earns and spends. So we track two more types that roll up into equity:

- **[[Revenue]]** (income) — increases equity: salary, [[interest]] earned, sales.
- **Expense** — decreases equity: rent, groceries, interest paid.
- (**[[Dividends / draws]]** — money paid out to owners — also decrease equity. Persons rarely need them.)

The **expanded equation**:

\`\`\`
A = L + Paid-in Capital + Revenue − Expenses − Dividends
\`\`\`

*(This is for an entity's first period. Later periods add the [[Retained Earnings]] carried over: \`A = L + PIC + RE + Rev − Exp − Div\`.)*

**Why are [[expenses]] debit-normal?** Equity sits on the right of the equation and grows with **[[credits]]**. Expenses *shrink* equity, so an increase in an expense is recorded on the opposite side — a **debit**. Same for dividends. (You'll meet [[debits]] and credits properly in §2.)

**Type depends on whose books you're in.** Your checking balance is *your* asset, but the same $1,000 is the bank's **liability** — it owes it to you.
`.trim(),
    lens: `
**Ledger-engineer's lens.** An account is a row in an \`accounts\` table: \`id\`, \`name\`, \`type\` (an enum of the five types, plus contra types later), and a **[[normal side]]** derived from the type. Get the type wrong and every report built on top — [[balance sheet]], [[income statement]], the A = L + E check — is wrong, even if every transaction balances. Each entity (you, the bank) gets its **own** [[chart of accounts]]; never share account rows across entities.
`.trim(),
    problemIds: [
      '01-classify-your-accounts',
      '01-equation-fill-basics',
      '01-classify-more-personal',
      '01-classify-perspective',
      '01-equation-fill-stories',
      '01-expanded-equation',
      '01-cant-be-true',
      '01-why-expense-debit',
      '01-review-checking-to-cash',
      '01-review-credit-normal',
    ],
  },
  problems: [
    {
      id: '01-classify-your-accounts',
      sectionId: '01-equation',
      kind: 'classify',
      title: 'Sort your accounts into the five types',
      role: 'worked',
      difficulty: 1,
      prompt: 'These accounts are all in **your** personal books. Drag each into its type. (Worked example — step through the walkthrough first.)',
      walkthrough: [
        'Ask of each account: **do I own it, owe it, or is it a flow that changes my net worth?**',
        '**Cash** and **Car** — you own them → **Asset**.',
        "**Credit Card Payable** — you owe the card issuer → **Liability**. (\"Payable\" almost always means liability.)",
        '**Net Worth** — what\'s left after subtracting what you owe from what you own → **Equity**.',
        '**Salary Income** — makes you richer over time; it\'s a flow *into* equity → **Revenue**.',
        '**Rent Expense** — makes you poorer; money gone for good → **Expense**.',
      ],
      hints: ['Own it → asset. Owe it → liability.', 'Income and expenses are flows that change net worth.'],
      explanation:
        'Own: Cash, Car (**Assets**). Owe: Credit Card Payable (**Liability**). Leftover: Net Worth (**Equity**). Increases equity: Salary Income (**Revenue**). Decreases equity: Rent Expense (**Expense**).',
      buckets: ['asset', 'liability', 'equity', 'revenue', 'expense'],
      items: [
        { label: 'Cash', entityId: 'you', answer: 'asset', explanation: 'Money in your wallet — you own it.' },
        { label: 'Car', entityId: 'you', answer: 'asset', explanation: 'You own the car; it has value.' },
        { label: 'Credit Card Payable', entityId: 'you', answer: 'liability', explanation: 'What you owe the card issuer.' },
        { label: 'Net Worth', entityId: 'you', answer: 'equity', explanation: "A person's equity: assets minus liabilities." },
        { label: 'Salary Income', entityId: 'you', answer: 'revenue', explanation: 'Pay you earn increases your net worth.' },
        { label: 'Rent Expense', entityId: 'you', answer: 'expense', explanation: 'Rent is spent and gone — it decreases your net worth.' },
      ],
    },
    {
      id: '01-equation-fill-basics',
      sectionId: '01-equation',
      kind: 'equation-fill',
      title: 'Fill the blank in A = L + E',
      role: 'faded',
      difficulty: 1,
      prompt:
        'Each line is one set of books. Fill in the missing number (whole dollars) so that **Assets = Liabilities + Equity**. The first line is solved in the walkthrough — enter its answer, then do the rest yourself.',
      walkthrough: [
        'Line 1: Assets $5,000, Liabilities $1,000, Equity = ?',
        'Rearrange: `Equity = Assets − Liabilities = 5,000 − 1,000 = 4,000`.',
        'Check: `1,000 + 4,000 = 5,000` ✓. Now try lines 2 and 3 — rearrange the same way.',
      ],
      hints: [
        'If the blank is Assets, add the other two.',
        'If the blank is Liabilities or Equity, subtract the known one from Assets.',
      ],
      explanation: 'Line 1: 5,000 − 1,000 = **4,000**. Line 2: 2,000 + 3,000 = **5,000**. Line 3: 12,000 − 9,000 = **3,000**.',
      items: [
        { assets: 5000, liabilities: 1000, equity: null, explanation: 'Equity = 5,000 − 1,000 = 4,000.' },
        { assets: null, liabilities: 2000, equity: 3000, explanation: 'Assets = 2,000 + 3,000 = 5,000.' },
        { assets: 12000, liabilities: null, equity: 9000, explanation: 'Liabilities = 12,000 − 9,000 = 3,000.' },
      ],
    },
    {
      id: '01-classify-more-personal',
      sectionId: '01-equation',
      kind: 'classify',
      title: 'More of your accounts',
      role: 'practice',
      difficulty: 1,
      prompt: 'All of these are in **your** personal books. Classify each one.',
      hints: [
        'A "receivable" or a loan *you made* is money owed **to** you. A "payable" is money **you** owe.',
        'Interest can be income or expense — it depends on whether you are earning it or paying it.',
      ],
      explanation:
        'Savings Account and Loan to a Friend are things you own or are owed (**Assets**). Car Loan Payable and Loan Payable are debts (**Liabilities**). Interest Income and Gifts Received increase your net worth (**Revenue**). Interest Expense and Groceries Expense decrease it (**Expenses**).',
      buckets: ['asset', 'liability', 'equity', 'revenue', 'expense'],
      items: [
        { label: 'Savings Account', entityId: 'you', answer: 'asset', explanation: 'Money the bank holds for you — you own the claim.' },
        { label: 'Loan to a Friend', entityId: 'you', answer: 'asset', explanation: 'Your friend owes you; a claim to future money is an asset.' },
        { label: 'Car Loan Payable', entityId: 'you', answer: 'liability', explanation: 'You owe the lender.' },
        { label: 'Loan Payable', entityId: 'you', answer: 'liability', explanation: 'You owe the bank the principal.' },
        { label: 'Interest Income', entityId: 'you', answer: 'revenue', explanation: 'Interest you *earn* on savings increases net worth.' },
        { label: 'Gifts Received', entityId: 'you', answer: 'revenue', explanation: "A gift increases your net worth and you don't owe it back." },
        { label: 'Interest Expense', entityId: 'you', answer: 'expense', explanation: 'Interest you *pay* on a loan decreases net worth.' },
        { label: 'Groceries Expense', entityId: 'you', answer: 'expense', explanation: 'Food bought and eaten — gone.' },
      ],
    },
    {
      id: '01-classify-perspective',
      sectionId: '01-equation',
      kind: 'classify',
      title: 'Same money, different books',
      role: 'practice',
      difficulty: 2,
      prompt:
        "Each account below belongs to **either you or First Example Bank** — check the label. Classify it **from the point of view of whoever's books it is in**.",
      hints: [
        "In *this* entity's books, is it owned, owed, or a flow?",
        'Every claim has two holders: who is owed, and who owes?',
      ],
      explanation:
        "Every claim between two parties appears twice: as an **asset** for the one who is owed and a **liability** for the one who owes. Your checking balance is your asset and the bank's liability (Customer Deposits). Your loan is your liability and the bank's asset (Loans Receivable). Interest you pay is your expense and the bank's income.",
      buckets: ['asset', 'liability', 'equity', 'revenue', 'expense'],
      items: [
        { label: 'Checking Account (your books)', entityId: 'you', answer: 'asset', explanation: 'You own the claim on the bank.' },
        { label: 'Customer Deposits – Checking (bank)', entityId: 'bank', answer: 'liability', explanation: 'The bank owes depositors this money — it must pay it out on demand.' },
        { label: 'Loan Payable (your books)', entityId: 'you', answer: 'liability', explanation: 'You owe the bank.' },
        { label: 'Loans Receivable (bank)', entityId: 'bank', answer: 'asset', explanation: 'Borrowers owe the bank; that claim is the bank\'s asset.' },
        { label: 'Interest Expense on your loan (your books)', entityId: 'you', answer: 'expense', explanation: 'Interest you pay reduces your net worth.' },
        { label: 'Interest Income (bank)', entityId: 'bank', answer: 'revenue', explanation: 'Interest the bank earns on loans increases its equity.' },
        { label: 'Paid-in Capital (bank)', entityId: 'bank', answer: 'equity', explanation: "Money shareholders invested in the bank — owners' equity." },
        { label: 'Bank Fees Expense (your books)', entityId: 'you', answer: 'expense', explanation: 'A fee you pay is an expense to you…' },
        { label: 'Fee Income (bank)', entityId: 'bank', answer: 'revenue', explanation: '…and revenue for the bank that charges it.' },
      ],
    },
    {
      id: '01-equation-fill-stories',
      sectionId: '01-equation',
      kind: 'equation-fill',
      title: 'Equation stories',
      role: 'practice',
      difficulty: 2,
      prompt: `
Fill in the blank (whole dollars) for each situation:

1. You own $8,000 of stuff (checking, savings, car) and owe $1,500 on your credit card. What is your net worth?
2. Your net worth is $12,000 and your assets total $30,000. How much do you owe?
3. You owe $20,000 on a car loan and your net worth is **−$2,000**. What are your assets worth?
4. A small bank has $900,000 of customer deposits (its only liabilities) and $100,000 of equity. What are its total assets?
`.trim(),
      hints: [
        'Write `A = L + E` and plug in the two numbers you know.',
        'Negative equity is allowed: it just means you owe more than you own.',
      ],
      explanation:
        '1. E = 8,000 − 1,500 = **6,500**. 2. L = 30,000 − 12,000 = **18,000**. 3. A = 20,000 + (−2,000) = **18,000** — you owe more than you own. 4. A = 900,000 + 100,000 = **1,000,000** — a bank is mostly funded by what it owes depositors.',
      items: [
        { assets: 8000, liabilities: 1500, equity: null, explanation: 'Net worth = 8,000 − 1,500 = 6,500.' },
        { assets: 30000, liabilities: null, equity: 12000, explanation: 'Liabilities = 30,000 − 12,000 = 18,000.' },
        { assets: null, liabilities: 20000, equity: -2000, explanation: 'Assets = 20,000 + (−2,000) = 18,000. Negative net worth: debts exceed assets.' },
        { assets: null, liabilities: 900000, equity: 100000, explanation: 'Assets = 900,000 + 100,000 = 1,000,000.' },
      ],
    },
    {
      id: '01-expanded-equation',
      sectionId: '01-equation',
      kind: 'multiple-choice',
      title: 'The expanded equation',
      role: 'practice',
      difficulty: 2,
      multi: false,
      prompt: `
A small company **in its first year of business** (so no retained earnings carried over yet) shows:

| Account group | Amount |
|---|---|
| Liabilities | $6,000 |
| Paid-in Capital | $10,000 |
| Revenue (so far this year) | $4,000 |
| Expenses (so far this year) | $3,000 |
| Dividends paid (this year) | $500 |

Using \`A = L + PIC + Rev − Exp − Div\`, what are total **assets**?
`.trim(),
      hints: ['Which of these increase equity, and which decrease it?', 'Expenses and dividends are *subtracted*.'],
      explanation: 'A = 6,000 + 10,000 + 4,000 − 3,000 − 500 = **$16,500**.',
      options: [
        { text: '$16,500', correct: true, explanation: '6,000 + 10,000 + 4,000 − 3,000 − 500 = 16,500.' },
        { text: '$17,000', correct: false, explanation: 'Close — you forgot to subtract the $500 of dividends.' },
        { text: '$23,500', correct: false, explanation: 'Expenses and dividends *reduce* equity; they must be subtracted, not added.' },
        { text: '$10,500', correct: false, explanation: 'Liabilities are part of the right-hand side too: A = **L** + E.' },
      ],
    },
    {
      id: '01-cant-be-true',
      sectionId: '01-equation',
      kind: 'multiple-choice',
      title: "Which statements can't be true?",
      role: 'practice',
      difficulty: 2,
      multi: true,
      prompt:
        "Each statement describes a single, complete transaction (or a balance sheet) for one entity. Select **every statement that can't be true** if the books are kept correctly.",
      hints: [
        'After every transaction, A = L + E must still hold. If only one side of the equation moved, something is wrong.',
        'Moves *within* one side (asset ↔ asset) are fine; so are equal moves on both sides.',
      ],
      explanation:
        'A transaction must keep `A = L + E`. That allows: equal changes on both sides (borrowing: A↑ L↑; paying an expense: A↓ E↓), or offsetting changes on one side (asset ↔ asset, liability ↑ with equity ↓). It does **not** allow one side to change alone. Negative equity is perfectly possible.',
      options: [
        { text: 'Assets went up $100 and nothing else changed.', correct: true, explanation: "Can't be true: the left side grew and the right side didn't. Something else (a liability or equity) must have gone up $100 too." },
        { text: 'Assets and liabilities both went up $1,000.', correct: false, explanation: 'Can be true — e.g. you borrowed $1,000 into your checking account.' },
        { text: 'Assets went down $50 and equity went down $50.', correct: false, explanation: 'Can be true — e.g. you paid $50 for dinner from checking (an expense).' },
        { text: 'Liabilities went up $200, equity went down $200, assets unchanged.', correct: false, explanation: 'Can be true — e.g. you bought $200 of groceries on your credit card.' },
        { text: 'One asset went up $300 and another asset went down $300.', correct: false, explanation: 'Can be true — e.g. moving money from checking to savings.' },
        { text: 'Balance sheet: Assets $5,000, Liabilities $7,000, Equity $2,000.', correct: true, explanation: "Can't be true: 7,000 + 2,000 = 9,000 ≠ 5,000. With those assets and liabilities, equity must be −$2,000." },
        { text: 'Balance sheet: Assets $5,000, Liabilities $7,000, Equity −$2,000.', correct: false, explanation: 'Can be true: 7,000 + (−2,000) = 5,000. Negative equity just means debts exceed assets.' },
      ],
    },
    {
      id: '01-why-expense-debit',
      sectionId: '01-equation',
      kind: 'multiple-choice',
      title: 'Why are expenses debit-normal?',
      role: 'practice',
      difficulty: 2,
      multi: false,
      prompt: 'Rent Expense increases on the **debit** side, even though it is part of equity. Why?',
      hints: ['Which side does equity itself increase on?', 'Does an expense make equity bigger or smaller?'],
      explanation:
        "Equity is on the right of `A = L + E` and increases with credits. An expense **reduces** equity, so it's recorded on the opposite side: an increase in an expense is a **debit** (which is a decrease to equity). Expense accounts are just a detailed breakdown of the debits to equity.",
      options: [
        { text: 'Because expenses reduce equity, and equity increases on the credit side — so a reduction is a debit.', correct: true, explanation: 'Exactly. Expense accounts collect the debits (decreases) to equity, one category at a time.' },
        { text: 'Because spending money is bad, and debits are bad.', correct: false, explanation: 'Debit and credit just mean **left** and **right**. They carry no judgment.' },
        { text: 'Because expenses are a kind of asset.', correct: false, explanation: 'Expenses are gone — they are not assets. They are a reduction of equity.' },
        { text: "Because the bank's statement shows payments as debits.", correct: false, explanation: "The bank's statement is written from the bank's books, not yours. The reason is the equation, not the statement." },
      ],
    },
    {
      id: '01-review-checking-to-cash',
      sectionId: '01-equation',
      kind: 'booking',
      title: 'Review: ATM withdrawal',
      role: 'review',
      difficulty: 1,
      entityId: 'you',
      prompt: 'Review from §0. You **withdraw $100 in cash from your checking account** at an ATM. Book it in **your** books. (This time you pick from your full chart of accounts.)',
      hints: [
        "Which account are you sure changes? Your wallet now has more cash.",
        'One asset went up and one went down. Which is which, and which side increases an asset?',
      ],
      explanation:
        'Cash (Asset) up → **Dr Cash 100**. Checking (Asset) down → **Cr Checking Account 100**. It\'s an asset swap: total assets and net worth are unchanged. Withdrawing your own money isn\'t income or an expense.',
      diagnosticExplanations: {
        WRONG_SIDE: 'Both are assets: an increase (Cash) is a debit and a decrease (Checking) is a credit.',
        EXTRA_ACCOUNT: "Only two accounts change: Cash and Checking. Withdrawing your own money doesn't earn or cost you anything, so no income or expense account belongs here.",
      },
      showBalanceSheets: false,
      // Starting balances so the entry doesn't take an account below zero.
      opening: { lines: [{ accountId: 'checking', amount: usd(100) }, { accountId: 'net-worth', amount: usd(100) }] },
      trapAccounts: [
        {
          id: 'customer-deposits-checking',
          name: 'Customer Deposits – Checking',
          type: 'liability',
          trap: {
            kind: 'counterparty',
            explanation: "That's the **bank's** account for what it owes you. In your books the same money is your asset, **Checking Account**.",
          },
        },
        {
          id: 'atm-income',
          name: 'ATM Income',
          type: 'revenue',
          trap: {
            kind: 'other',
            explanation: 'Getting cash out of your own account is not income — you were already rich by that amount. Only the *form* of the asset changed.',
          },
        },
      ],
      solution: [
        {
          id: 't1',
          label: 'ATM withdrawal',
          postings: [
            { accountId: 'cash', side: 'dr', amount: usd(100) },
            { accountId: 'checking', side: 'cr', amount: usd(100) },
          ],
        },
      ],
    },
    {
      id: '01-review-credit-normal',
      sectionId: '01-equation',
      kind: 'multiple-choice',
      title: 'Review: DEALER',
      role: 'review',
      difficulty: 1,
      multi: false,
      prompt: 'Review from §0. Which of these account types **increases on the credit side**?',
      hints: ['DEALER: the last three letters are credit-normal.'],
      explanation: '**L**iabilities, **E**quity and **R**evenue are credit-normal. Assets, expenses and dividends are debit-normal.',
      options: [
        { text: 'Asset', correct: false, explanation: 'Assets increase with a debit.' },
        { text: 'Expense', correct: false, explanation: 'Expenses increase with a debit (they reduce equity).' },
        { text: 'Revenue', correct: true, explanation: 'Revenue increases equity, so it increases with a credit.' },
        { text: 'Dividends', correct: false, explanation: 'Dividends increase with a debit (they reduce equity).' },
      ],
    },
  ],
};
export default mod;
