/**
 * Built-in example scenarios for the Sandbox: each is a set of entities and several scenarios, the way the
 * Sandbox is meant to be used — write every scenario, and the chart of accounts they need emerges. Every entry
 * balances and A = L + E holds in every scenario's books (see model.test.ts).
 */
import type { Account, AccountId, EntityBooks, Posting, SandboxState, Side } from '@contracts';
import { entities } from '@content';
import { stateFromBooks } from '../src/sandbox';

const $ = (dollars: number) => dollars * 100;

/** Accounts from a content entity by id, with an inline fallback in case content changes. */
function fromEntity(entityId: string, wanted: Account[]): Account[] {
  const coa = entities[entityId]?.accounts ?? [];
  return wanted.map((w) => {
    const a = coa.find((x) => x.id === w.id);
    return a && a.type === w.type ? { ...a, ...(w.subtitle ? { subtitle: w.subtitle } : {}) } : w;
  });
}

function post(accounts: Account[], accountId: AccountId, side: Side, dollars: number): Posting {
  const type = accounts.find((a) => a.id === accountId)?.type;
  if (!type) throw new Error(`example: unknown account ${accountId}`);
  return { accountId, side, amount: $(dollars), chosenType: type };
}

/** One entity's books in one scenario. */
function books(
  id: string,
  name: string,
  accounts: Account[],
  entries: [label: string, ...postings: [AccountId, Side, number][]][],
  opening?: [AccountId, number][],
  showBalanceSheets = true,
): EntityBooks {
  const b: EntityBooks = {
    id,
    name,
    accounts,
    showBalanceSheets,
    rows: entries.map(([label, ...ps], i) => ({
      id: `r${i + 1}`,
      label,
      postings: ps.map(([a, side, d]) => post(accounts, a, side, d)),
    })),
  };
  if (opening)
    b.opening = { lines: opening.map(([accountId, d]) => ({ accountId, amount: $(d) })) };
  return b;
}

const bankName = () => entities.bank?.name ?? 'First Example Bank';
const youName = () => entities.you?.name ?? 'You';

