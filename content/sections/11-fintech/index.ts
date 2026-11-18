import type { BalanceSheet, Posting, SectionModule, TransactionRow } from '@contracts';

/** Owned by C2. Amounts below are written in whole dollars and converted to cents. */
const usd = (d: number) => d * 100;
const dr = (accountId: string, d: number): Posting => ({ accountId, side: 'dr', amount: usd(d) });
const cr = (accountId: string, d: number): Posting => ({ accountId, side: 'cr', amount: usd(d) });
const row = (id: string, label: string, ...postings: Posting[]): TransactionRow => ({ id, label, postings });
const bs = (o: Record<string, number>): BalanceSheet => ({
  lines: Object.entries(o).map(([accountId, d]) => ({ accountId, amount: usd(d) })),
});

const zap0 = { 'cash-operating': 50000, 'paid-in-capital': 50000 };
const zapAB = { 'cash-operating': 50000, 'cash-fbo': 150, 'cbp-alice': 100, 'cbp-bob': 50, 'paid-in-capital': 50000 };
const zapABC = { 'cash-operating': 50000, 'cash-fbo': 200, 'cbp-alice': 100, 'cbp-bob': 50, 'cbp-carol': 50, 'paid-in-capital': 50000 };

const primer = `
**Zap** is a P2P payments app. Customers load money into a Zap wallet, pay each other instantly, and cash out to their regular bank account. Zap earns fees. Zap is **not a bank**: customer money sits in an **[[FBO account]]** at First Example Bank (see the callout), while Zap’s own money sits in a separate **operating account** at the same bank.

In **Zap’s** books (the *[[gross-up]]* model):

| Account | Type | Meaning |
|---|---|---|
| Cash – FBO (Restricted) | Asset | Customers’ money in the FBO account. Zap controls it, can’t spend it. |
| Customer Balances Payable – *Alice/Bob/Carol* | Liability | What Zap owes each customer: their wallet balance. |
| Cash – Operating | Asset | Zap’s own money. |
| Clearing – Pending ACH Cash-outs | Liability | Cash-outs already deducted from a wallet but not yet settled out of the FBO account. |
| Transaction Fee Revenue | Revenue | Zap’s earnings. |

In **the bank’s** books, the FBO account is just another deposit: **Deposits – FBO Accounts** (liability). Zap’s operating account is in **Business Deposits**. The bank sees *one* FBO balance; it doesn’t know who Alice and Bob are.

Three patterns to master:
- **Money in / out of Zap** touches Cash – FBO *and* a customer liability (and the bank’s books).
- **Money between customers** touches only customer liabilities — no cash moves, the bank sees nothing.
- **Money in flight** sits in a **clearing** account until it settles.

The [[invariant]] Zap’s engineers check every day:
\`\`\`
Cash – FBO + in-flight receipts (Settlement Receivable, Cash in Transit)
    =  Σ Customer Balances + Pending Cash-outs + Suspense + Zap fees not yet swept
\`\`\`
`;

const lens = `
**Ledger-engineer's lens: in-flight money, [[sub-ledgers]] and [[reversals]]**

- **[[Clearing accounts]] are state.** "Cash-out requested but not settled" is a real state of real money. Model it as a balance in a clearing account rather than a status flag on a row — then your [[balance sheet]] is always correct, and a non-zero clearing balance after [[settlement]] windows is an alert.
- **Sub-ledger vs. GL.** Real Zap would have millions of wallets. The GL has **one** [[control account]], *Customer Balances Payable*; the per-customer balances live in a **sub-ledger**. Daily reconciliation: Σ sub-ledger = GL control account, and the FBO bank statement = Cash – FBO.
- **Never edit, reverse.** A wrong [[posting]] is fixed by a **reversal** (exact mirror) plus a **correcting** entry, each linked to the original by id. Netting the fix into one entry (“Dr Carol / Cr Bob”) hides what happened.
- **[[Idempotency keys]]** on every payment request: a retried “Alice pays Bob $20” must not post twice.
- **[[Suspense|suspense-account]]** is a quarantine queue: unmatched money goes there, an operator (or matcher job) resolves it, and the balance should trend to zero.
`;

