/**
 * The five v1 animations (VISION-2 §9), as plain data.
 * Amounts are authored in whole dollars via dr()/cr()/usd() and stored as cents.
 */
import type { TransactionRow } from '@contracts';
import { BANK, COFFEE, YOU, ZAP } from './accounts';
import { buildSteps, cr, dr, usd, type AnimLedger, type LedgerAnimationDef, type StepInput } from './model';

const row = (id: string, label: string, ...postings: TransactionRow['postings']): TransactionRow => ({
  id,
  label,
  postings,
});

// ---------------------------------------------------------------------------
// 1. cash-to-checking
// ---------------------------------------------------------------------------
function cashToChecking(): LedgerAnimationDef {
  const you: AnimLedger = {
    id: 'you',
    title: 'Your books',
    accounts: [YOU.cash, YOU.checking, YOU.netWorth],
    tAccounts: ['cash', 'checking'],
    opening: [
      { accountId: 'cash', amount: usd(100) },
      { accountId: 'net-worth', amount: usd(100) },
    ],
    showBalanceSheet: true,
  };
  const deposit = row('deposit', 'Deposit cash into checking', cr('cash', 100), dr('checking', 100));
  const steps: StepInput[] = [
    {
      caption:
        '**Starting point.** You have $100 of cash in your wallet and nothing in checking. Assets $100 (Cash) = Liabilities $0 + Equity $100 (Net Worth). Now you deposit the $100 into your checking account.',
    },
    {
      caption:
        '**Start with the account you’re sure about.** The bills leave your wallet, so **Cash ↓**. Cash is an asset — normal balance debit — so a decrease is a **credit**: *Cr Cash 100*.',
      draft: { ledger: 'you', row: row('deposit', deposit.label!, cr('cash', 100)) },
      highlight: [{ ledger: 'you', account: 'cash', note: '↓ Cr' }],
    },
    {
      caption:
        '**What did you get for it?** A bigger checking balance: **Checking ↑**. Checking is also an asset, so an increase is a **debit**: *Dr Checking 100*.',
      draft: { ledger: 'you', row: deposit },
      flows: [{ from: { ledger: 'you', account: 'cash' }, to: { ledger: 'you', account: 'checking' }, amount: usd(100) }],
      highlight: [{ ledger: 'you', account: 'checking', note: '↑ Dr' }],
    },
    {
      caption: '**Check the row.** Debits $100 = Credits $100 ✓. The row balances, so it is posted to both T-accounts.',
      post: [{ ledger: 'you', row: deposit }],
    },
    {
      caption:
        '**After.** Cash $0, Checking $100. Total assets are still **$100** — one asset went down and another went up by the same amount (an *asset swap*). Net Worth didn’t change: moving your own money doesn’t make you richer. A = L + E still holds ✓.',
      highlight: [
        { ledger: 'you', account: 'cash' },
        { ledger: 'you', account: 'checking' },
      ],
    },
  ];
  return { id: 'cash-to-checking', title: 'Depositing cash into checking', ledgers: [you], steps: buildSteps([you], steps) };
}