// ============ 1. You and your bank ============
function youAndYourBank(): SandboxState {
  const you = fromEntity('you', [
    { id: 'cash', name: 'Cash', type: 'asset', subtitle: 'In your wallet' },
    { id: 'checking', name: 'Checking Account', type: 'asset', subtitle: 'At the bank' },
    { id: 'loan-payable', name: 'Loan Payable', type: 'liability' },
    { id: 'net-worth', name: 'Net Worth', type: 'equity', equityGroup: 'retained' },
    { id: 'interest-expense', name: 'Interest Expense', type: 'expense' },
  ]);
  const bank = fromEntity('bank', [
    { id: 'vault-cash', name: 'Cash: Vault', type: 'asset' },
    { id: 'reserves-fed', name: 'Reserves at the Federal Reserve', type: 'asset' },
    { id: 'loans-receivable', name: 'Loans Receivable', type: 'asset' },
    {
      id: 'deposits-checking',
      name: 'Customer Deposits: Checking',
      type: 'liability',
      subtitle: 'What the bank owes depositors',
    },
    { id: 'paid-in-capital', name: 'Paid-in Capital', type: 'equity', equityGroup: 'paid-in' },
    { id: 'interest-income', name: 'Interest Income', type: 'revenue' },
  ]);
  const Y = (e: Parameters<typeof books>[3], o?: [AccountId, number][]) =>
    books('you', youName(), you, e, o);
  const B = (e: Parameters<typeof books>[3], o?: [AccountId, number][]) =>
    books('bank', bankName(), bank, e, o);
  return stateFromBooks('You and your bank', [
    {
      id: 'cash-deposit',
      title: 'Deposit cash',
      text:
        'You walk into **First Example Bank** with **$100** of cash and deposit it into your checking account.\n\n' +
        '- In *your* books, one asset becomes another — net worth doesn’t change.\n' +
        '- In the *bank’s* books, the cash is a new asset **and** a new liability: it now owes you $100.',
      books: [
        Y(
          [['Deposit cash', ['checking', 'dr', 100], ['cash', 'cr', 100]]],
          [
            ['cash', 100],
            ['net-worth', 100],
          ],
        ),
        B(
          [['Customer deposits cash', ['vault-cash', 'dr', 100], ['deposits-checking', 'cr', 100]]],
          [
            ['reserves-fed', 1000],
            ['paid-in-capital', 1000],
          ],
        ),
      ],
    },
    {
      id: 'loan',
      title: 'Borrow, then pay interest',
      text:
        'The bank lends you **$500**, credited straight to your checking account. A month later you pay **$5** of interest from checking.\n\n' +
        'Notice the bank *creates* the deposit when it makes the loan — no reserves move. ' +
        'Each entry in your books mirrors one in the bank’s, with assets and liabilities swapped.',
      books: [
        Y([
          ['Borrow $500', ['checking', 'dr', 500], ['loan-payable', 'cr', 500]],
          ['Pay $5 interest', ['interest-expense', 'dr', 5], ['checking', 'cr', 5]],
        ]),
        B(
          [
            ['Make the loan', ['loans-receivable', 'dr', 500], ['deposits-checking', 'cr', 500]],
            [
              'Collect interest from checking',
              ['deposits-checking', 'dr', 5],
              ['interest-income', 'cr', 5],
            ],
          ],
          [
            ['reserves-fed', 1000],
            ['paid-in-capital', 1000],
          ],
        ),
      ],
    },
    {
      id: 'repay',
      title: 'Repay the loan',
      text:
        'You pay back the **$500** loan from checking.\n\n' +
        'The mirror image of borrowing: your asset and liability both shrink — and in the bank’s books, the deposit ' +
        'and the loan cancel out. Repaying a loan *destroys* the deposit money the loan created.',
      books: [
        Y(
          [['Repay the loan', ['loan-payable', 'dr', 500], ['checking', 'cr', 500]]],
          [
            ['checking', 1000],
            ['loan-payable', 500],
            ['net-worth', 500],
          ],
        ),
        B(
          [
            [
              'Loan repaid from checking',
              ['deposits-checking', 'dr', 500],
              ['loans-receivable', 'cr', 500],
            ],
          ],
          [
            ['reserves-fed', 1000],
            ['loans-receivable', 500],
            ['deposits-checking', 1000],
            ['paid-in-capital', 500],
          ],
        ),
      ],
    },
  ]);
}

