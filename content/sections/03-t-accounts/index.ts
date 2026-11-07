import type { SectionModule, TrapAccount } from '@contracts';

/** Owned by C1. T-accounts & double entry — personal banking, in your books. */

const usd = (dollars: number) => dollars * 100;

const customerDepositsTrap: TrapAccount = {
  id: 'customer-deposits',
  name: 'Customer Deposits',
  type: 'liability',
  trap: {
    kind: 'counterparty',
    explanation:
      "**Customer Deposits** is an account in the **bank's** books — it's what the bank owes you. In *your* books, the money in the bank is your asset: **Checking Account** (or **Savings Account**).",
  },
};

const mod: SectionModule = {
  section: {
    id: '03-t-accounts',
    number: 3,
    title: 'T-Accounts & Double Entry',
    summary: 'Book personal banking transactions with T-accounts and watch the balance sheet move.',
    primer: `
A **T-account** is one account drawn as a big "T": debits on the left, credits on the right. Its **balance** is the difference between the two sides, shown on whichever side is bigger (normally its normal side).

\`\`\`
     Checking Account (A)
   Dr               Cr
  1,000 (opening) |   60  ATM withdrawal
  ----------------+------
    940 balance   |
\`\`\`

**Double entry** means every transaction touches **at least two accounts**, and the debits equal the credits. That's what keeps \`A = L + E\` true after every single transaction.

**The move:**

1. Pick the account you're **sure** about (usually the one where money visibly moved: cash, checking).
2. Up or down? → normal side → **Dr or Cr**.
3. The other side must balance. **What else changed?** Something you got, something you owe, or a change in net worth (income / expense).

**Three shapes you'll see in this section:**

- **Asset swap** (cash → checking): one asset up, another down. Total assets and net worth unchanged.
- **Income** (salary): an asset up, **Salary Income** up → net worth up.
- **Expense** (rent): an asset down (or a liability up, if you used a credit card), an **expense** up → net worth down.

For a person, income and expense accounts are just a breakdown of changes to **Net Worth** — they're how you answer "where did my money go this month?".

The **balance sheets** before and after the transaction must both satisfy \`A = L + E\`.
`.trim(),
    lens: `
**Ledger-engineer's lens.** A transaction is a set of **postings**; \`SUM(debits) = SUM(credits)\` per transaction is an invariant to enforce **in the database at commit** (a deferred constraint or a check inside the posting function), not in the UI. A balance is \`SUM(postings)\` for the account — cache it if you must, but the postings are the source of truth. Store amounts as **integer minor units** (cents) — never floats: \`0.1 + 0.2 !== 0.3\`.
`.trim(),
    problemIds: [
      '03-atm-withdrawal',
      '03-pay-rent',
      '03-cash-to-checking',
      '03-checking-to-savings',
      '03-salary',
      '03-pay-utilities',
      '03-groceries-credit-card',
      '03-pay-credit-card',
      '03-month-balance-sheet',
      '03-review-predict',
      '03-review-equation',
    ],
  },
  problems: [
    {
      id: '03-atm-withdrawal',
      sectionId: '03-t-accounts',
      kind: 'booking',
      title: 'ATM withdrawal (worked)',
      role: 'worked',
      difficulty: 1,
      entityId: 'you',
      prompt: 'You **withdraw $60 in cash from your checking account** at an ATM. Book it in **your** books and watch both balance sheets.',
      walkthrough: [
        "**Whose books?** Yours. Only things you own, owe, or earn/spend can appear.",
        "**Start from the account you're sure about:** Checking went **down** $60.",
        'Checking is an **Asset** (debit-normal). A decrease goes on the other side → **Cr Checking Account 60**.',
        'The row needs a **$60 debit**. What else changed? Your wallet: **Cash** went **up** → asset increase → **Dr Cash 60**.',
        'Check the row: Dr 60 = Cr 60 ✓.',
        'Balance sheets: Cash 40 → 100, Checking 1,000 → 940. Total assets stay **3,040**, Net Worth stays **3,040**. An asset swap never changes net worth.',
      ],
      hints: [
        'Which account are you sure changes, and in which direction?',
        "Checking went down; something else went up by the same amount. What's in your hand now?",
      ],
      explanation:
        "Checking (Asset) ↓ → **Cr Checking Account 60**. Cash (Asset) ↑ → **Dr Cash 60**. Total assets unchanged (3,040 before and after), so Net Worth is unchanged — you just changed the *form* of your money.",
      diagnosticExplanations: {
        WRONG_SIDE: 'Both accounts are assets. Assets increase with a **debit** (Cash) and decrease with a **credit** (Checking).',
        EXTRA_ACCOUNT: "Only Cash and Checking change. Taking your own money out isn't income or an expense.",
      },
      showBalanceSheets: true,
      opening: {
        lines: [
          { accountId: 'cash', amount: usd(40) },
          { accountId: 'checking', amount: usd(1000) },
          { accountId: 'savings', amount: usd(2000) },
          { accountId: 'net-worth', amount: usd(3040) },
        ],
      },
      trapAccounts: [
        customerDepositsTrap,
        {
          id: 'atm-fees-expense',
          name: 'ATM Fees Expense',
          type: 'expense',
          trap: {
            kind: 'other',
            explanation: 'Nothing in the story mentions a fee. The $60 is still yours — it just moved from the bank to your wallet.',
          },
        },
      ],
      perspectivePairId: '04-bank-atm-withdrawal',
      solution: [
        {
          id: 't1',
          label: 'ATM withdrawal',
          postings: [
            { accountId: 'cash', side: 'dr', amount: usd(60) },
            { accountId: 'checking', side: 'cr', amount: usd(60) },
          ],
        },
      ],
    },
    {
      id: '03-pay-rent',
      sectionId: '03-t-accounts',
      kind: 'booking',
      title: 'Pay rent (partly filled)',
      role: 'faded',
      difficulty: 1,
      entityId: 'you',
      prompt:
        'You pay this month\'s **$1,200 rent** to your landlord from your **checking account**. The checking side is filled in for you. **Complete the entry**, then look at what happened to your net worth.',
      hints: [
        'The locked posting credits Checking $1,200. The row needs a $1,200 debit. What did you get for your money?',
        "You got this month's use of the apartment — and it's used up. Did that make you richer or poorer?",
        'Things that make you poorer, and are gone, are expenses. Expenses increase on which side?',
      ],
      explanation:
        "Checking (Asset) ↓ → **Cr Checking Account 1,200** (given). You got nothing you still own — the month's housing is consumed — so the debit goes to an **expense**: **Dr Rent Expense 1,200**. Assets fell by 1,200 and equity fell by 1,200 (Rent Expense reduces Net Worth), so A = L + E still holds: 5,100 → 3,900.",
      diagnosticExplanations: {
        WRONG_SIDE: 'Rent Expense is an **expense** — debit-normal, because expenses reduce equity (which is credit-normal). An increase in rent expense is a **debit**.',
        WRONG_TYPE: "Rent you've already used up is an **Expense**, not an asset. You don't own anything afterwards.",
        EXTRA_ACCOUNT: 'Only two accounts change: Checking (given) and the account that explains where the money went.',
      },
      showBalanceSheets: true,
      opening: {
        lines: [
          { accountId: 'cash', amount: usd(100) },
          { accountId: 'checking', amount: usd(3000) },
          { accountId: 'savings', amount: usd(2000) },
          { accountId: 'net-worth', amount: usd(5100) },
        ],
      },
      trapAccounts: [
        {
          id: 'rent-payable',
          name: 'Rent Payable',
          type: 'liability',
          trap: {
            kind: 'near-synonym',
            explanation: "**Rent Payable** would mean you still *owe* rent. You paid it on the spot, so there's no debt — the cost goes straight to **Rent Expense**.",
          },
        },
        {
          id: 'prepaid-rent',
          name: 'Prepaid Rent',
          type: 'asset',
          trap: {
            kind: 'near-synonym',
            explanation:
              "**Prepaid Rent** is an asset a *business* uses when it pays for future months in advance (§8). You're paying for the current month, and as a person you keep cash-basis books — so it's simply **Rent Expense**.",
          },
        },
        customerDepositsTrap,
      ],
      perspectivePairId: '04-rewrite-rent-same-bank',
      prefill: {
        locked: true,
        rows: [{ id: 't1', label: 'Pay rent', postings: [{ accountId: 'checking', side: 'cr', amount: usd(1200) }] }],
      },
      solution: [
        {
          id: 't1',
          label: 'Pay rent',
          postings: [
            { accountId: 'rent-expense', side: 'dr', amount: usd(1200) },
            { accountId: 'checking', side: 'cr', amount: usd(1200) },
          ],
        },
      ],
    },
    {
      id: '03-cash-to-checking',
      sectionId: '03-t-accounts',
      kind: 'booking',
      title: 'Deposit cash into checking',
      role: 'practice',
      difficulty: 1,
      entityId: 'you',
      prompt:
        'You have **$100 in cash**. You walk into your bank and deposit all of it into your **checking account**. Book this in **your** books.',
      hints: [
        'Whose books are we in? Yours — so only accounts *you* own (or owe) can appear.',
        'Which account are you sure changes? Your cash goes down. Cash is an Asset — what side decreases an Asset?',
        'Debits must equal credits. If Cash is credited $100, something must be debited $100. What did you get in exchange for the cash?',
      ],
      explanation:
        'Cash (Asset) decreases → **Cr Cash 100**. Checking (Asset) increases → **Dr Checking Account 100**. Both accounts are Assets, so total assets are unchanged — you just moved value from one asset to another. Your net worth did not change.',
      diagnosticExplanations: {
        WRONG_SIDE: 'Both accounts are assets (debit-normal). Checking went **up** → debit; Cash went **down** → credit.',
        EXTRA_ACCOUNT: "Depositing your own cash isn't income — your net worth is the same before and after. Only Cash and Checking change.",
      },
      showBalanceSheets: true,
      opening: {
        lines: [
          { accountId: 'cash', amount: usd(100) },
          { accountId: 'net-worth', amount: usd(100) },
        ],
      },
      trapAccounts: [
        customerDepositsTrap,
        {
          id: 'deposit-income',
          name: 'Deposit Income',
          type: 'revenue',
          trap: {
            kind: 'other',
            explanation: "A deposit isn't income: you already owned the $100. Income makes you richer; this just moved money from your wallet to the bank.",
          },
        },
      ],
      perspectivePairId: '04-bank-cash-deposit',
      solution: [
        {
          id: 't1',
          label: 'Deposit cash',
          postings: [
            { accountId: 'checking', side: 'dr', amount: usd(100) },
            { accountId: 'cash', side: 'cr', amount: usd(100) },
          ],
        },
      ],
    },
    {
      id: '03-checking-to-savings',
      sectionId: '03-t-accounts',
      kind: 'booking',
      title: 'Transfer checking → savings',
      role: 'practice',
      difficulty: 1,
      entityId: 'you',
      prompt: 'Using your banking app, you **transfer $500 from checking to savings**. Book it in **your** books.',
      hints: [
        'Which account are you sure about? Pick one and decide whether it went up or down.',
        'Both accounts are things you own. Which side increases an asset, and which side decreases it?',
        'Did your net worth change? If not, no income or expense account belongs in the entry.',
      ],
      explanation:
        'Savings (Asset) ↑ → **Dr Savings Account 500**. Checking (Asset) ↓ → **Cr Checking Account 500**. Asset swap: total assets stay 2,550 and Net Worth is unchanged. Saving money is not an expense — you still have it.',
      diagnosticExplanations: {
        WRONG_SIDE: 'Savings went **up** (debit) and Checking went **down** (credit) — both are debit-normal assets.',
        EXTRA_ACCOUNT: 'Only Checking and Savings change. Moving money between your own accounts never touches income, expenses or Net Worth.',
      },
      showBalanceSheets: true,
      opening: {
        lines: [
          { accountId: 'cash', amount: usd(50) },
          { accountId: 'checking', amount: usd(1500) },
          { accountId: 'savings', amount: usd(1000) },
          { accountId: 'net-worth', amount: usd(2550) },
        ],
      },
      trapAccounts: [
        {
          id: 'customer-deposits-savings',
          name: 'Customer Deposits – Savings',
          type: 'liability',
          trap: {
            kind: 'counterparty',
            explanation: "That's how the **bank** records what it owes savers. In your books, your savings balance is an asset: **Savings Account**.",
          },
        },
        {
          id: 'savings-expense',
          name: 'Savings Expense',
          type: 'expense',
          trap: {
            kind: 'other',
            explanation: "Saving isn't spending. An expense means the money is gone; here it's still yours, just in a different account.",
          },
        },
      ],
      perspectivePairId: '04-bank-checking-to-savings',
      solution: [
        {
          id: 't1',
          label: 'Transfer to savings',
          postings: [
            { accountId: 'savings', side: 'dr', amount: usd(500) },
            { accountId: 'checking', side: 'cr', amount: usd(500) },
          ],
        },
      ],
    },
    {
      id: '03-salary',
      sectionId: '03-t-accounts',
      kind: 'booking',
      title: 'Payday',
      role: 'practice',
      difficulty: 2,
      entityId: 'you',
      prompt:
        'Your employer, Maple Street Robotics, pays your **$2,000 salary** by direct deposit into your **checking account**. Book it in **your** books. (Ignore taxes — assume $2,000 is what lands.)',
      hints: [
        "Which account are you sure about? Checking went up. What side is that?",
        "The $2,000 debit needs a $2,000 credit. You didn't give anything up and you don't owe anything back — so what kind of account explains it?",
        'You got richer. Increases in net worth from earning come through a **Revenue** (income) account, which is credit-normal.',
      ],
      explanation:
        "Checking (Asset) ↑ → **Dr Checking Account 2,000**. You didn't give up another asset and you don't owe it back, so your net worth rose: **Cr Salary Income 2,000**. Revenue is part of equity — after the entry, assets are 3,300 and liabilities + equity are 200 + 1,100 + 2,000 = 3,300. We credit Salary Income rather than Net Worth directly so you can later see *why* net worth changed.",
      diagnosticExplanations: {
        WRONG_SIDE: 'Salary Income is **revenue** — it increases equity, and equity increases on the **credit** side. Checking (an asset) increases on the debit side.',
        MISSING_ACCOUNT: 'Every increase in net worth from earning should go through an income account (here **Salary Income**) so you can tell where it came from.',
        EXTRA_ACCOUNT:
          "Only Checking and an income account change. If you credited **Net Worth** directly, the equation stays balanced, but you'd lose the information that this was *salary*. Use **Salary Income**; income accounts roll into Net Worth at period end.",
      },
      showBalanceSheets: true,
      opening: {
        lines: [
          { accountId: 'checking', amount: usd(300) },
          { accountId: 'savings', amount: usd(1000) },
          { accountId: 'credit-card-payable', amount: usd(200) },
          { accountId: 'net-worth', amount: usd(1100) },
        ],
      },
      trapAccounts: [
        {
          id: 'salary-expense',
          name: 'Salary Expense',
          type: 'expense',
          trap: {
            kind: 'counterparty',
            explanation: "**Salary Expense** belongs in your **employer's** books — paying you costs them money. For you, the same payment is income: **Salary Income**.",
          },
        },
        {
          id: 'salary-payable',
          name: 'Salary Payable',
          type: 'liability',
          trap: {
            kind: 'counterparty',
            explanation: "**Salary Payable** is what an **employer** owes its staff before payday. You don't owe anyone anything here — you received money you earned.",
          },
        },
        customerDepositsTrap,
      ],
      perspectivePairId: '04-bank-payroll-deposit',
      solution: [
        {
          id: 't1',
          label: 'Salary deposit',
          postings: [
            { accountId: 'checking', side: 'dr', amount: usd(2000) },
            { accountId: 'salary-income', side: 'cr', amount: usd(2000) },
          ],
        },
      ],
    },
    {
      id: '03-pay-utilities',
      sectionId: '03-t-accounts',
      kind: 'booking',
      title: 'Pay the electric bill — and fill in the balance sheet',
      role: 'practice',
      difficulty: 2,
      entityId: 'you',
      prompt:
        "You pay your **$90 electric bill** from your **checking account**. Book it in **your** books, then **fill in the after balance sheet** yourself.",
      hints: [
        'Start from Checking: up or down?',
        "What did you get for $90? Something you still own, or something you've used up?",
        'For the after balance sheet: only the accounts in your entry change. Remember an expense reduces the equity side.',
      ],
      explanation:
        'Checking (Asset) ↓ → **Cr Checking Account 90**. The electricity is used up → **Dr Utilities Expense 90**. After: Checking 2,210; on the right side, Net Worth 2,300 minus Utilities Expense 90 = 2,210 of equity. Assets fell by 90 and equity fell by 90.',
      diagnosticExplanations: {
        WRONG_SIDE: 'Utilities Expense is an expense (debit-normal) and goes **up** → debit. Checking goes **down** → credit.',
        BS_MISMATCH: 'Only Checking and Utilities Expense changed. Checking: 2,300 − 90 = 2,210. Utilities Expense: 90 (shown as a reduction of equity). Net Worth itself stays 2,300 until the period is closed.',
        EQUATION_BROKEN: 'Assets went down by 90, so equity must go down by 90 too: 2,300 Net Worth − 90 Utilities Expense = 2,210 = total assets.',
      },
      showBalanceSheets: true,
      askAfterBalanceSheet: true,
      opening: {
        lines: [
          { accountId: 'checking', amount: usd(2300) },
          { accountId: 'net-worth', amount: usd(2300) },
        ],
      },
      trapAccounts: [
        {
          id: 'utilities-payable',
          name: 'Utilities Payable',
          type: 'liability',
          trap: {
            kind: 'near-synonym',
            explanation: "You paid the bill right away, so you don't owe anything. **Utilities Payable** would be for a bill you haven't paid yet.",
          },
        },
        customerDepositsTrap,
      ],
      perspectivePairId: '04-rewrite-utilities-other-bank',
      solution: [
        {
          id: 't1',
          label: 'Pay electric bill',
          postings: [
            { accountId: 'utilities-expense', side: 'dr', amount: usd(90) },
            { accountId: 'checking', side: 'cr', amount: usd(90) },
          ],
        },
      ],
    },
    {
      id: '03-groceries-credit-card',
      sectionId: '03-t-accounts',
      kind: 'booking',
      title: 'Groceries on the credit card',
      role: 'practice',
      difficulty: 2,
      entityId: 'you',
      prompt: 'You buy **$80 of groceries** and pay with your **credit card**. You have not paid the card bill yet. Book it in **your** books.',
      hints: [
        "Did any money leave your checking account today? If not, Checking doesn't belong in the entry.",
        'What do you have now that you didn\'t before? A debt to the card issuer. What type is that, and which side increases it?',
        'And what is the $80 debit for? The food is bought and (soon) eaten.',
      ],
      explanation:
        'You now **owe** the card issuer $80 → Credit Card Payable (Liability) ↑ → **Cr Credit Card Payable 80**. The groceries are consumed → **Dr Groceries Expense 80**. Assets don\'t change at all; liabilities go up 80 and equity goes down 80. (Cash basis note: for individuals a credit-card charge counts as *paid* when you swipe — you paid with borrowed money — so the expense is recorded now, not when you pay the card bill.)',
      diagnosticExplanations: {
        WRONG_SIDE: 'Credit Card Payable is a **liability** — credit-normal — and it went **up**, so it is credited. Groceries Expense goes up → debit.',
        EXTRA_ACCOUNT: "No money left your checking account today. Checking only changes when you pay the card bill (that's the next problem).",
        MISSING_ACCOUNT: "Paying with a card creates a debt. That debt has to be recorded as a liability: **Credit Card Payable**.",
      },
      showBalanceSheets: true,
      opening: {
        lines: [
          { accountId: 'checking', amount: usd(1000) },
          { accountId: 'credit-card-payable', amount: usd(150) },
          { accountId: 'net-worth', amount: usd(850) },
        ],
      },
      trapAccounts: [
        {
          id: 'credit-card-expense',
          name: 'Credit Card Expense',
          type: 'expense',
          trap: {
            kind: 'near-synonym',
            explanation: 'The card is how you paid, not what you bought. The expense is for **groceries**; the card creates a **liability** (Credit Card Payable).',
          },
        },
        {
          id: 'credit-card-receivable',
          name: 'Credit Card Receivable',
          type: 'asset',
          trap: {
            kind: 'counterparty',
            explanation: "**Credit Card Receivable** is in the **card issuer's** books — you owe *them*. In your books, the same debt is **Credit Card Payable**.",
          },
        },
      ],
      solution: [
        {
          id: 't1',
          label: 'Groceries on card',
          postings: [
            { accountId: 'groceries-expense', side: 'dr', amount: usd(80) },
            { accountId: 'credit-card-payable', side: 'cr', amount: usd(80) },
          ],
        },
      ],
    },
    {
      id: '03-pay-credit-card',
      sectionId: '03-t-accounts',
      kind: 'booking',
      title: 'Pay the credit card bill',
      role: 'practice',
      difficulty: 2,
      entityId: 'you',
      prompt:
        'Your credit card statement arrives showing **$230** owed (groceries and other purchases you already recorded as expenses when you swiped). You pay the **full $230 from checking**. Book the payment in **your** books, then fill in the after balance sheet.',
      hints: [
        'Start from Checking: up or down, and which side?',
        'Is paying the card bill a *new* expense? Those purchases were already booked when you swiped.',
        "What went away when you paid? A debt. Liabilities decrease on which side?",
      ],
      explanation:
        "Checking (Asset) ↓ → **Cr Checking Account 230**. Your debt to the card issuer is gone → Credit Card Payable (Liability) ↓ → **Dr Credit Card Payable 230**. No expense here: the groceries were expensed when you bought them. Booking them again would count them twice. Assets and liabilities both fall by 230; Net Worth is unchanged at 770.",
      diagnosticExplanations: {
        WRONG_SIDE: 'Credit Card Payable is a liability (credit-normal). Paying it **down** is a **debit**. Checking (asset) going down is a credit.',
        EXTRA_ACCOUNT:
          "Don't debit an expense here — the purchases were expensed when you swiped the card. Paying the bill just settles the debt: Dr Credit Card Payable, Cr Checking. Expensing again would double-count.",
        BS_MISMATCH: 'After: Checking 1,000 − 230 = 770; Credit Card Payable 230 − 230 = 0; Net Worth unchanged at 770.',
      },
      showBalanceSheets: true,
      askAfterBalanceSheet: true,
      opening: {
        lines: [
          { accountId: 'checking', amount: usd(1000) },
          { accountId: 'credit-card-payable', amount: usd(230) },
          { accountId: 'net-worth', amount: usd(770) },
        ],
      },
      trapAccounts: [
        {
          id: 'credit-card-expense',
          name: 'Credit Card Expense',
          type: 'expense',
          trap: {
            kind: 'near-synonym',
            explanation: "Paying the card isn't a new cost. The expenses were recorded when you made the purchases; this payment only reduces what you owe.",
          },
        },
        {
          id: 'credit-card-receivable',
          name: 'Credit Card Receivable',
          type: 'asset',
          trap: {
            kind: 'counterparty',
            explanation: "That's the **card issuer's** account for what you owe them. In your books the debt is **Credit Card Payable**.",
          },
        },
      ],
      solution: [
        {
          id: 't1',
          label: 'Pay credit card',
          postings: [
            { accountId: 'credit-card-payable', side: 'dr', amount: usd(230) },
            { accountId: 'checking', side: 'cr', amount: usd(230) },
          ],
        },
      ],
    },
    {
      id: '03-month-balance-sheet',
      sectionId: '03-t-accounts',
      kind: 'statement-fill',
      title: 'Three transactions → the after balance sheet',
      role: 'practice',
      difficulty: 2,
      entityId: 'you',
      statement: 'balance-sheet',
      prompt:
        'You start with **$100 cash** and **$900 in checking** (Net Worth $1,000). The three transactions shown are already booked: (1) deposit $100 of cash into checking, (2) transfer $300 from checking to savings, (3) withdraw $40 from checking at an ATM. **Fill in the balance sheet after all three.**',
      hints: [
        'Track each account like a T-account: start with the opening balance, add its normal-side postings, subtract the others.',
        'All three are asset swaps. What does that tell you about Net Worth?',
      ],
      explanation:
        'Cash: 100 − 100 + 40 = **40**. Checking: 900 + 100 − 300 − 40 = **660**. Savings: 0 + 300 = **300**. Total assets 1,000 = Net Worth **1,000** (unchanged — every transaction was an asset swap).',
      opening: {
        lines: [
          { accountId: 'cash', amount: usd(100) },
          { accountId: 'checking', amount: usd(900) },
          { accountId: 'net-worth', amount: usd(1000) },
        ],
      },
      rows: [
        {
          id: 't1',
          label: 'Deposit cash',
          postings: [
            { accountId: 'checking', side: 'dr', amount: usd(100) },
            { accountId: 'cash', side: 'cr', amount: usd(100) },
          ],
        },
        {
          id: 't2',
          label: 'Transfer to savings',
          postings: [
            { accountId: 'savings', side: 'dr', amount: usd(300) },
            { accountId: 'checking', side: 'cr', amount: usd(300) },
          ],
        },
        {
          id: 't3',
          label: 'ATM withdrawal',
          postings: [
            { accountId: 'cash', side: 'dr', amount: usd(40) },
            { accountId: 'checking', side: 'cr', amount: usd(40) },
          ],
        },
      ],
      answer: {
        balanceSheet: {
          lines: [
            { accountId: 'cash', amount: usd(40) },
            { accountId: 'checking', amount: usd(660) },
            { accountId: 'savings', amount: usd(300) },
            { accountId: 'net-worth', amount: usd(1000) },
          ],
        },
      },
    },
    {
      id: '03-review-predict',
      sectionId: '03-t-accounts',
      kind: 'dr-cr-predict',
      title: 'Review: Dr or Cr?',
      role: 'review',
      difficulty: 1,
      prompt: 'Review from §2. Each change happens in **your** books. Which side?',
      hints: ['Type → up or down → normal side.', 'A decrease goes opposite the normal side.'],
      explanation: 'Loan to a Friend ↑ → **Dr**. Car Loan Payable ↑ → **Cr**. Interest Income ↑ → **Cr**. Cash ↓ → **Cr**. Bank Fees Expense ↑ → **Dr**.',
      items: [
        { accountName: 'Loan to a Friend', accountType: 'asset', change: 'increase', answer: 'dr', explanation: 'Asset up → debit.' },
        { accountName: 'Car Loan Payable', accountType: 'liability', change: 'increase', answer: 'cr', explanation: 'Liability up → credit.' },
        { accountName: 'Interest Income', accountType: 'revenue', change: 'increase', answer: 'cr', explanation: 'Revenue up → credit.' },
        { accountName: 'Cash', accountType: 'asset', change: 'decrease', answer: 'cr', explanation: 'Asset down → credit.' },
        { accountName: 'Bank Fees Expense', accountType: 'expense', change: 'increase', answer: 'dr', explanation: 'Expense up → debit.' },
      ],
    },
    {
      id: '03-review-equation',
      sectionId: '03-t-accounts',
      kind: 'equation-fill',
      title: 'Review: after the transaction',
      role: 'review',
      difficulty: 2,
      prompt: `
Review from §1. Each line is your balance sheet **after** one transaction. Before each one you had Assets $4,000, Liabilities $1,000, Net Worth $3,000. Fill the blank (whole dollars).

1. You borrowed $500 into checking. Liabilities are now $1,500. Assets?
2. You paid $200 for dinner on your credit card. Assets are unchanged at $4,000; liabilities are $1,200. Net worth?
3. You paid $300 for car repairs from checking. Liabilities unchanged at $1,000; net worth is $2,700. Assets?
`.trim(),
      hints: ['A = L + E after every transaction.', 'Borrowing raises both sides; an expense lowers equity.'],
      explanation: '1. A = 1,500 + 3,000 = **4,500**. 2. E = 4,000 − 1,200 = **2,800**. 3. A = 1,000 + 2,700 = **3,700**.',
      items: [
        { assets: null, liabilities: 1500, equity: 3000, explanation: 'Borrowing adds the same 500 to assets and liabilities: 1,500 + 3,000 = 4,500.' },
        { assets: 4000, liabilities: 1200, equity: null, explanation: 'Liabilities +200, equity −200: 4,000 − 1,200 = 2,800.' },
        { assets: null, liabilities: 1000, equity: 2700, explanation: 'Assets −300, equity −300: 1,000 + 2,700 = 3,700.' },
      ],
    },
  ],
};
export default mod;