// ---------------------------------------------------------------------------
// 2. bank-view-deposit
// ---------------------------------------------------------------------------
function bankViewDeposit(): LedgerAnimationDef {
  const you: AnimLedger = {
    id: 'you',
    title: 'Your books',
    accounts: [YOU.cash, YOU.checking, YOU.netWorth],
    tAccounts: ['cash', 'checking'],
    opening: [
      { accountId: 'cash', amount: usd(100) },
      { accountId: 'net-worth', amount: usd(100) },
    ],
    showBalanceSheet: true,
  };
  const bank: AnimLedger = {
    id: 'bank',
    title: 'First Example Bank’s books',
    accounts: [BANK.vaultCash, BANK.reserves, BANK.depositsChecking, BANK.paidInCapital],
    tAccounts: ['vault-cash', 'deposits-checking'],
    opening: [
      { accountId: 'reserves-fed', amount: usd(1000) },
      { accountId: 'paid-in-capital', amount: usd(1000) },
    ],
    showBalanceSheet: true,
  };
  const yourRow = row('you-deposit', 'Deposit cash into checking', dr('checking', 100), cr('cash', 100));
  const bankRow = row('bank-deposit', 'Customer deposits cash', dr('vault-cash', 100), cr('deposits-checking', 100));
  const steps: StepInput[] = [
    {
      caption:
        '**Same event, two sets of books.** Left: **your** books — $100 of cash in your wallet. Right: **First Example Bank’s** books — it starts with $1,000 of reserves at the Fed, funded by $1,000 of its owners’ capital.',
    },
    {
      caption: '**Your books (recap):** *Dr Checking 100 / Cr Cash 100* — an asset swap for you.',
      post: [{ ledger: 'you', row: yourRow }],
      flows: [{ from: { ledger: 'you', account: 'cash' }, to: { ledger: 'you', account: 'checking' }, amount: usd(100) }],
    },
    {
      caption:
        '**Now the bank’s books.** What does the bank know changed? It physically received $100 of bills: **Cash – Vault ↑**, an asset, so *Dr Cash – Vault 100*.',
      draft: { ledger: 'bank', row: row('bank-deposit', bankRow.label!, dr('vault-cash', 100)) },
      flows: [{ from: { ledger: 'you', account: 'cash' }, to: { ledger: 'bank', account: 'vault-cash' }, amount: usd(100) }],
      highlight: [{ ledger: 'bank', account: 'vault-cash', note: '↑ Dr' }],
    },
    {
      caption:
        '**What does it owe in return?** The bank must give you $100 back whenever you ask — a **liability**. **Customer Deposits – Checking ↑** → *Cr Customer Deposits – Checking 100*.',
      draft: { ledger: 'bank', row: bankRow },
      highlight: [{ ledger: 'bank', account: 'deposits-checking', note: '↑ Cr' }],
    },
    {
      caption:
        '**Row balances ✓** (Dr $100 = Cr $100). Both sides of the bank’s balance sheet grew by $100: assets $1,100 = liabilities $100 + equity $1,000. The bank is no richer — it holds more cash but owes exactly that much more.',
      post: [{ ledger: 'bank', row: bankRow }],
    },
    {
      caption:
        '**The mirror.** Your *Checking Account* (an asset, debit-normal) and the bank’s *Customer Deposits – Checking* (a liability, credit-normal) are the same $100 seen from opposite sides. **Your money is the bank’s debt to you.** That’s why your bank statement says it “credited” your account: it’s describing *its* books.',
      highlight: [
        { ledger: 'you', account: 'checking', note: 'your asset' },
        { ledger: 'bank', account: 'deposits-checking', note: 'bank’s liability' },
      ],
    },
  ];
  const ledgers = [you, bank];
  return { id: 'bank-view-deposit', title: 'The same deposit in the bank’s books', ledgers, steps: buildSteps(ledgers, steps) };
}