// ============ 2. Zap: a wallet on an FBO account ============
function zapWallet(): SandboxState {
  const zap: Account[] = [
    {
      id: 'operating-cash',
      name: 'Cash: Operating',
      type: 'asset',
      subtitle: 'Zap’s own money',
      description: 'Zap’s own checking account at the bank.',
    },
    {
      id: 'fbo-cash',
      name: 'Cash: FBO Account',
      type: 'asset',
      subtitle: 'Users’ money, held for them',
      description: 'Customer money held at the bank for the benefit of Zap users.',
    },
    { id: 'wallet-alice', name: 'Wallet: Alice', type: 'liability', subtitle: 'Customer balances' },
    { id: 'wallet-bob', name: 'Wallet: Bob', type: 'liability', subtitle: 'Customer balances' },
    { id: 'paid-in-capital', name: 'Paid-in Capital', type: 'equity', equityGroup: 'paid-in' },
    { id: 'fee-revenue', name: 'Fee Revenue', type: 'revenue', subtitle: 'Cash-out fees' },
  ];
  const bank = fromEntity('bank', [
    { id: 'reserves-fed', name: 'Reserves at the Federal Reserve', type: 'asset' },
    {
      id: 'deposits-checking',
      name: 'Customer Deposits: Checking',
      type: 'liability',
      subtitle: 'Alice, Zap’s operating account…',
    },
    {
      id: 'deposits-fbo',
      name: 'Deposits: FBO Accounts',
      type: 'liability',
      subtitle: 'Held for Zap’s users',
    },
    { id: 'paid-in-capital', name: 'Paid-in Capital', type: 'equity', equityGroup: 'paid-in' },
  ]);
  // Bob banks somewhere else, so his cash-out leaves First Example Bank and settles through the Fed.
  const bobsBank: Account[] = [
    {
      id: 'reserves-fed',
      name: 'Reserves at the Federal Reserve',
      type: 'asset',
      subtitle: 'Payments between banks settle here',
    },
    {
      id: 'deposits-checking',
      name: 'Customer Deposits: Checking',
      type: 'liability',
      subtitle: 'Bob, …',
    },
    { id: 'paid-in-capital', name: 'Paid-in Capital', type: 'equity', equityGroup: 'paid-in' },
  ];
  // Example entity codes and GL numbers (turn on "Codes & GL numbers" to see them). Just example data — the
  // Sandbox imposes no numbering convention.
  const gl = (accounts: Account[], numbers: Record<string, string>) =>
    accounts.map((a) => (numbers[a.id] ? { ...a, number: numbers[a.id] } : a));
  const zapGl = gl(zap, {
    'operating-cash': '1010',
    'fbo-cash': '1020',
    'wallet-alice': '2010',
    'wallet-bob': '2020',
    'paid-in-capital': '3010',
    'fee-revenue': '4010',
  });
  const bankGl = gl(bank, {
    'reserves-fed': '1100',
    'deposits-checking': '2100',
    'deposits-fbo': '2150',
    'paid-in-capital': '3000',
  });
  const bobsGl = gl(bobsBank, {
    'reserves-fed': '1100',
    'deposits-checking': '2100',
    'paid-in-capital': '3000',
  });
  const Z = (e: Parameters<typeof books>[3], o?: [AccountId, number][]) => ({
    ...books('zap', 'Zap', zapGl, e, o),
    code: '1000',
  });
  const B = (e: Parameters<typeof books>[3], o?: [AccountId, number][]) => ({
    ...books('bank', bankName(), bankGl, e, o),
    code: '2000',
  });
  const BB = (e: Parameters<typeof books>[3], o?: [AccountId, number][]) => ({
    ...books('bobs-bank', 'Bob’s Bank', bobsGl, e, o),
    code: '3000',
  });
  return stateFromBooks('Zap — a wallet on an FBO account', [
    {
      id: 'top-up',
      title: 'Alice tops up $50',
      text:
        'Alice tops up her **Zap** wallet with **$50** from her checking account at **First Example Bank**, where Zap holds an FBO (“for the benefit of”) account.\n\n' +
        '- The bank just moves its liability from Alice’s checking deposit to the FBO deposit.\n' +
        '- Zap records the FBO cash as an asset, and Alice’s wallet balance as what it owes her.',
      books: [
        Z(
          [['Alice tops up $50', ['fbo-cash', 'dr', 50], ['wallet-alice', 'cr', 50]]],
          [
            ['operating-cash', 200],
            ['paid-in-capital', 200],
          ],
        ),
        B(
          [
            [
              'Move $50 from Alice’s checking to Zap’s FBO',
              ['deposits-checking', 'dr', 50],
              ['deposits-fbo', 'cr', 50],
            ],
          ],
          [
            ['reserves-fed', 1000],
            ['deposits-checking', 500],
            ['paid-in-capital', 500],
          ],
        ),
      ],
    },
    {
      id: 'p2p',
      title: 'Alice pays Bob $20 in Zap',
      text:
        'Alice sends Bob **$20** inside Zap.\n\n' +
        'Only Zap’s books change: it now owes Alice less and Bob more. **The bank sees nothing** — the money ' +
        'never leaves the FBO account. (Look at the bank’s T-accounts: no entries.) This is why a wallet needs ' +
        'its own ledger: the bank can’t tell you who owns what inside the FBO account.',
      books: [
        Z(
          [['Alice pays Bob $20', ['wallet-alice', 'dr', 20], ['wallet-bob', 'cr', 20]]],
          [
            ['operating-cash', 200],
            ['fbo-cash', 50],
            ['wallet-alice', 50],
            ['paid-in-capital', 200],
          ],
        ),
        B(
          [],
          [
            ['reserves-fed', 1000],
            ['deposits-checking', 450],
            ['deposits-fbo', 50],
            ['paid-in-capital', 500],
          ],
        ),
      ],
    },
    {
      id: 'cash-out',
      title: 'Bob cashes out, less a $1 fee',
      text:
        'Bob withdraws his **$20** to his checking account at **Bob’s Bank** — a different bank. Zap keeps a **$1** ' +
        'fee, then sweeps the fee from the FBO account into its own operating account. Two events, three sets of books:\n\n' +
        '1. **E1 — the cash-out.** Zap: one entry with three lines — Bob’s wallet goes down $20, $19 leaves the FBO ' +
        'account, and $1 is Zap’s fee revenue. First Example Bank owes $19 less on the FBO deposit and pays it out ' +
        'through the **Federal Reserve**, so its reserves fall $19. Bob’s Bank receives the $19 in its reserves and ' +
        'now owes it to Bob.\n' +
        '2. **E2 — the fee sweep**, later: that $1 must leave the FBO account — it’s no longer users’ money. Both ' +
        'accounts are at First Example Bank, so no reserves move; Bob’s Bank has no entry.\n\n' +
        'Check the reconciliation: First Example Bank’s **Deposits: FBO Accounts** ends at $30, exactly Zap’s ' +
        '**Cash: FBO Account** — and exactly what Zap owes its users (Alice’s $30). The $19 that left its reserves ' +
        'is the $19 that arrived in Bob’s Bank’s.',
      books: [
        Z(
          [
            [
              'Bob cashes out $20, less a $1 fee',
              ['wallet-bob', 'dr', 20],
              ['fbo-cash', 'cr', 19],
              ['fee-revenue', 'cr', 1],
            ],
            ['Sweep the fee to operating', ['operating-cash', 'dr', 1], ['fbo-cash', 'cr', 1]],
          ],
          [
            ['operating-cash', 200],
            ['fbo-cash', 50],
            ['wallet-alice', 30],
            ['wallet-bob', 20],
            ['paid-in-capital', 200],
          ],
        ),
        B(
          [
            // Bob banks elsewhere: the $19 leaves through the Fed, so First Example Bank's reserves fall.
            [
              'Bob cashes out $20, less a $1 fee',
              ['deposits-fbo', 'dr', 19],
              ['reserves-fed', 'cr', 19],
            ],
            // The sweep stays inside First Example Bank (Zap's operating account is here too): no reserves move.
            [
              'Sweep the fee to operating',
              ['deposits-fbo', 'dr', 1],
              ['deposits-checking', 'cr', 1],
            ],
          ],
          [
            ['reserves-fed', 1000],
            ['deposits-checking', 450],
            ['deposits-fbo', 50],
            ['paid-in-capital', 500],
          ],
        ),
        // Bob's bank receives the $19 through the Fed and owes it to Bob. The sweep (E2) isn't in its books.
        BB(
          [
            [
              'Bob cashes out $20, less a $1 fee',
              ['reserves-fed', 'dr', 19],
              ['deposits-checking', 'cr', 19],
            ],
          ],
          [
            ['reserves-fed', 2000],
            ['deposits-checking', 1500],
            ['paid-in-capital', 500],
          ],
        ),
      ],
    },
  ]);
}