const callouts = [
  {
    title: 'What is an FBO account?',
    body: `**FBO = "For Benefit Of."** It’s an account at a bank opened by a fintech, titled to show the money is held *for the benefit of* the fintech’s customers (something like "**Zap Inc., as custodian, FBO its customers**" or "Zap Inc. FBO Zap Customers").

**Why fintechs use them.** Zap isn’t a bank: it has no bank charter and can’t take deposits itself. To let customers hold balances, it partners with a bank and keeps customer money in an FBO account there. Zap instructs the money’s movements; the bank holds it.

**Why it protects customers.**
- **Segregation:** customer money is kept apart from Zap’s operating account, so Zap can’t use it to pay salaries — and if Zap fails, those funds are meant to belong to the customers, not to Zap’s creditors.
- **[[Pass-through deposit insurance]] (potentially):** if the account is titled correctly *and* Zap’s records show exactly how much belongs to each customer, FDIC insurance can "pass through" to each customer as if they had deposited directly, up to the usual limits. This protects against the **bank** failing — not against Zap failing. (When a fintech’s records were incomplete — as in the 2024 Synapse collapse — customers waited months to get their money.)
- **Regulation:** many states’ money-transmitter laws require customer funds to be segregated or backed by safe "permissible investments."

**Analogy: a landlord holding your security deposit.** The landlord controls the money and has it in their bank account, but it’s legally *yours* — they owe it back — and some states require it to be kept in a separate account. Zap is the landlord; the FBO account is the separate account.

The catch: the bank sees one pooled balance. **Who owns which dollar exists only in Zap’s [[ledger]].** That’s why the ledger you build has to be right.`,
  },
  {
    title: 'Gross-up vs. off-balance-sheet',
    body: `In this course Zap uses the **gross-up** model: the FBO cash appears on Zap’s balance sheet as a **restricted asset**, with an **equal liability** to customers. Customer money never touches Zap’s equity — it just makes both sides of the balance sheet bigger.

Some companies instead keep customer funds **off-balance-sheet**, tracking them only in a sub-ledger, on the view that the funds aren’t the company’s assets at all. Which presentation is appropriate depends on the legal arrangements and accounting judgment (and auditors). We don’t use it here — but the gross-up model makes every movement of customer money visible in the [[double-entry]], which is ideal for learning and for reconciliation.`,
  },
];

const fboTraps = [
  {
    id: 'bank-deposits-fbo',
    name: 'Deposits – FBO Accounts',
    type: 'liability' as const,
    trap: {
      kind: 'counterparty' as const,
      explanation:
        '**Deposits – FBO Accounts** is in **First Example Bank’s** books — the bank owes the money. In Zap’s books, the money in the FBO account is an asset (**Cash – FBO**), and what Zap owes each customer is **Customer Balances Payable**.',
    },
  },
  {
    id: 'customer-load-revenue',
    name: 'Customer Load Revenue',
    type: 'revenue' as const,
    trap: {
      kind: 'other' as const,
      explanation:
        'Loading a wallet isn’t revenue — Zap owes every dollar back to the customer. Customer money creates a **liability**; Zap only earns revenue from **fees**.',
    },
  },
];