// ---------------------------------------------------------------------------
// 3. loan-creates-deposit
// ---------------------------------------------------------------------------
function loanCreatesDeposit(): LedgerAnimationDef {
  const bank: AnimLedger = {
    id: 'bank',
    title: 'First Example Bank’s books',
    accounts: [BANK.reserves, BANK.loansReceivable, BANK.depositsChecking, BANK.paidInCapital, BANK.interestIncome],
    tAccounts: ['reserves-fed', 'loans-receivable', 'deposits-checking', 'interest-income'],
    opening: [
      { accountId: 'reserves-fed', amount: usd(1000) },
      { accountId: 'deposits-checking', amount: usd(100) },
      { accountId: 'paid-in-capital', amount: usd(900) },
    ],
    showBalanceSheet: true,
  };
  const you: AnimLedger = {
    id: 'you',
    title: 'Your books',
    accounts: [YOU.checking, YOU.loanPayable, YOU.netWorth, YOU.interestExpense],
    tAccounts: ['checking', 'loan-payable', 'interest-expense'],
    opening: [
      { accountId: 'checking', amount: usd(100) },
      { accountId: 'net-worth', amount: usd(100) },
    ],
    showBalanceSheet: true,
  };
  const bankLoan = row('bank-loan', 'Lend $1,000 to customer', dr('loans-receivable', 1000), cr('deposits-checking', 1000));
  const yourLoan = row('you-loan', 'Borrow $1,000', dr('checking', 1000), cr('loan-payable', 1000));
  const yourRepay = row(
    'you-repay',
    'Repay loan + interest',
    dr('loan-payable', 1000),
    dr('interest-expense', 50),
    cr('checking', 1050),
  );
  const bankRepay = row(
    'bank-repay',
    'Loan repaid + interest',
    dr('deposits-checking', 1050),
    cr('loans-receivable', 1000),
    cr('interest-income', 50),
  );
  const steps: StepInput[] = [
    {
      caption:
        '**Before.** You have $100 in checking. The bank has $1,000 of reserves at the Fed; it owes you your $100 deposit, and the rest ($900) is its owners’ equity. Now the bank lends you $1,000.',
    },
    {
      caption:
        '**The bank’s books first.** What is the bank sure about? You now owe it $1,000 — a claim it owns: **Loans Receivable ↑** (asset) → *Dr Loans Receivable 1,000*.',
      draft: { ledger: 'bank', row: row('bank-loan', bankLoan.label!, dr('loans-receivable', 1000)) },
      highlight: [{ ledger: 'bank', account: 'loans-receivable', note: '↑ Dr' }],
    },
    {
      caption:
        '**Where did the $1,000 go?** Into your checking account — which, on the bank’s books, is money it owes you: **Customer Deposits – Checking ↑** (liability) → *Cr Customer Deposits – Checking 1,000*.',
      draft: { ledger: 'bank', row: bankLoan },
      highlight: [{ ledger: 'bank', account: 'deposits-checking', note: '↑ Cr' }],
    },
    {
      caption:
        '**No cash left the bank.** Look at Reserves at the Federal Reserve: still $1,000. The bank didn’t hand over money it already had — it wrote a new deposit into existence. **The loan created a deposit.** Both sides of its balance sheet grew by $1,000.',
      post: [{ ledger: 'bank', row: bankLoan }],
      highlight: [{ ledger: 'bank', account: 'reserves-fed', note: 'no change' }],
    },
    {
      caption:
        '**Your books, mirrored.** Your checking balance went up — *Dr Checking 1,000* — and you now owe the bank — *Cr Loan Payable 1,000* (a liability). Your net worth didn’t change: borrowing isn’t income.',
      post: [{ ledger: 'you', row: yourLoan }],
      flows: [
        { from: { ledger: 'bank', account: 'deposits-checking' }, to: { ledger: 'you', account: 'checking' }, amount: usd(1000) },
      ],
      highlight: [
        { ledger: 'you', account: 'checking', note: '↑ Dr' },
        { ledger: 'you', account: 'loan-payable', note: '↑ Cr' },
      ],
    },
    {
      caption:
        '**Later: you repay $1,000 plus $50 interest — your books.** $1,050 leaves checking: *Cr Checking 1,050*. The debt is gone: *Dr Loan Payable 1,000*. The interest is the cost of borrowing: *Dr Interest Expense 50*, which lowers your net worth. Three postings, one row: Dr $1,050 = Cr $1,050 ✓.',
      post: [{ ledger: 'you', row: yourRepay }],
      flows: [
        { from: { ledger: 'you', account: 'checking' }, to: { ledger: 'you', account: 'loan-payable' }, amount: usd(1000) },
        { from: { ledger: 'you', account: 'checking' }, to: { ledger: 'you', account: 'interest-expense' }, amount: usd(50) },
      ],
    },
    {
      caption:
        '**The bank’s books.** It takes $1,050 out of your deposit: *Dr Customer Deposits – Checking 1,050*. Your loan is settled: *Cr Loans Receivable 1,000*. The $50 is revenue: *Cr Interest Income 50*, which grows the bank’s equity.',
      post: [{ ledger: 'bank', row: bankRepay }],
      flows: [
        {
          from: { ledger: 'bank', account: 'deposits-checking' },
          to: { ledger: 'bank', account: 'loans-receivable' },
          amount: usd(1000),
        },
        {
          from: { ledger: 'bank', account: 'deposits-checking' },
          to: { ledger: 'bank', account: 'interest-income' },
          amount: usd(50),
        },
      ],
    },
    {
      caption:
        '**After.** The loan is gone from both books, and so is the deposit it created — repaying a loan *destroys* that money again. What’s left: $50 of equity moved from you (net worth $100 → $50) to the bank (equity $900 → $950) as interest. Reserves never moved.',
      highlight: [
        { ledger: 'bank', account: 'reserves-fed', note: 'no change' },
        { ledger: 'you', account: 'interest-expense' },
        { ledger: 'bank', account: 'interest-income' },
      ],
    },
  ];
  const ledgers = [bank, you];
  return { id: 'loan-creates-deposit', title: 'A loan creates a deposit', ledgers, steps: buildSteps(ledgers, steps) };
}

