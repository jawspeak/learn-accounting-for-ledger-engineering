import type { SectionModule, TrapAccount } from '@contracts';

/** Owned by C1. Gentle tutorial for the T-account builder and the cheat sheet. */

/** Whole dollars → integer cents. */
const usd = (dollars: number) => dollars * 100;

const customerDepositsTrap: TrapAccount = {
  id: 'customer-deposits',
  name: 'Customer Deposits',
  type: 'liability',
  trap: {
    kind: 'counterparty',
    explanation:
      "**Customer Deposits** lives in the **bank's** books — it's the bank's record of what it owes you. In *your* books, money at the bank is something you own: an asset such as **Checking Account** or **Savings Account**.",
  },
};

const transferExpenseTrap: TrapAccount = {
  id: 'transfer-expense',
  name: 'Transfer Expense',
  type: 'expense',
  trap: {
    kind: 'other',
    explanation:
      "Moving your own money between your own accounts isn't spending — nothing left your hands, so your net worth didn't change. An **expense** is money that's *gone* (rent, groceries). Here one asset went down and another went up by the same amount.",
  },
};

const mod: SectionModule = {
  section: {
    id: '00-start',
    number: 0,
    title: 'Start Here',
    summary: 'How to use this site, the T-account builder, and the cheat sheet.',
    primer: `
This site teaches accounting **by doing**. Every section has a one-screen primer (like this), a **worked example**, a **faded example** (partly filled in for you), a set of **practice problems**, and a few **review** problems from earlier sections. Jump anywhere — nothing is locked and nothing is tracked. Every problem has its own URL, so you can paste a link into Slack and say "why is this wrong?".

### The T-account builder

Most problems ask you to **book** an event — record it as a transaction:

- **Rows are transactions.** One business event = one row.
- **Columns are accounts.** Each account is a "T": a **Dr** (debit, left) side and a **Cr** (credit, right) side.
- To add an account: **pick its type first** (Asset, Liability, Equity, Revenue, Expense, …), *then* its name. The name list isn't filtered by type — that's on purpose, so you have to actually decide.
- Type an amount on the Dr or Cr side of the account.
- Every row shows **Σ Dr = Σ Cr**. A row that doesn't balance can't be right.

### The move to practice

1. Find the account you're **sure** changes.
2. Did it go **up or down**?
3. Use its **normal side** (from the cheat sheet) to get Dr or Cr.
4. The other side must balance — **which account makes sense there?**

### Stuck?

Use **hints** first. Then **Check**: feedback starts as a count ("2 issues, 1 thing right") and you click **Tell me more** to escalate — where the problem is, what kind of mistake it is, and finally the full solution.

### Cheat sheet

The **cheat sheet** (one click from anywhere) shows \`A = L + E\` and which side increases each account type. The mnemonic is **DEALER**: **D**ividends, **E**xpenses, **A**ssets increase on the **debit** side; **L**iabilities, **E**quity, **R**evenue increase on the **credit** side.
`.trim(),
    lens: `
**Ledger-engineer's lens.** The builder is just a view over two tables: a **transaction** (one row) owns a set of **postings** (\`account_id\`, \`side\`, \`amount\`). An account's balance is never stored as truth — it's the sum of its postings. The "Σ Dr = Σ Cr" badge on every row is the invariant your database should enforce on every commit.
`.trim(),
    problemIds: ['00-tour-savings-to-checking', '00-tour-cash-to-savings', '00-tour-savings-to-cash', '00-dealer'],
  },
  problems: [
    {
      id: '00-tour-savings-to-checking',
      sectionId: '00-start',
      kind: 'booking',
      title: 'Your first entry: savings → checking',
      role: 'worked',
      difficulty: 1,
      entityId: 'you',
      prompt:
        'Welcome to the builder! You move **$50 from your savings account to your checking account** using your banking app. Book it in **your** books. (This one is worked for you — step through the walkthrough, then try entering it yourself.)',
      walkthrough: [
        '**Whose books?** Yours. Both accounts are things *you* own, so both are **Assets**.',
        "**Start from the account you're sure about.** Savings went **down** by $50.",
        '**Normal side.** Assets increase on the **debit** (left) side, so a *decrease* goes on the **credit** side: **Cr Savings Account 50**.',
        '**Balance the row.** A $50 credit needs a $50 debit somewhere. Where did the money go? Into checking, which went **up** — an asset increase is a debit: **Dr Checking Account 50**.',
        "**In the builder:** click **+ add account**, choose type **Asset**, then pick **Checking Account**; do the same for **Savings Account**. Type 50 in Checking's Dr column and 50 in Savings' Cr column. The row badge turns ✓ when Σ Dr = Σ Cr.",
      ],
      hints: [
        'Which account are you sure changes, and did it go up or down?',
        'Both accounts are assets. Which side increases an asset?',
      ],
      explanation:
        'Savings (Asset) went down → **Cr Savings Account 50**. Checking (Asset) went up → **Dr Checking Account 50**. One asset swapped for another, so your total assets — and your net worth — are unchanged.',
      diagnosticExplanations: {
        WRONG_SIDE:
          'Assets increase on the **debit** side and decrease on the **credit** side. Checking went up (debit); Savings went down (credit).',
        WRONG_TYPE: 'Both accounts are things you own — money the bank holds for you. That makes them **Assets** in your books.',
      },
      showBalanceSheets: false,
      accountChoiceIds: ['cash', 'checking', 'savings'],
      trapAccounts: [customerDepositsTrap, transferExpenseTrap],
      solution: [
        {
          id: 't1',
          label: 'Move savings to checking',
          postings: [
            { accountId: 'checking', side: 'dr', amount: usd(50) },
            { accountId: 'savings', side: 'cr', amount: usd(50) },
          ],
        },
      ],
    },
    {
      id: '00-tour-cash-to-savings',
      sectionId: '00-start',
      kind: 'booking',
      title: 'Finish the entry: cash → savings',
      role: 'faded',
      difficulty: 1,
      entityId: 'you',
      prompt:
        "You drop **$20 of cash** from your wallet into your **savings account** at the branch. Half of the entry is already filled in (and locked). **Add the missing side** so the row balances.",
      hints: [
        'The locked posting shows Savings going up. What did you give up to make that happen?',
        'Your cash went down. Cash is an asset — which side records a decrease in an asset?',
      ],
      explanation:
        'Savings (Asset) up → **Dr Savings Account 20** (given). Cash (Asset) down → **Cr Cash 20**. Total assets unchanged; you just moved money from your wallet to the bank.',
      diagnosticExplanations: {
        WRONG_SIDE: 'Cash went **down**. Assets decrease on the **credit** side, so Cash is credited.',
        MISSING_ACCOUNT: 'Something has to balance the $20 debit to Savings. Where did those $20 come from?',
      },
      showBalanceSheets: false,
      accountChoiceIds: ['cash', 'checking', 'savings'],
      trapAccounts: [customerDepositsTrap, transferExpenseTrap],
      prefill: {
        locked: true,
        rows: [{ id: 't1', label: 'Deposit cash to savings', postings: [{ accountId: 'savings', side: 'dr', amount: usd(20) }] }],
      },
      solution: [
        {
          id: 't1',
          label: 'Deposit cash to savings',
          postings: [
            { accountId: 'savings', side: 'dr', amount: usd(20) },
            { accountId: 'cash', side: 'cr', amount: usd(20) },
          ],
        },
      ],
    },
    {
      id: '00-tour-savings-to-cash',
      sectionId: '00-start',
      kind: 'booking',
      title: 'Your turn: withdraw cash from savings',
      role: 'practice',
      difficulty: 1,
      entityId: 'you',
      prompt:
        "At the teller window you **withdraw $40 in cash from your savings account**. Book it in **your** books — both sides, on your own. Try **Check** even if you're unsure: the feedback tells you what's right before it tells you what's wrong.",
      hints: [
        'Two of your accounts change. Which one are you most sure about?',
        'Savings went down; Cash went up. Both are assets — assets increase on the debit side.',
      ],
      explanation:
        'Cash (Asset) up → **Dr Cash 40**. Savings (Asset) down → **Cr Savings Account 40**. Another asset swap: your total assets and net worth are unchanged.',
      diagnosticExplanations: {
        WRONG_SIDE: 'Assets go **up** on the debit side and **down** on the credit side. Cash went up; Savings went down.',
        WRONG_AMOUNT: 'Both sides move by exactly the $40 you withdrew.',
      },
      showBalanceSheets: false,
      accountChoiceIds: ['cash', 'checking', 'savings'],
      trapAccounts: [customerDepositsTrap, transferExpenseTrap],
      solution: [
        {
          id: 't1',
          label: 'Withdraw cash from savings',
          postings: [
            { accountId: 'cash', side: 'dr', amount: usd(40) },
            { accountId: 'savings', side: 'cr', amount: usd(40) },
          ],
        },
      ],
    },
    {
      id: '00-dealer',
      sectionId: '00-start',
      kind: 'multiple-choice',
      title: 'DEALER: which types increase with a debit?',
      role: 'practice',
      difficulty: 1,
      multi: true,
      prompt:
        'Open the **cheat sheet** if you like. Select **every** account type whose balance **increases on the debit (left) side**.',
      hints: [
        'The mnemonic is **DEALER**. The first three letters are the debit-normal types.',
        'Assets sit on the left of `A = L + E`; things that *reduce* equity also behave like the left side.',
      ],
      explanation:
        "**D**ividends (owner draws), **E**xpenses and **A**ssets are debit-normal. **L**iabilities, **E**quity and **R**evenue are credit-normal. Expenses and dividends are debit-normal because they *reduce* equity, and equity increases on the credit side — so a reduction to equity is a debit.",
      options: [
        { text: 'Assets', correct: true, explanation: 'Assets are on the left of `A = L + E` and increase with a debit.' },
        { text: 'Liabilities', correct: false, explanation: 'Liabilities are on the right of the equation and increase with a **credit**.' },
        { text: 'Equity', correct: false, explanation: 'Equity is on the right of the equation and increases with a **credit**.' },
        { text: 'Revenue', correct: false, explanation: 'Revenue increases equity, so it increases with a **credit**.' },
        { text: 'Expenses', correct: true, explanation: 'Expenses decrease equity. Since equity grows with credits, things that shrink it grow with **debits**.' },
        { text: 'Dividends / owner draws', correct: true, explanation: 'Money paid out to owners reduces equity, so it increases with a **debit** — same logic as expenses.' },
      ],
    },
  ],
};
export default mod;