const mod: SectionModule = {
  section: {
    id: '11-fintech',
    number: 11,
    title: 'Fintech: FBO, P2P, Clearing & Reversals',
    summary: 'Zap and its bank: customer funds, transfers, fees, cash-outs and corrections.',
    primer,
    lens,
    callouts,
    problemIds: [
      '11-fbo-load',
      '11-fbo-load-faded',
      '11-fbo-load-bank',
      '11-p2p',
      '11-p2p-bank-mc',
      '11-fee-and-sweep',
      '11-sweep-bank',
      '11-ach-cashout',
      '11-ach-return',
      '11-wrong-customer',
      '11-suspense',
      '11-rv-interest-zap',
      '11-rv-processing-accrual',
    ],
  },
  problems: [
    {
      id: '11-fbo-load',
      sectionId: '11-fintech',
      kind: 'booking',
      title: 'Alice loads $100 into Zap',
      role: 'worked',
      difficulty: 2,
      entityId: 'zap',
      prompt:
        'Alice sends **$100** from her account at another bank into her Zap wallet. The money lands in Zap’s **FBO account** at First Example Bank. Book this in **Zap’s** books.',
      hints: [
        'Whose books? Zap’s. Which Zap account holds customer money at the bank?',
        'Cash – FBO goes up. What does Zap now owe, and to whom?',
        'Is any of this Zap’s money — revenue or equity?',
      ],
      walkthrough: [
        '**Start from the account you know.** $100 arrived in the FBO account. In Zap’s books that’s **Cash – FBO (Restricted)**, an Asset → Dr Cash – FBO 100.',
        'Why not Cash – Operating? That’s Zap’s *own* money in a different account. Customer money must stay segregated.',
        'What did Zap give in return? A wallet balance Alice can spend or withdraw — Zap **owes** her $100. That’s a liability: **Customer Balances Payable – Alice** → Cr 100.',
        'Check: Assets +100, Liabilities +100, Equity unchanged. Customer money never touches Zap’s equity — the gross-up model just makes both sides bigger.',
      ],
      explanation:
        '**Dr Cash – FBO (Restricted) 100 / Cr Customer Balances Payable – Alice 100.** Zap holds the money (restricted asset) and owes it to Alice (liability) — like a landlord holding a security deposit. No revenue: Zap earns nothing by holding Alice’s money.\n\nOn the bank’s side, the same event is Dr Reserves at the Fed / Cr Deposits – FBO Accounts (next problem but one).',
      perspectivePairId: '11-fbo-load-bank',
      showBalanceSheets: true,
      journalView: true,
      opening: bs(zap0),
      trapAccounts: fboTraps,
      diagnosticExplanations: {
        EXTRA_ACCOUNT:
          'Customer money goes into the **FBO** account, never the operating account — and it isn’t revenue or equity. Only Cash – FBO and Alice’s balance change.',
        WRONG_TYPE: 'Cash – FBO is an **Asset** (restricted cash); Customer Balances Payable is a **Liability**.',
        COUNTERPARTY_ACCOUNT: 'That account belongs to the bank’s books. In Zap’s books use **Cash – FBO** and **Customer Balances Payable – Alice**.',
      },
      solution: [row('t1', 'Alice loads $100', dr('cash-fbo', 100), cr('cbp-alice', 100))],
    },
    {
      id: '11-fbo-load-faded',
      sectionId: '11-fintech',
      kind: 'booking',
      title: 'Bob loads $50',
      role: 'faded',
      difficulty: 1,
      entityId: 'zap',
      prompt: 'Row 1 (Alice loads $100) is booked. Now book **row 2**: Bob loads **$50** into his Zap wallet; it lands in the FBO account.',
      hints: ['Row 2 has the same shape as row 1 — which customer’s balance changes?', 'Debit the restricted cash; credit what Zap owes Bob.'],
      explanation:
        '**Row 2: Dr Cash – FBO 50 / Cr Customer Balances Payable – Bob 50.** Each customer has their own liability (sub-ledger) account. After both rows: Cash – FBO 150 = Alice 100 + Bob 50 — the FBO invariant holds.',
      showBalanceSheets: true,
      journalView: true,
      opening: bs(zap0),
      prefill: { locked: true, rows: [row('t1', 'Alice loads $100', dr('cash-fbo', 100), cr('cbp-alice', 100))] },
      trapAccounts: fboTraps,
      diagnosticExplanations: {
        EXTRA_ACCOUNT: 'Bob’s money goes into the FBO account and is owed to **Bob** — not Alice, and not Zap’s operating cash.',
      },
      solution: [
        row('t1', 'Alice loads $100', dr('cash-fbo', 100), cr('cbp-alice', 100)),
        row('t2', 'Bob loads $50', dr('cash-fbo', 50), cr('cbp-bob', 50)),
      ],
    },
    {
      id: '11-fbo-load-bank',
      sectionId: '11-fintech',
      kind: 'booking',
      title: 'The bank’s side of Alice’s $100',
      role: 'practice',
      difficulty: 2,
      entityId: 'bank',
      prompt:
        'Same event, other books. Alice’s **$100** arrives at First Example Bank by ACH from her other bank (it settles through the Federal Reserve) and is credited to **Zap’s FBO account**. Book this in **First Example Bank’s** books.',
      hints: [
        'Interbank transfers settle in reserve accounts at the Fed. Which bank asset goes up?',
        'The bank now owes $100 more to the holder of the FBO account. Which deposit account is that — Zap’s operating account or the FBO account?',
        'Does the bank know or care that the money is Alice’s?',
      ],
      explanation:
        '**Dr Reserves at the Federal Reserve 100 / Cr Deposits – FBO Accounts 100.** The incoming ACH settles between banks through the Fed, raising the bank’s reserves; the bank now owes $100 more on the FBO account.\n\nThe bank records **one** pooled FBO balance — it doesn’t track Alice. Compare Zap’s books: Dr Cash – FBO / Cr Customer Balances Payable – Alice. Zap’s **asset** (Cash – FBO) is the bank’s **liability** (Deposits – FBO).',
      perspectivePairId: '11-fbo-load',
      showBalanceSheets: true,
      opening: bs({ 'reserves-fed': 10000, 'deposits-business': 6000, 'paid-in-capital': 3000, 'retained-earnings': 1000 }),
      trapAccounts: [
        {
          id: 'zap-cbp-trap',
          name: 'Customer Balances Payable',
          type: 'liability',
          trap: {
            kind: 'counterparty',
            explanation: 'That’s **Zap’s** liability to its customers. The bank’s liability is to the FBO account holder: **Deposits – FBO Accounts**.',
          },
        },
        {
          id: 'zap-cash-fbo-trap',
          name: 'Cash – FBO (Restricted)',
          type: 'asset',
          trap: { kind: 'counterparty', explanation: 'Cash – FBO is **Zap’s** asset. For the bank, the same money is a deposit **liability**.' },
        },
      ],
      diagnosticExplanations: {
        EXTRA_ACCOUNT:
          'Use **Deposits – FBO Accounts**, not Business Deposits — Business Deposits holds Zap’s own operating account. And the money arrived electronically (reserves), not as vault cash.',
        WRONG_SIDE: 'For the bank, the deposit is a liability → it increases with a **credit**.',
      },
      solution: [row('t1', 'ACH in to Zap FBO account', dr('reserves-fed', 100), cr('deposits-fbo', 100))],
    },
    {
      id: '11-p2p',
      sectionId: '11-fintech',
      kind: 'booking',
      title: 'Alice pays Bob $20',
      role: 'practice',
      difficulty: 2,
      entityId: 'zap',
      prompt: 'Inside the app, **Alice pays Bob $20** for lunch. No fee. Book it in **Zap’s** books.',
      hints: [
        'Did any money leave or enter the FBO account at the bank?',
        'After the payment, does Zap owe Alice more or less? And Bob?',
        'Both accounts are liabilities. Which side decreases a liability, and which increases one?',
      ],
      explanation:
        '**Dr Customer Balances Payable – Alice 20 / Cr Customer Balances Payable – Bob 20.** A P2P payment is a **liability-to-liability** move: Zap owes Alice $20 less and Bob $20 more. The FBO cash doesn’t move — total customer balances (and the FBO account) are unchanged. Nothing happens at the bank.\n\nThis is why P2P inside a wallet is instant and free to run: it’s just two postings in Zap’s ledger.',
      showBalanceSheets: true,
      journalView: true,
      opening: bs(zapAB),
      trapAccounts: [
        {
          id: 'payments-revenue',
          name: 'Payments Revenue',
          type: 'revenue',
          trap: { kind: 'other', explanation: 'Zap earns nothing from a free transfer, and the $20 is never Zap’s money.' },
        },
        {
          id: 'bank-deposits-fbo-p2p',
          name: 'Deposits – FBO Accounts',
          type: 'liability',
          trap: {
            kind: 'counterparty',
            explanation: 'That’s the bank’s account — and the bank doesn’t even see this transfer. In Zap’s books, only the two customers’ balances change.',
          },
        },
      ],
      diagnosticExplanations: {
        EXTRA_ACCOUNT:
          'No money moved at the bank, so **Cash – FBO** doesn’t change. Only Alice’s and Bob’s balances change.',
        WRONG_SIDE: 'Alice’s balance **decreases** (debit a liability); Bob’s **increases** (credit a liability).',
      },
      solution: [row('t1', 'Alice pays Bob', dr('cbp-alice', 20), cr('cbp-bob', 20))],
    },
    {
      id: '11-p2p-bank-mc',
      sectionId: '11-fintech',
      kind: 'multiple-choice',
      title: 'What does the bank book for Alice → Bob?',
      role: 'practice',
      difficulty: 2,
      multi: false,
      prompt: 'Alice pays Bob **$20** inside Zap. What does **First Example Bank** record?',
      hints: ['Does any money enter or leave the FBO account?', 'Does the bank know who Alice and Bob are?'],
      explanation:
        '**Nothing.** The FBO account balance is unchanged — the transfer only changes how Zap’s ledger divides that balance among customers. The bank holds one pooled FBO deposit and has no record of Alice or Bob. This is exactly why Zap’s ledger is the only source of truth for who owns what.',
      options: [
        { text: 'Nothing — no entry.', correct: true, explanation: 'The pooled FBO balance doesn’t change; only Zap’s sub-ledger does.' },
        {
          text: 'Dr Deposits – FBO Accounts 20 / Cr Deposits – FBO Accounts 20',
          correct: false,
          explanation: 'Debiting and crediting the same account nets to zero — there’s nothing to record. The bank has no per-customer FBO accounts.',
        },
        {
          text: 'Dr Deposits – FBO Accounts 20 / Cr Business Deposits 20',
          correct: false,
          explanation: 'That would move money from the FBO account into a business (e.g. Zap’s operating) account. Nothing left the FBO account.',
        },
        {
          text: 'Dr Reserves at the Federal Reserve 20 / Cr Deposits – FBO Accounts 20',
          correct: false,
          explanation: 'No money came in from another bank. The $20 never left the FBO account.',
        },
      ],
    },
    {
      id: '11-fee-and-sweep',
      sectionId: '11-fintech',
      kind: 'booking',
      title: 'A $1 instant-transfer fee, then the sweep',
      role: 'practice',
      difficulty: 3,
      entityId: 'zap',
      prompt:
        '1. Alice pays Bob **$20** and chooses "instant", which costs her a **$1 fee**. Bob receives $20; Alice’s balance goes down $21.\n2. At end of day, Zap **sweeps** its $1 of earned fees from the FBO account to its operating account.\n\nBook both events.',
      hints: [
        'Row 1 is one event with three accounts: Alice’s balance, Bob’s balance, and Zap’s earnings.',
        'After row 1, is the $1 still sitting in the FBO account? Whose money is it now?',
        'Row 2: Zap’s own money shouldn’t stay in the customers’ account. Which cash goes up, which goes down?',
      ],
      explanation:
        '**Row 1: Dr Customer Balances Payable – Alice 21 / Cr Customer Balances Payable – Bob 20 / Cr Transaction Fee Revenue 1.** The fee moves $1 from what Zap owes Alice into Zap’s revenue. One event, one compound row.\n\n**Row 2: Dr Cash – Operating 1 / Cr Cash – FBO 1.** The $1 is now Zap’s money but physically still in the FBO account, which must hold only customer funds. The sweep moves it out — an asset swap, no revenue.\n\nAfter both rows: Cash – FBO 149 = Alice 79 + Bob 70. ✓ Invariant restored.',
      perspectivePairId: '11-sweep-bank',
      showBalanceSheets: true,
      journalView: true,
      opening: bs(zapAB),
      trapAccounts: [
        {
          id: 'fees-paid-to-zap',
          name: 'Fees Paid to Zap',
          type: 'expense',
          trap: { kind: 'counterparty', explanation: 'That’s how **Alice** would see the fee — her expense. In Zap’s books it’s **Transaction Fee Revenue**.' },
        },
        {
          id: 'due-from-fbo',
          name: 'Fees Receivable from FBO',
          type: 'asset',
          trap: {
            kind: 'other',
            explanation: 'Keep it simple: the fee is earned in row 1 (revenue), and the sweep in row 2 moves the actual cash between Zap’s two bank accounts.',
          },
        },
      ],
      diagnosticExplanations: {
        WRONG_AMOUNT: 'Row 1: Alice pays $20 + $1 fee = **21**; Bob gets **20**; Zap earns **1**.',
        EXTRA_ACCOUNT: 'Row 1 moves no bank money. Row 2 is a cash-to-cash sweep — the revenue was already recognized in row 1.',
        SPLIT_ENTRY: 'The payment and its fee are one event — book them as one compound row. The sweep is a separate event.',
      },
      solution: [
        row('t1', 'Alice pays Bob $20 + $1 fee', dr('cbp-alice', 21), cr('cbp-bob', 20), cr('transaction-fee-revenue', 1)),
        row('t2', 'Sweep fees to operating', dr('cash-operating', 1), cr('cash-fbo', 1)),
      ],
    },
    {
      id: '11-sweep-bank',
      sectionId: '11-fintech',
      kind: 'booking',
      title: 'The sweep, from the bank’s side',
      role: 'practice',
      difficulty: 2,
      entityId: 'bank',
      prompt:
        'Zap instructs First Example Bank to move **$1** from its **FBO account** to its **operating account** (both at First Example Bank; the operating account is recorded in **Business Deposits**). Book it in the **bank’s** books.',
      hints: [
        'Did any money leave the bank?',
        'The bank owes less on one deposit account and more on another. Which is which?',
      ],
      explanation:
        '**Dr Deposits – FBO Accounts 1 / Cr Business Deposits 1.** A liability-to-liability swap inside the bank: it owes $1 less on the FBO account and $1 more on Zap’s operating account. Reserves don’t move — both accounts are at the same bank. The bank books no revenue: the fee was Zap’s, not the bank’s.',
      perspectivePairId: '11-fee-and-sweep',
      showBalanceSheets: true,
      opening: bs({
        'reserves-fed': 10000,
        'deposits-business': 5850,
        'deposits-fbo': 150,
        'paid-in-capital': 3000,
        'retained-earnings': 1000,
      }),
      trapAccounts: [
        {
          id: 'zap-fee-revenue-trap',
          name: 'Transaction Fee Revenue',
          type: 'revenue',
          trap: { kind: 'counterparty', explanation: 'Zap earned the fee — not the bank. The bank just moves money between two of its deposit accounts.' },
        },
        {
          id: 'zap-cash-operating-trap',
          name: 'Cash – Operating',
          type: 'asset',
          trap: { kind: 'counterparty', explanation: 'Cash – Operating is **Zap’s** asset. The bank records Zap’s operating account as a liability: **Business Deposits**.' },
        },
      ],
      diagnosticExplanations: {
        EXTRA_ACCOUNT: 'Both accounts are at First Example Bank, so no reserves move. And the bank earns nothing here.',
        WRONG_SIDE: 'The FBO deposit **decreases** (debit); Zap’s operating deposit **increases** (credit).',
      },
      solution: [row('t1', 'Sweep $1 from FBO to Zap operating', dr('deposits-fbo', 1), cr('deposits-business', 1))],
    },
    {
      id: '11-ach-cashout',
      sectionId: '11-fintech',
      kind: 'booking',
      title: 'Bob cashes out: pending, then settled',
      role: 'practice',
      difficulty: 3,
      entityId: 'zap',
      prompt:
        '1. **Monday:** Bob requests a standard (free) cash-out of **$50** to his account at another bank. Zap deducts it from his wallet immediately and submits an ACH transfer.\n2. **Wednesday:** the ACH settles — **$50 leaves the FBO account**.\n\nBook both events in **Zap’s** books.',
      hints: [
        'Monday: Bob’s balance must drop now (so he can’t spend it twice) — but has any money left the FBO account yet?',
        'If the money is no longer Bob’s to spend but hasn’t left the bank, Zap still owes it to *someone*. Which account holds money in flight out?',
        'Wednesday: the clearing balance goes away and the cash finally leaves.',
      ],
      explanation:
        '**Row 1: Dr Customer Balances Payable – Bob 50 / Cr Clearing – Pending ACH Cash-outs 50.** Bob’s wallet is reduced at once. The money is still in the FBO account, and Zap is still on the hook to deliver it — now to Bob’s other bank. That obligation sits in the clearing liability.\n\n**Row 2: Dr Clearing – Pending ACH Cash-outs 50 / Cr Cash – FBO 50.** On settlement the cash leaves and the clearing account returns to zero.\n\nBetween Monday and Wednesday the invariant reads: Cash – FBO 149 = customers 99 + pending cash-outs 50. Without the clearing account you’d either show Bob money he no longer has, or show FBO cash that doesn’t match the bank statement.',
      showBalanceSheets: true,
      journalView: true,
      opening: bs({
        'cash-operating': 50001,
        'cash-fbo': 149,
        'cbp-alice': 79,
        'cbp-bob': 70,
        'paid-in-capital': 50000,
        'transaction-fee-revenue': 1,
      }),
      trapAccounts: [
        {
          id: 'bob-external-bank',
          name: 'Cash – Bob’s External Bank',
          type: 'asset',
          trap: { kind: 'counterparty', explanation: 'Bob’s account at his other bank is **Bob’s** asset — it never appears in Zap’s books.' },
        },
        {
          id: 'cashout-expense',
          name: 'Cash-out Expense',
          type: 'expense',
          trap: { kind: 'other', explanation: 'Paying Bob his own money isn’t a cost to Zap — it settles a liability.' },
        },
      ],
      diagnosticExplanations: {
        EXTRA_ACCOUNT:
          'Monday: no money has left the FBO account, so **Cash – FBO** doesn’t change yet. **Cash in Transit – Incoming ACH** is for money coming *in*; outgoing pending cash-outs use the clearing **liability**.',
        MISSING_ACCOUNT: 'Monday needs the clearing account: Bob’s balance moves into **Clearing – Pending ACH Cash-outs** until settlement.',
        WRONG_ROW: 'Cash – FBO only changes on Wednesday, when the ACH settles.',
      },
      solution: [
        row('t1', 'Bob requests $50 cash-out', dr('cbp-bob', 50), cr('ach-cashout-clearing', 50)),
        row('t2', 'ACH settles', dr('ach-cashout-clearing', 50), cr('cash-fbo', 50)),
      ],
    },
    {
      id: '11-ach-return',
      sectionId: '11-fintech',
      kind: 'booking',
      title: 'A cash-out bounces back',
      role: 'practice',
      difficulty: 3,
      entityId: 'zap',
      prompt:
        'Carol cashes out **$30**, but mistyped her account number.\n\n1. Carol requests the $30 cash-out; Zap deducts it and submits the ACH.\n2. The ACH settles out of the FBO account.\n3. Two days later the receiving bank **returns** the ACH ("no such account"): $30 comes back into the FBO account, and Zap restores Carol’s balance.\n\nBook all three events.',
      hints: [
        'Rows 1–2 follow the cash-out pattern from the previous problem.',
        'Row 3: money comes back into the FBO account. Whose money is it?',
        'Does Zap lose or earn anything from the return?',
      ],
      explanation:
        '**Row 1: Dr Customer Balances Payable – Carol 30 / Cr Clearing – Pending ACH Cash-outs 30.**\n**Row 2: Dr Clearing 30 / Cr Cash – FBO 30.**\n**Row 3: Dr Cash – FBO 30 / Cr Customer Balances Payable – Carol 30.**\n\nThe return is a new event — we don’t delete rows 1–2; they really happened. Cash comes back to the FBO account and Zap owes it to Carol again. Net effect of all three rows: nothing, and Carol’s balance is back to $50. No revenue or expense: it was always Carol’s money. (Some ledgers route returns through their own clearing account; booking straight back to the customer is fine when the return is matched immediately.)',
      showBalanceSheets: true,
      journalView: true,
      opening: bs(zapABC),
      trapAccounts: [
        {
          id: 'ach-return-income',
          name: 'ACH Return Income',
          type: 'revenue',
          trap: { kind: 'other', explanation: 'The returned $30 is Carol’s money coming back — Zap owes it to her. It’s a liability, not income.' },
        },
        {
          id: 'cashout-expense-2',
          name: 'Cash-out Expense',
          type: 'expense',
          trap: { kind: 'other', explanation: 'Paying out a customer’s own balance is not an expense for Zap — it settles a liability.' },
        },
      ],
      diagnosticExplanations: {
        EXTRA_ACCOUNT:
          'Row 3: once the ACH has settled, the clearing account is already zero. The returned money lands in the FBO account and is owed straight back to Carol.',
        MISSING_ACCOUNT: 'Row 3 restores Carol’s balance: Dr Cash – FBO, Cr Customer Balances Payable – Carol.',
      },
      solution: [
        row('t1', 'Carol requests $30 cash-out', dr('cbp-carol', 30), cr('ach-cashout-clearing', 30)),
        row('t2', 'ACH settles', dr('ach-cashout-clearing', 30), cr('cash-fbo', 30)),
        row('t3', 'ACH returned', dr('cash-fbo', 30), cr('cbp-carol', 30)),
      ],
    },
    {
      id: '11-wrong-customer',
      sectionId: '11-fintech',
      kind: 'booking',
      title: 'Paid to the wrong customer: reverse and rebook',
      role: 'practice',
      difficulty: 3,
      entityId: 'zap',
      prompt:
        'Alice paid Bob **$20**, but a bug credited **Carol** instead. Row 1 shows the bad entry as it was posted (locked — posted entries are never edited). Carol hasn’t spent the money.\n\nBook:\n- **Row 2:** a **reversal** of row 1.\n- **Row 3:** the **correct** entry.',
      hints: [
        'A reversal is the exact mirror of the original: same accounts, same amounts, sides swapped.',
        'After row 2, the books should look as if row 1 never happened. Then what should have been booked?',
        'Why not a single "Dr Carol / Cr Bob" fix? Think about what an auditor reading the ledger later would see.',
      ],
      explanation:
        '**Row 2 (reversal): Dr Customer Balances Payable – Carol 20 / Cr Customer Balances Payable – Alice 20.** Exactly undoes row 1.\n\n**Row 3 (correction): Dr Customer Balances Payable – Alice 20 / Cr Customer Balances Payable – Bob 20.** What should have happened.\n\nFinal balances: Alice 80, Bob 70, Carol 50. A single netted fix (Dr Carol / Cr Bob) reaches the same balances, but the ledger would then claim "money moved from Carol to Bob" — which never happened — and the link to the original error is lost. Reverse + rebook keeps an honest, append-only history, and each new row should reference the original by id. No cash moves at any point.',
      showBalanceSheets: true,
      journalView: true,
      opening: bs(zapABC),
      prefill: {
        locked: true,
        rows: [row('t1', 'Bug: Alice → Carol (should be Bob)', dr('cbp-alice', 20), cr('cbp-carol', 20))],
      },
      trapAccounts: [
        {
          id: 'error-correction-expense',
          name: 'Error Correction Expense',
          type: 'expense',
          trap: {
            kind: 'other',
            explanation: 'Nobody lost money — Carol hasn’t spent it. Fixing a mis-posting moves customer balances back; it’s not an expense.',
          },
        },
        {
          id: 'balance-adjustments',
          name: 'Customer Balance Adjustments',
          type: 'liability',
          trap: {
            kind: 'other',
            explanation: 'Don’t park corrections in a catch-all account. Reverse the original exactly, then post the correct entry to the real customers.',
          },
        },
      ],
      diagnosticExplanations: {
        MISSING_ACCOUNT:
          'Row 2 must mirror row 1 exactly (Carol and Alice); row 3 is the intended payment (Alice and Bob). A netted Carol → Bob row hides what happened.',
        EXTRA_ACCOUNT: 'No cash moves in a correction — Cash – FBO is unchanged. And Suspense is for unidentified money, not known errors.',
        WRONG_SIDE: 'A reversal swaps the sides of the original: Carol was credited, so now Carol is **debited**.',
      },
      solution: [
        row('t1', 'Bug: Alice → Carol (should be Bob)', dr('cbp-alice', 20), cr('cbp-carol', 20)),
        row('t2', 'Reverse row 1', dr('cbp-carol', 20), cr('cbp-alice', 20)),
        row('t3', 'Correct: Alice → Bob', dr('cbp-alice', 20), cr('cbp-bob', 20)),
      ],
    },
    {
      id: '11-suspense',
      sectionId: '11-fintech',
      kind: 'booking',
      title: 'Money from nowhere: the suspense account',
      role: 'practice',
      difficulty: 2,
      entityId: 'zap',
      prompt:
        '1. A **$75** wire arrives in Zap’s FBO account with no usable reference — Zap can’t tell which customer sent it.\n2. Next day, Carol contacts support with proof that she sent it. Zap credits her wallet.\n\nBook both events.',
      hints: [
        'Row 1: the cash is real and it’s in the FBO account. Is it Zap’s money? Whose is it?',
        'You owe it to *someone* you can’t identify yet. Which account is built for that?',
        'Row 2: no cash moves — you just learn who the liability belongs to.',
      ],
      explanation:
        '**Row 1: Dr Cash – FBO 75 / Cr Suspense 75.** The cash must be recorded (it’s on the bank statement), but it belongs to an unknown customer. Suspense holds the liability until it’s identified — it’s **not** income.\n\n**Row 2: Dr Suspense 75 / Cr Customer Balances Payable – Carol 75.** Once matched, the liability moves to Carol, and Suspense goes back to zero. A suspense account should always be trending to zero; old items need investigation (and, if never claimed, eventually follow unclaimed-property rules — still not revenue).',
      showBalanceSheets: true,
      journalView: true,
      opening: bs(zapABC),
      trapAccounts: [
        {
          id: 'misc-income',
          name: 'Miscellaneous Income',
          type: 'revenue',
          trap: { kind: 'other', explanation: 'Unidentified money isn’t Zap’s to keep. It belongs to a customer you haven’t matched yet → **Suspense**.' },
        },
        {
          id: 'customer-deposits-zap',
          name: 'Customer Deposits',
          type: 'liability',
          trap: {
            kind: 'counterparty',
            explanation: '"Deposits" is a **bank’s** account (and fintechs avoid the word — they aren’t banks). Zap uses **Suspense** until matched, then the customer’s **Customer Balances Payable**.',
          },
        },
      ],
      diagnosticExplanations: {
        EXTRA_ACCOUNT: 'Row 2 moves no money — the $75 has been in the FBO account since row 1. Only the liability is reassigned from Suspense to Carol.',
        MISSING_ACCOUNT: 'Row 1 credits **Suspense**: you owe the money, you just don’t know to whom yet.',
      },
      solution: [
        row('t1', 'Unidentified wire', dr('cash-fbo', 75), cr('suspense', 75)),
        row('t2', 'Matched to Carol', dr('suspense', 75), cr('cbp-carol', 75)),
      ],
    },
    {
      id: '11-rv-interest-zap',
      sectionId: '11-fintech',
      kind: 'booking',
      title: 'Review: Zap’s operating account earns interest',
      role: 'review',
      difficulty: 2,
      entityId: 'zap',
      prompt:
        'Zap accrues interest daily on its **operating** account and has accrued **$40** for November (see the opening balance sheet). On Nov 30 the bank pays the $40 into Zap’s operating account. Book the month-end posting in **Zap’s** books.',
      hints: [
        'The interest has already been recognized as income, day by day. Is there new revenue today?',
        'Which asset was holding the earned-but-unpaid interest? Which cash account receives it?',
      ],
      explanation:
        '**Dr Cash – Operating 40 / Cr Interest Receivable 40.** Same pattern as Bean There’s savings in §8: daily accruals built up Interest Receivable; the payment converts it to cash. No new revenue (that would double-count). It goes to **operating** cash because it’s interest on Zap’s own money.',
      showBalanceSheets: true,
      opening: bs({ 'cash-operating': 50000, 'interest-receivable': 40, 'paid-in-capital': 50000, 'interest-income': 40 }),
      trapAccounts: [
        {
          id: 'accrued-interest-payable-zap',
          name: 'Accrued Interest Payable',
          type: 'liability',
          trap: { kind: 'counterparty', explanation: 'That’s the **bank’s** account for interest it owes. Zap is owed the interest: **Interest Receivable**.' },
        },
        {
          id: 'interest-expense-zap',
          name: 'Interest Expense',
          type: 'expense',
          trap: { kind: 'counterparty', explanation: 'The bank pays the interest — it’s the bank’s expense, Zap’s income.' },
        },
      ],
      diagnosticExplanations: {
        EXTRA_ACCOUNT:
          'The interest was already recognized daily. Crediting Interest Income again would double-count it. And this is Zap’s own money → **Cash – Operating**, not Cash – FBO.',
      },
      solution: [row('t1', 'Bank pays November interest', dr('cash-operating', 40), cr('interest-receivable', 40))],
    },
    {
      id: '11-rv-processing-accrual',
      sectionId: '11-fintech',
      kind: 'booking',
      title: 'Review: accruing the processor’s bill',
      role: 'review',
      difficulty: 2,
      entityId: 'zap',
      prompt:
        'Zap’s ACH processor charges per transfer. November’s usage comes to **$300**, but the processor won’t send the invoice until mid-December. Record November’s cost at **Nov 30**.',
      hints: [
        'The cost was incurred in November. Which month should carry the expense?',
        'No invoice has arrived yet. Look at Zap’s chart: which liability is for costs incurred but **not yet invoiced**?',
      ],
      explanation:
        '**Dr Processing Expense 300 / Cr Accrued Expenses 300.** The service was used in November, so November bears the cost (accrual basis). Without an invoice, Zap records an **accrued expense**; when the invoice arrives it’s reclassified to Accounts Payable (or paid directly).',
      showBalanceSheets: true,
      opening: bs(zap0),
      trapAccounts: [
        {
          id: 'processor-revenue',
          name: 'Processing Revenue',
          type: 'revenue',
          trap: { kind: 'counterparty', explanation: 'The processor earns that revenue. For Zap it’s a cost: **Processing Expense**.' },
        },
        {
          id: 'prepaid-processing',
          name: 'Prepaid Processing Fees',
          type: 'asset',
          trap: { kind: 'near-synonym', explanation: 'Nothing was paid in advance — the service came first, payment later. That’s a liability.' },
        },
      ],
      diagnosticExplanations: {
        EXTRA_ACCOUNT:
          'No cash moves until the invoice is paid. And Zap’s chart separates **Accounts Payable** (invoice received) from **Accrued Expenses** (incurred, not yet invoiced) — use Accrued Expenses.',
      },
      solution: [row('t1', 'Accrue November processing', dr('processing-expense', 300), cr('accrued-expenses', 300))],
    },
  ],
};
export default mod;