// ---------------------------------------------------------------------------
// 4. daily-accrual
// ---------------------------------------------------------------------------
function dailyAccrual(): LedgerAnimationDef {
  const coffee: AnimLedger = {
    id: 'coffee',
    title: 'Bean There Coffee Co.’s books',
    accounts: [COFFEE.savings, COFFEE.interestReceivable, COFFEE.paidInCapital, COFFEE.interestIncome],
    tAccounts: ['savings', 'interest-receivable', 'interest-income'],
    opening: [
      { accountId: 'savings', amount: usd(3650) },
      { accountId: 'paid-in-capital', amount: usd(3650) },
    ],
    showBalanceSheet: true,
  };
  const day = (n: number) =>
    row(`day-${n}`, `Day ${n} interest accrual`, dr('interest-receivable', 1), cr('interest-income', 1));
  const accrualFlow = [
    {
      from: { ledger: 'coffee', account: 'interest-income' },
      to: { ledger: 'coffee', account: 'interest-receivable' },
      amount: usd(1),
    },
  ];
  const monthEnd = row('month-end', 'Bank pays month’s interest', dr('savings', 30), cr('interest-receivable', 30));
  const rest = Array.from({ length: 27 }, (_, i) => ({ ledger: 'coffee', row: day(i + 4) }));
  const steps: StepInput[] = [
    {
      caption:
        '**Bean There Coffee Co.** has $3,650 in a savings account earning 10% simple interest: $3,650 × 10% = $365 a year = **$1 a day**. The bank pays the interest once, at month-end — but Coffee Co. *earns* it every day.',
    },
    {
      caption:
        '**Day 1.** Coffee Co. has earned $1 it hasn’t received yet. It is owed money → **Interest Receivable ↑** (asset) → *Dr Interest Receivable 1*. It earned it → **Interest Income ↑** (revenue) → *Cr Interest Income 1*.',
      post: [{ ledger: 'coffee', row: day(1) }],
      flows: accrualFlow,
      highlight: [{ ledger: 'coffee', account: 'interest-receivable', note: '↑ Dr' }],
    },
    {
      caption: '**Day 2.** The same entry again. The receivable stacks up: $2.',
      post: [{ ledger: 'coffee', row: day(2) }],
      flows: accrualFlow,
    },
    {
      caption: '**Day 3.** $3 receivable, $3 of income. No cash has moved — Savings is still $3,650.',
      post: [{ ledger: 'coffee', row: day(3) }],
      flows: accrualFlow,
      highlight: [{ ledger: 'coffee', account: 'savings', note: 'no change' }],
    },
    {
      caption:
        '**Fast-forward to day 30.** Twenty-seven more identical rows. Interest Receivable = $30, Interest Income = $30. Equity has grown by $30 of income even though no cash arrived.',
      post: rest,
    },
    {
      caption:
        '**Month-end: the bank pays.** Cash arrives in savings → **Savings Account ↑** → *Dr Savings Account 30*. The receivable has been collected → **Interest Receivable ↓** → *Cr Interest Receivable 30*, back to $0. No new income here: it was already recognized, day by day.',
      post: [{ ledger: 'coffee', row: monthEnd }],
      flows: [
        {
          from: { ledger: 'coffee', account: 'interest-receivable' },
          to: { ledger: 'coffee', account: 'savings' },
          amount: usd(30),
        },
      ],
      highlight: [
        { ledger: 'coffee', account: 'savings', note: '↑ Dr' },
        { ledger: 'coffee', account: 'interest-receivable', note: '↓ Cr' },
      ],
    },
    {
      caption:
        '**Why bother?** Companies use the **accrual basis**: revenue is recorded when it is *earned* and expenses when they are *incurred*, whenever the cash moves — so every day’s and month’s income is right. People usually use the **cash basis**: you would just record $30 of interest income when it lands in your account. Same total, different timing.',
      highlight: [{ ledger: 'coffee', account: 'interest-income', note: '$30 earned' }],
    },
  ];
  return { id: 'daily-accrual', title: 'Daily interest accrual', ledgers: [coffee], steps: buildSteps([coffee], steps) };
}

