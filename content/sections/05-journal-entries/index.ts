import type { SectionModule, TrapAccount } from '@contracts';

/** Owned by C1. Journal entries — the same information as T-accounts, in the form ledgers store. */

const usd = (dollars: number) => dollars * 100;

const creditCardExpenseTrap: TrapAccount = {
  id: 'credit-card-expense',
  name: 'Credit Card Expense',
  type: 'expense',
  trap: {
    kind: 'near-synonym',
    explanation: "The card is *how* you paid, not *what* you bought. Purchases are expensed by category (Groceries, Dining Out…); the card itself is a liability, **Credit Card Payable**.",
  },
};

const mod: SectionModule = {
  section: {
    id: '05-journal-entries',
    number: 5,
    title: 'Journal Entries',
    summary: 'The compact, line-by-line form of a transaction — what ledgers actually store.',
    primer: `
T-accounts are great for seeing balances. A **journal entry** is the same transaction written as lines — the form accountants write and ledgers store:

\`\`\`
2026-11-02  Deposit cash
  Dr  Checking Account     100
      Cr  Cash                  100
\`\`\`

Conventions:

- **Debits first, credits after** (credits are indented). Each line is one **posting**: account, side, amount.
- An entry can have **any number of lines** — a **compound entry** — as long as Σ Dr = Σ Cr.
- Each entry has a date and a description; one business event = one entry.
- Inline shorthand: \`Dr Checking 100 / Cr Cash 100\`.

**Converting between forms:**

- *T-accounts → journal:* for one transaction, read across the row: every amount in a Dr column becomes a Dr line, every amount in a Cr column a Cr line.
- *Journal → T-accounts:* each line drops into its account's T on the stated side.

Toggle the **journal view** in the builder to see your T-account entry as journal lines (and back). It's the same data.
`.trim(),
    lens: `
**Ledger-engineer's lens.** A journal entry maps directly to your schema: one \`transactions\` row (id, effective date, description, **idempotency key**) and N \`postings\` rows (transaction_id, account_id, side/sign, amount in minor units). Book each business event as **one atomic transaction** — splitting a compound event into two entries leaves a window where the books show half an event, and retries can double-post one half. Entries are **immutable**: fix mistakes with a reversing entry plus a correct one, never an UPDATE.
`.trim(),
    problemIds: [
      '05-gas-journal',
      '05-split-paycheck',
      '05-t-to-journal',
      '05-journal-to-t',
      '05-buy-car',
      '05-lend-to-friend',
      '05-friend-repays',
      '05-pick-the-journal',
      '05-one-event-one-entry',
      '05-review-teller-withdrawal',
      '05-review-rewrite-interest',
    ],
  },
  problems: [
    {
      id: '05-gas-journal',
      sectionId: '05-journal-entries',
      kind: 'booking',
      title: 'Fill up the car (worked)',
      role: 'worked',
      difficulty: 1,
      entityId: 'you',
      prompt: 'You buy **$50 of gas** with your **debit card** (it comes straight out of checking). Book it in **your** books, then switch to the **journal view**.',
      walkthrough: [
        "**Start from the account you know:** Checking went **down** $50 → asset decrease → **Cr Checking Account 50**.",
        'The other side: the gas is used up → **Transportation Expense** goes **up** → expense increase → **Dr Transportation Expense 50**.',
        'Written as a journal entry, debits first:\n\n```\nDr  Transportation Expense   50\n    Cr  Checking Account          50\n```',
        'In the builder, toggle **journal view**: the same row shows as these two lines. Nothing about the data changed — only the presentation.',
      ],
      hints: ['Which account are you sure about?', 'What did you get for $50 — something you still own?'],
      explanation:
        '**Dr Transportation Expense 50 / Cr Checking Account 50.** A debit card spends money already in checking, so Checking is credited immediately (unlike a credit card, which creates a liability).',
      diagnosticExplanations: {
        WRONG_SIDE: 'Expense up → debit; asset (Checking) down → credit.',
        EXTRA_ACCOUNT: "A **debit** card takes money straight from checking — there's no card balance to pay later, so Credit Card Payable doesn't belong here.",
      },
      showBalanceSheets: false,
      journalView: true,
      trapAccounts: [
        creditCardExpenseTrap,
        {
          id: 'debit-card-payable',
          name: 'Debit Card Payable',
          type: 'liability',
          trap: {
            kind: 'other',
            explanation: "A debit card doesn't create a debt — it spends money you already have in checking. So the credit goes to **Checking Account**.",
          },
        },
      ],
      solution: [
        {
          id: 't1',
          label: 'Gas',
          postings: [
            { accountId: 'transportation-expense', side: 'dr', amount: usd(50) },
            { accountId: 'checking', side: 'cr', amount: usd(50) },
          ],
        },
      ],
    },
    {
      id: '05-split-paycheck',
      sectionId: '05-journal-entries',
      kind: 'booking',
      title: 'Split paycheck — a compound entry (partly filled)',
      role: 'faded',
      difficulty: 2,
      entityId: 'you',
      prompt:
        'Your **$2,000 salary** arrives by direct deposit, split automatically: **$1,500 to checking** and **$500 to savings**. Two lines of the journal entry are filled in. **Add the missing line** — it all stays in one entry.',
      hints: [
        'Σ Dr must equal Σ Cr. Right now the debits total $1,500 and the credits $2,000. What is missing?',
        'Where did the other $500 go, and what happens to that account?',
      ],
      explanation:
        '```\nDr  Checking Account   1,500\nDr  Savings Account      500\n    Cr  Salary Income       2,000\n```\nOne event (one paycheck) → **one compound entry** with three lines. Booking it as two separate entries would balance too, but would split one event in two.',
      diagnosticExplanations: {
        WRONG_SIDE: 'Savings is an asset going up → debit.',
        SPLIT_ENTRY:
          'Your postings balance, but you split one paycheck into two transactions. One business event = one transaction: use a single compound entry with three lines.',
        WRONG_AMOUNT: 'The two debits must add up to the $2,000 credit: 1,500 + 500.',
      },
      showBalanceSheets: false,
      journalView: true,
      trapAccounts: [
        {
          id: 'savings-expense',
          name: 'Savings Expense',
          type: 'expense',
          trap: {
            kind: 'other',
            explanation: "Money in savings is still yours — saving isn't spending. It's an asset, **Savings Account**.",
          },
        },
        {
          id: 'salary-expense',
          name: 'Salary Expense',
          type: 'expense',
          trap: {
            kind: 'counterparty',
            explanation: "Salary Expense is in your **employer's** books.",
          },
        },
      ],
      prefill: {
        locked: true,
        rows: [
          {
            id: 't1',
            label: 'Paycheck',
            postings: [
              { accountId: 'checking', side: 'dr', amount: usd(1500) },
              { accountId: 'salary-income', side: 'cr', amount: usd(2000) },
            ],
          },
        ],
      },
      solution: [
        {
          id: 't1',
          label: 'Paycheck',
          postings: [
            { accountId: 'checking', side: 'dr', amount: usd(1500) },
            { accountId: 'savings', side: 'dr', amount: usd(500) },
            { accountId: 'salary-income', side: 'cr', amount: usd(2000) },
          ],
        },
      ],
    },
    {
      id: '05-t-to-journal',
      sectionId: '05-journal-entries',
      kind: 'booking',
      title: 'Convert: T-accounts → journal',
      role: 'practice',
      difficulty: 2,
      entityId: 'you',
      prompt: `
Here are three of your T-accounts with two transactions posted (numbers in brackets are the transaction).

\`\`\`
   Groceries Expense        Credit Card Payable        Checking Account
   Dr    |  Cr              Dr    |  Cr                Dr    |  Cr
 (1) 120 |               (2) 120  | (1) 120                  | (2) 120
\`\`\`

**Enter the same two transactions** (two rows) and check them in the **journal view**. What happened in each?
`.trim(),
      hints: [
        'Read each transaction number across the accounts: which postings belong to (1), which to (2)?',
        'Transaction (1) has a debit to Groceries Expense and a credit to Credit Card Payable. What event is that?',
        'Transaction (2) touches Credit Card Payable and Checking. Which way is the card balance moving?',
      ],
      explanation:
        '```\n(1) Dr  Groceries Expense      120\n        Cr  Credit Card Payable     120   ← groceries bought on the card\n(2) Dr  Credit Card Payable    120\n        Cr  Checking Account        120   ← card bill paid from checking\n```\nThe expense is recorded once, when the groceries were bought. Paying the card only settles the debt.',
      diagnosticExplanations: {
        WRONG_ROW: 'Keep each transaction in its own row: row 1 = the purchase, row 2 = the card payment.',
        WRONG_SIDE: "Copy each amount to the same side it's on in the T-account: left = debit, right = credit.",
        SPLIT_ENTRY: 'There are exactly two events here; each should be one row.',
      },
      showBalanceSheets: false,
      journalView: true,
      trapAccounts: [
        creditCardExpenseTrap,
        {
          id: 'credit-card-receivable',
          name: 'Credit Card Receivable',
          type: 'asset',
          trap: {
            kind: 'counterparty',
            explanation: "That's the card issuer's asset. In your books the debt is **Credit Card Payable**.",
          },
        },
      ],
      solution: [
        {
          id: 't1',
          label: 'Groceries on card',
          postings: [
            { accountId: 'groceries-expense', side: 'dr', amount: usd(120) },
            { accountId: 'credit-card-payable', side: 'cr', amount: usd(120) },
          ],
        },
        {
          id: 't2',
          label: 'Pay card bill',
          postings: [
            { accountId: 'credit-card-payable', side: 'dr', amount: usd(120) },
            { accountId: 'checking', side: 'cr', amount: usd(120) },
          ],
        },
      ],
    },
    {
      id: '05-journal-to-t',
      sectionId: '05-journal-entries',
      kind: 'booking',
      title: 'Convert: journal → T-accounts',
      role: 'practice',
      difficulty: 2,
      entityId: 'you',
      prompt: `
Your journal shows these two entries:

\`\`\`
11-05  Birthday money from Grandma
  Dr  Checking Account      300
      Cr  Gifts Received         300

11-06  Cash for the farmers market
  Dr  Cash                  100
      Cr  Checking Account       100
\`\`\`

**Post both entries in the T-account builder** (two rows). Then: what is the net change in Checking?
`.trim(),
      hints: [
        'Each journal line is one posting: the account, the side (Dr or Cr), the amount.',
        'Pick the right **type** for each account first. What type is Gifts Received?',
        'Checking gets a debit in one row and a credit in the other. Net: 300 − 100.',
      ],
      explanation:
        'Row 1: **Dr Checking 300 / Cr Gifts Received 300** — a gift is income for a person (revenue, credit-normal). Row 2: **Dr Cash 100 / Cr Checking 100** — an asset swap. Net change in Checking: **+200**. Net worth went up by 300 (the gift); the cash withdrawal didn\'t change it.',
      diagnosticExplanations: {
        WRONG_TYPE: "Gifts Received is **revenue** in your books: it increases your net worth and you don't owe it back.",
        WRONG_SIDE: 'Copy the side from the journal line: Dr lines go on the left of the T, Cr lines on the right.',
        WRONG_ROW: 'Each journal entry is one row. Keep the gift in row 1 and the cash withdrawal in row 2.',
      },
      showBalanceSheets: false,
      journalView: true,
      trapAccounts: [
        {
          id: 'gift-payable',
          name: 'Gift Payable',
          type: 'liability',
          trap: {
            kind: 'other',
            explanation: "A gift doesn't have to be paid back, so there's no liability. It's income: **Gifts Received**.",
          },
        },
        {
          id: 'gift-expense',
          name: 'Gifts Given Expense',
          type: 'expense',
          trap: {
            kind: 'counterparty',
            explanation: "That's how **Grandma** might record the gift in her books. You received it.",
          },
        },
      ],
      solution: [
        {
          id: 't1',
          label: 'Birthday money',
          postings: [
            { accountId: 'checking', side: 'dr', amount: usd(300) },
            { accountId: 'gift-income', side: 'cr', amount: usd(300) },
          ],
        },
        {
          id: 't2',
          label: 'Cash withdrawal',
          postings: [
            { accountId: 'cash', side: 'dr', amount: usd(100) },
            { accountId: 'checking', side: 'cr', amount: usd(100) },
          ],
        },
      ],
    },
    {
      id: '05-buy-car',
      sectionId: '05-journal-entries',
      kind: 'booking',
      title: 'Buy a car: down payment + loan',
      role: 'practice',
      difficulty: 3,
      entityId: 'you',
      prompt:
        'You buy a **$20,000 car**. You pay **$4,000 down from checking** and finance the other **$16,000 with a car loan** (the lender pays the dealer directly). Book it in **your** books as **one** journal entry.',
      hints: [
        'What do you now own that you didn\'t before? What is it worth?',
        'Two things paid for it. One came out of an account you own; the other is money you now owe.',
        'This is a compound entry: one debit, two credits. Do the credits add up to the debit?',
      ],
      explanation:
        '```\nDr  Car                    20,000\n    Cr  Checking Account        4,000\n    Cr  Car Loan Payable       16,000\n```\nYou own a new asset (Car ↑ → debit), gave up $4,000 of another asset (Checking ↓ → credit), and took on $16,000 of debt (liability ↑ → credit). Assets 8,000 → 24,000; liabilities 0 → 16,000; **net worth unchanged at 8,000**. Buying a car isn\'t an expense the day you buy it — you still own it. (Wear and tear — depreciation — is covered for businesses in §9.)',
      diagnosticExplanations: {
        WRONG_SIDE: 'Car (asset) ↑ → debit. Checking (asset) ↓ → credit. Car Loan Payable (liability) ↑ → credit.',
        SPLIT_ENTRY:
          'One purchase = one transaction. Splitting the car into a $4,000 entry and a $16,000 entry balances, but books one event as two — use a single compound entry.',
        WRONG_AMOUNT: 'The car is recorded at its full $20,000 price, however it was paid for. The credits split it: 4,000 + 16,000.',
        MISSING_ACCOUNT: "The $16,000 you borrowed has to be recorded as what you owe: **Car Loan Payable**.",
      },
      showBalanceSheets: true,
      journalView: true,
      opening: {
        lines: [
          { accountId: 'checking', amount: usd(6000) },
          { accountId: 'savings', amount: usd(2000) },
          { accountId: 'net-worth', amount: usd(8000) },
        ],
      },
      trapAccounts: [
        {
          id: 'car-expense',
          name: 'Car Expense',
          type: 'expense',
          trap: {
            kind: 'near-synonym',
            explanation: "You still own the car the day after you buy it — it's an **asset**, not an expense. (Gas and repairs are expenses; the car itself isn't.)",
          },
        },
        {
          id: 'car-loan-receivable',
          name: 'Car Loan Receivable',
          type: 'asset',
          trap: {
            kind: 'counterparty',
            explanation: "That's the **lender's** asset — they're owed the money. You owe it: **Car Loan Payable**.",
          },
        },
      ],
      solution: [
        {
          id: 't1',
          label: 'Buy car',
          postings: [
            { accountId: 'car', side: 'dr', amount: usd(20000) },
            { accountId: 'checking', side: 'cr', amount: usd(4000) },
            { accountId: 'car-loan-payable', side: 'cr', amount: usd(16000) },
          ],
        },
      ],
    },
    {
      id: '05-lend-to-friend',
      sectionId: '05-journal-entries',
      kind: 'booking',
      title: 'Lend a friend $100',
      role: 'practice',
      difficulty: 2,
      entityId: 'you',
      prompt: 'A friend is short on rent. You hand them **$100 in cash**, and they promise to pay you back next week. Book it in **your** books.',
      hints: [
        'Start from the account you\'re sure about: your wallet.',
        "Is the $100 gone for good? You expect it back. What kind of account represents money someone owes you?",
      ],
      explanation:
        '```\nDr  Loan to a Friend   100\n    Cr  Cash                100\n```\nCash ↓ → credit. Your friend now **owes you** $100 — a claim to future money is an **asset** (a receivable) → debit. Net worth is unchanged; you swapped cash for an IOU.',
      diagnosticExplanations: {
        WRONG_SIDE: 'Loan to a Friend is an asset going up → debit. Cash going down → credit.',
        EXTRA_ACCOUNT:
          "Only Cash and one other account change. (If you used **Loan Payable**: that's money *you* owe. Here your friend owes *you* — the asset **Loan to a Friend**.)",
        MISSING_ACCOUNT: 'Your friend owes you $100; record that claim as an asset: **Loan to a Friend**.',
      },
      showBalanceSheets: false,
      journalView: true,
      trapAccounts: [
        {
          id: 'gift-expense',
          name: 'Gifts Given Expense',
          type: 'expense',
          trap: {
            kind: 'near-synonym',
            explanation: "It's a loan, not a gift: you expect the $100 back, so your net worth didn't drop. Record the IOU as an asset, **Loan to a Friend**.",
          },
        },
        {
          id: 'friend-loan-payable',
          name: 'Loan from a Friend',
          type: 'liability',
          trap: {
            kind: 'counterparty',
            explanation: "That's how **your friend** would record it — they owe you. In your books it's an asset, **Loan to a Friend**.",
          },
        },
      ],
      solution: [
        {
          id: 't1',
          label: 'Lend to friend',
          postings: [
            { accountId: 'loan-to-friend', side: 'dr', amount: usd(100) },
            { accountId: 'cash', side: 'cr', amount: usd(100) },
          ],
        },
      ],
    },
    {
      id: '05-friend-repays',
      sectionId: '05-journal-entries',
      kind: 'booking',
      title: 'Your friend pays you back',
      role: 'practice',
      difficulty: 2,
      entityId: 'you',
      prompt: 'A week later your friend repays the **$100** with a payment app, straight into your **checking account**. Book it in **your** books.',
      hints: [
        'Checking went up. What side?',
        "Is this income? Were you richer or poorer before the repayment?",
        'Which asset goes away now that the debt is settled?',
      ],
      explanation:
        "```\nDr  Checking Account    100\n    Cr  Loan to a Friend      100\n```\nChecking ↑ → debit. The IOU is settled → Loan to a Friend ↓ → credit. It's an asset swap — **not** income. You were already owed the $100; now you hold it in checking instead.",
      diagnosticExplanations: {
        WRONG_SIDE: 'Checking (asset) ↑ → debit. Loan to a Friend (asset) ↓ → credit.',
        EXTRA_ACCOUNT:
          "Only Checking and Loan to a Friend change. **Gifts Received** (or any income) would mean your net worth went up — but the $100 was already counted as an asset (Loan to a Friend) when you lent it. Repayment just swaps the IOU for cash.",
        MISSING_ACCOUNT: 'The IOU you recorded when you lent the money must be cleared: credit **Loan to a Friend**.',
      },
      showBalanceSheets: false,
      journalView: true,
      trapAccounts: [
        {
          id: 'loan-repayment-income',
          name: 'Loan Repayment Income',
          type: 'revenue',
          trap: {
            kind: 'other',
            explanation: "Getting your own money back isn't income. The $100 was already yours (as Loan to a Friend). Only interest on a loan would be income.",
          },
        },
        {
          id: 'friend-loan-payable',
          name: 'Loan from a Friend',
          type: 'liability',
          trap: {
            kind: 'counterparty',
            explanation: "That's your **friend's** account — they owed you. In your books, the claim is the asset **Loan to a Friend**.",
          },
        },
      ],
      solution: [
        {
          id: 't1',
          label: 'Friend repays',
          postings: [
            { accountId: 'checking', side: 'dr', amount: usd(100) },
            { accountId: 'loan-to-friend', side: 'cr', amount: usd(100) },
          ],
        },
      ],
    },
    {
      id: '05-pick-the-journal',
      sectionId: '05-journal-entries',
      kind: 'multiple-choice',
      title: 'Pick the journal entry: a refund',
      role: 'practice',
      difficulty: 3,
      multi: false,
      prompt:
        'Last week you bought a **$60 dinner on your credit card** (booked as Dr Dining Out Expense 60 / Cr Credit Card Payable 60). The restaurant overcharged you and **refunds the full $60 to your card**. Which journal entry records the refund in **your** books?',
      hints: ['After the refund, do you owe the card issuer more or less?', 'A refund undoes an expense. Which side decreases an expense?'],
      explanation:
        'You owe the card issuer $60 less (liability ↓ → **debit** Credit Card Payable), and the expense is undone (expense ↓ → **credit** Dining Out Expense). It is the mirror image of the original purchase entry.',
      options: [
        { text: '`Dr Credit Card Payable 60 / Cr Dining Out Expense 60`', correct: true, explanation: 'Liability down (debit), expense down (credit) — exactly reverses the purchase.' },
        { text: '`Dr Dining Out Expense 60 / Cr Credit Card Payable 60`', correct: false, explanation: "That's the original purchase again — it would double the expense." },
        { text: '`Dr Checking Account 60 / Cr Gifts Received 60`', correct: false, explanation: "The refund went to the card, not checking — and it isn't a gift; it cancels an expense." },
        { text: '`Dr Credit Card Payable 60 / Cr Checking Account 60`', correct: false, explanation: "That's paying your card bill from checking. No money left checking here." },
      ],
    },
    {
      id: '05-one-event-one-entry',
      sectionId: '05-journal-entries',
      kind: 'multiple-choice',
      title: 'One event, one entry',
      role: 'practice',
      difficulty: 2,
      multi: false,
      prompt: `
An engineer books your split paycheck ($1,500 to checking, $500 to savings) as **two** transactions:

\`\`\`
T1  Dr Checking 1,500  /  Cr Salary Income 1,500
T2  Dr Savings    500  /  Cr Salary Income   500
\`\`\`

Both balance, and the final balances are correct. What's the best critique?
`.trim(),
      hints: ['How many real-world events happened?', 'What would someone see if they looked at the books between T1 and T2, or if T2 failed?'],
      explanation:
        'One business event should be **one atomic transaction**. Splitting it means there is a moment (or, if T2 fails or is retried, a permanent state) where the books show only part of the paycheck. A single compound entry — Dr Checking 1,500, Dr Savings 500 / Cr Salary Income 2,000 — commits all or nothing.',
      options: [
        { text: 'It splits one event into two transactions; if one fails or is retried, the books show a partial or doubled paycheck. Use one compound entry.', correct: true, explanation: 'Atomicity: one event, one transaction, all postings commit together.' },
        { text: "It's wrong because every transaction must have exactly two lines.", correct: false, explanation: 'Compound entries with three or more lines are normal and correct.' },
        { text: "It's wrong because Salary Income should be debited.", correct: false, explanation: 'Revenue increases with a credit — the sides are right.' },
        { text: "It's fine: balances are what matter, not how entries are grouped.", correct: false, explanation: 'Balances are right at the end, but the grouping carries meaning (one paycheck) and protects against partial failure.' },
      ],
    },
    {
      id: '05-review-teller-withdrawal',
      sectionId: '05-journal-entries',
      kind: 'booking',
      title: "Review: a teller withdrawal in the bank's books",
      role: 'review',
      difficulty: 2,
      entityId: 'bank',
      prompt: "Review from §4. A customer withdraws **$200 in cash** from their **checking account** at the teller window. Book it in **First Example Bank's** books.",
      hints: ["Whose books? The bank's. Bills left the teller drawer — which account?", 'Does the bank owe the customer more or less now?'],
      explanation:
        '```\nDr  Customer Deposits – Checking   200\n    Cr  Cash – Vault                    200\n```\nThe bank owes the customer less (liability ↓ → debit) and has fewer bills (asset ↓ → credit). Both sides of the bank\'s balance sheet shrink by 200.',
      diagnosticExplanations: {
        WRONG_SIDE: 'Customer Deposits is a liability: a decrease is a **debit**. Cash – Vault is an asset: a decrease is a **credit**.',
        EXTRA_ACCOUNT: "The bills came out of the teller drawer (**Cash – Vault**), not the bank's Fed account.",
      },
      showBalanceSheets: false,
      journalView: true,
      trapAccounts: [
        {
          id: 'checking',
          name: 'Checking Account',
          type: 'asset',
          trap: {
            kind: 'counterparty',
            explanation: "That's the **customer's** account in their own books. The bank records what it owes them: **Customer Deposits – Checking**.",
          },
        },
        {
          id: 'withdrawal-expense',
          name: 'Withdrawal Expense',
          type: 'expense',
          trap: {
            kind: 'other',
            explanation: "Paying out a deposit doesn't cost the bank anything — it settles a debt it already owed.",
          },
        },
      ],
      solution: [
        {
          id: 't1',
          label: 'Teller withdrawal',
          postings: [
            { accountId: 'deposits-checking', side: 'dr', amount: usd(200) },
            { accountId: 'vault-cash', side: 'cr', amount: usd(200) },
          ],
        },
      ],
    },
    {
      id: '05-review-rewrite-interest',
      sectionId: '05-journal-entries',
      kind: 'booking',
      title: "Review: rewrite your interest income as the bank's entry",
      role: 'review',
      difficulty: 2,
      entityId: 'bank',
      prompt:
        "Review from §4. The bank paid **$50 of interest** into your savings account; your entry is shown alongside. **Write First Example Bank's entry.** (Assume the bank records the interest on the day it pays it — in §8 you'll see banks actually accrue it daily.)",
      reference: {
        entityId: 'you',
        caption: 'Your books',
        rows: [
          {
            id: 'y1',
            label: 'Interest received',
            postings: [
              { accountId: 'savings', side: 'dr', amount: usd(50) },
              { accountId: 'interest-income', side: 'cr', amount: usd(50) },
            ],
          },
        ],
      },
      hints: [
        'Your Savings went up. What does the bank now owe you?',
        "Your Interest Income is the bank's… what? It costs the bank money.",
      ],
      explanation:
        "```\nDr  Interest Expense                50\n    Cr  Customer Deposits – Savings       50\n```\nYour **Interest Income** is the bank's **Interest Expense**; your **Savings Account** asset is the bank's **Customer Deposits – Savings** liability. No cash leaves the bank — it simply owes you more.",
      diagnosticExplanations: {
        WRONG_SIDE: 'Interest Expense ↑ → debit. Customer Deposits – Savings (liability) ↑ → credit.',
        EXTRA_ACCOUNT:
          "Interest Income is the bank's revenue from *loans*. Here the bank is *paying* interest — its expense. (And Accrued Interest Payable isn't needed because we assume the bank books interest the day it pays it.)",
      },
      showBalanceSheets: false,
      journalView: true,
      trapAccounts: [
        {
          id: 'savings',
          name: 'Savings Account',
          type: 'asset',
          trap: {
            kind: 'counterparty',
            explanation: "That's **your** asset. In the bank's books, your savings balance is the liability **Customer Deposits – Savings**.",
          },
        },
        {
          id: 'cash',
          name: 'Cash',
          type: 'asset',
          trap: {
            kind: 'counterparty',
            explanation: "**Cash** is your wallet, in *your* books. No bills changed hands — the bank simply increased what it owes you on savings.",
          },
        },
      ],
      solution: [
        {
          id: 't1',
          label: 'Interest paid to saver',
          postings: [
            { accountId: 'interest-expense', side: 'dr', amount: usd(50) },
            { accountId: 'deposits-savings', side: 'cr', amount: usd(50) },
          ],
        },
      ],
    },
  ],
};
export default mod;