// ============ 3. A payroll provider (best in the Grid view) ============
function payroll(): SandboxState {
  const provider: Account[] = [
    { id: 'cash', name: 'Cash', type: 'asset', subtitle: 'Bank account' },
    {
      id: 'employer-foo-receivable',
      name: 'Employer Foo Receivable',
      type: 'asset',
      subtitle: 'Employer receivables',
    },
    {
      id: 'foo-employee-1-payable',
      name: 'Foo Employee 1 Payable',
      type: 'liability',
      subtitle: 'Employee payables',
    },
    {
      id: 'foo-employee-2-payable',
      name: 'Foo Employee 2 Payable',
      type: 'liability',
      subtitle: 'Employee payables',
    },
    { id: 'fee-revenue', name: 'Fee Revenue', type: 'revenue', subtitle: 'Income' },
  ];
  const foo: Account[] = [
    { id: 'cash', name: 'Cash', type: 'asset', subtitle: 'Operating bank account' },
    {
      id: 'payroll-payable',
      name: 'Payroll Payable',
      type: 'liability',
      subtitle: 'Owed to the payroll provider',
    },
    { id: 'paid-in-capital', name: 'Paid-in Capital', type: 'equity', equityGroup: 'paid-in' },
    { id: 'wages-expense', name: 'Wages Expense', type: 'expense' },
    { id: 'payroll-fees', name: 'Payroll Fees', type: 'expense', subtitle: 'Provider fee' },
  ];
  const P = (e: Parameters<typeof books>[3], o?: [AccountId, number][]) =>
    books('payroll-provider', 'Payroll provider', provider, e, o, false);
  const F = (e: Parameters<typeof books>[3], o?: [AccountId, number][]) =>
    books('employer-foo', 'Employer Foo', foo, e, o, false);
  return stateFromBooks('A payroll provider', [
    {
      id: 'run-payroll',
      title: 'Run payroll',
      text:
        'A payroll provider runs **$2,000** of payroll for **Employer Foo** (Employee 1: $1,200, Employee 2: $800) and charges a **$20** fee.\n\n' +
        '1. Running payroll: Foo now owes us $2,020; we owe each employee their pay; we earned the fee.\n' +
        '2. We pull $2,020 from Foo’s bank account.\n' +
        '3–4. We pay each employee; Cash ends at the $20 fee we kept.\n\n' +
        '**Employer Foo**’s books (its tab in the Journal and the Grid) show the same events from the employer’s side: an expense and a payable, then the cash leaves.',
      books: [
        P([
          [
            'Employer Foo runs payroll',
            ['employer-foo-receivable', 'dr', 2020],
            ['fee-revenue', 'cr', 20],
            ['foo-employee-1-payable', 'cr', 1200],
            ['foo-employee-2-payable', 'cr', 800],
          ],
          ['Debit Employer Foo', ['cash', 'dr', 2020], ['employer-foo-receivable', 'cr', 2020]],
          ['Credit Foo Employee 1', ['foo-employee-1-payable', 'dr', 1200], ['cash', 'cr', 1200]],
          ['Credit Foo Employee 2', ['foo-employee-2-payable', 'dr', 800], ['cash', 'cr', 800]],
        ]),
        F(
          [
            [
              'Run payroll with the provider',
              ['wages-expense', 'dr', 2000],
              ['payroll-fees', 'dr', 20],
              ['payroll-payable', 'cr', 2020],
            ],
            [
              'Provider debits our bank account',
              ['payroll-payable', 'dr', 2020],
              ['cash', 'cr', 2020],
            ],
          ],
          [
            ['cash', 10000],
            ['paid-in-capital', 10000],
          ],
        ),
      ],
    },
    {
      id: 'ach-return',
      title: 'An employee payment bounces',
      text:
        'Employee 2’s **$800** payment comes back (an ACH return: the account number was wrong). We still owe them, so ' +
        'the payable comes back too — then we send it again to the right account.\n\n' +
        'Employer Foo’s books don’t change: Foo paid us, and the problem is ours to fix. A return is its own entry, ' +
        'never an edit of the original payment — the ledger keeps the history.',
      books: [
        P(
          [
            ['ACH return: Employee 2', ['cash', 'dr', 800], ['foo-employee-2-payable', 'cr', 800]],
            ['Re-send to Employee 2', ['foo-employee-2-payable', 'dr', 800], ['cash', 'cr', 800]],
          ],
          [
            ['cash', 20],
            ['fee-revenue', 20],
          ],
        ),
      ],
    },
  ]);
}

export const EXAMPLES: { id: string; label: string; build: () => SandboxState }[] = [
  { id: 'bank', label: 'You and your bank (3 scenarios)', build: youAndYourBank },
  {
    id: 'fbo',
    label: 'Zap — a wallet on an FBO account (3 scenarios, 3 entities)',
    build: zapWallet,
  },
  { id: 'payroll', label: 'A payroll provider (2 scenarios)', build: payroll },
];