// ---------------------------------------------------------------------------
// 5. fbo-gross-up
// ---------------------------------------------------------------------------
function fboGrossUp(): LedgerAnimationDef {
  const zap: AnimLedger = {
    id: 'zap',
    title: 'Zap’s books',
    accounts: [ZAP.cashFbo, ZAP.cbpAlice, ZAP.cbpBob],
    tAccounts: ['cash-fbo', 'cbp-alice', 'cbp-bob'],
    opening: [],
    showBalanceSheet: true,
  };
  const bank: AnimLedger = {
    id: 'bank',
    title: 'First Example Bank’s books',
    accounts: [BANK.reserves, BANK.depositsFbo, BANK.paidInCapital],
    tAccounts: ['reserves-fed', 'deposits-fbo'],
    opening: [
      { accountId: 'reserves-fed', amount: usd(1000) },
      { accountId: 'paid-in-capital', amount: usd(1000) },
    ],
    showBalanceSheet: true,
  };
  const zapIn = row('zap-in', 'Alice funds her Zap balance', dr('cash-fbo', 100), cr('cbp-alice', 100));
  const bankIn = row('bank-in', 'Funds arrive for Zap’s FBO account', dr('reserves-fed', 100), cr('deposits-fbo', 100));
  const p2p = row('p2p', 'Alice pays Bob $20', dr('cbp-alice', 20), cr('cbp-bob', 20));
  const steps: StepInput[] = [
    {
      caption:
        '**Zap** is a payments app. It doesn’t keep customer money in its own bank account: the money sits in a **For-Benefit-Of (FBO)** account at First Example Bank, held in Zap’s name *for the benefit of* its customers.',
    },
    {
      caption:
        '**Zap’s customer Alice sends $100 into Zap.** It lands in the FBO account: **Cash – FBO ↑** → *Dr Cash – FBO 100*. An asset on Zap’s books — but a *restricted* one: Zap can’t spend it on rent or payroll.',
      draft: { ledger: 'zap', row: row('zap-in', zapIn.label!, dr('cash-fbo', 100)) },
      highlight: [{ ledger: 'zap', account: 'cash-fbo', note: '↑ Dr' }],
    },
    {
      caption:
        '**But it isn’t Zap’s money.** Zap owes it to Alice on demand → **Customer Balances Payable – Alice ↑** (liability) → *Cr 100*. Zap’s balance sheet **grosses up**: assets and liabilities both +$100, equity unchanged. Like a landlord holding a tenant’s security deposit: the cash is in the landlord’s account, and so is the debt to give it back.',
      post: [{ ledger: 'zap', row: zapIn }],
      highlight: [{ ledger: 'zap', account: 'cbp-alice', note: '↑ Cr' }],
    },
    {
      caption:
        '**The bank’s books.** The money arrived by transfer, so it lands in the bank’s own account at the Fed: *Dr Reserves at the Federal Reserve 100*. The bank now owes that $100 to the FBO account: *Cr Deposits – FBO Accounts 100*. To the bank it’s one deposit; it doesn’t track Alice’s share.',
      post: [{ ledger: 'bank', row: bankIn }],
      flows: [{ from: { ledger: 'zap', account: 'cash-fbo' }, to: { ledger: 'bank', account: 'reserves-fed' }, amount: usd(100) }],
      highlight: [
        { ledger: 'zap', account: 'cash-fbo', note: 'Zap’s asset' },
        { ledger: 'bank', account: 'deposits-fbo', note: 'bank’s liability' },
      ],
    },
    {
      caption:
        '**Alice pays Bob $20 inside Zap.** Zap now owes Alice $20 less → **Customer Balances Payable – Alice ↓** → *Dr 20*.',
      draft: { ledger: 'zap', row: row('p2p', p2p.label!, dr('cbp-alice', 20)) },
      highlight: [{ ledger: 'zap', account: 'cbp-alice', note: '↓ Dr' }],
    },
    {
      caption:
        '…and owes Bob $20 more → **Customer Balances Payable – Bob ↑** → *Cr 20*. Dr $20 = Cr $20 ✓. That one row *is* the whole payment.',
      post: [{ ledger: 'zap', row: p2p }],
      flows: [
        {
          from: { ledger: 'zap', account: 'cbp-alice' },
          to: { ledger: 'zap', account: 'cbp-bob' },
          amount: usd(20),
        },
      ],
      highlight: [{ ledger: 'zap', account: 'cbp-bob', note: '↑ Cr' }],
    },
    {
      caption:
        '**Nothing moved at the bank.** FBO cash is still $100, and the bank posted nothing — it can’t even see the payment. Alice’s $80 + Bob’s $20 still equals the $100 in the FBO account. Keeping that equality true is a fintech ledger’s core job.',
      highlight: [
        { ledger: 'zap', account: 'cash-fbo', note: 'no change' },
        { ledger: 'bank', account: 'reserves-fed', note: 'no change' },
        { ledger: 'bank', account: 'deposits-fbo', note: 'no change' },
      ],
    },
  ];
  const ledgers = [zap, bank];
  return { id: 'fbo-gross-up', title: 'FBO accounts and the gross-up', ledgers, steps: buildSteps(ledgers, steps) };
}

export const animationDefs: LedgerAnimationDef[] = [
  cashToChecking(),
  bankViewDeposit(),
  loanCreatesDeposit(),
  dailyAccrual(),
  fboGrossUp(),
];
