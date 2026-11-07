/** Built-in example scenarios for the Sandbox. Every row balances and A = L + E holds (see examples.test.ts). */
import type { Account, AccountId, Posting, SandboxState, Side } from '@contracts';
import { entities } from '@content';

const $ = (dollars: number) => dollars * 100;

/** Accounts from a content entity by id, with an inline fallback in case content changes. */
function fromEntity(entityId: string, wanted: Account[]): Account[] {
  const coa = entities[entityId]?.accounts ?? [];
  return wanted.map((w) => {
    const a = coa.find((x) => x.id === w.id);
    return a && a.type === w.type ? { ...a } : w;
  });
}

function post(accounts: Account[], accountId: AccountId, side: Side, dollars: number): Posting {
  const type = accounts.find((a) => a.id === accountId)?.type;
  if (!type) throw new Error(`example: unknown account ${accountId}`);
  return { accountId, side, amount: $(dollars), chosenType: type };
}

// ---------- shared account definitions ----------
const youAccounts = (extra: Account[] = []) =>
  fromEntity('you', [
    { id: 'cash', name: 'Cash', type: 'asset' },
    { id: 'checking', name: 'Checking Account', type: 'asset' },
    ...extra,
    { id: 'net-worth', name: 'Net Worth', type: 'equity', equityGroup: 'retained' },
  ]);

const bankAccounts = (ids: AccountId[]) => {
  const all: Account[] = [
    { id: 'vault-cash', name: 'Cash – Vault', type: 'asset' },
    { id: 'reserves-fed', name: 'Reserves at the Federal Reserve', type: 'asset' },
    { id: 'loans-receivable', name: 'Loans Receivable', type: 'asset' },
    { id: 'deposits-checking', name: 'Customer Deposits – Checking', type: 'liability' },
    { id: 'deposits-fbo', name: 'Deposits – FBO Accounts', type: 'liability' },
    { id: 'paid-in-capital', name: 'Paid-in Capital', type: 'equity', equityGroup: 'paid-in' },
    { id: 'interest-income', name: 'Interest Income', type: 'revenue' },
  ];
  return fromEntity(
    'bank',
    all.filter((a) => ids.includes(a.id)),
  );
};
const bankName = () => entities.bank?.name ?? 'First Example Bank';
const youName = () => entities.you?.name ?? 'You';

// ---------- 1. Cash deposit ----------
function cashDeposit(): SandboxState {
  const you = youAccounts();
  const bank = bankAccounts(['vault-cash', 'reserves-fed', 'deposits-checking', 'paid-in-capital']);
  return {
    v: 1,
    title: 'Cash deposit — you and the bank',
    scenario:
      'You walk into **First Example Bank** with **$100** of cash and deposit it into your checking account.\n\n' +
      '- In *your* books, one asset becomes another — net worth doesn’t change.\n' +
      '- In the *bank’s* books, the cash is a new asset **and** a new liability: it now owes you $100.',
    entities: [
      {
        id: 'you',
        name: youName(),
        accounts: you,
        opening: { lines: [{ accountId: 'cash', amount: $(100) }, { accountId: 'net-worth', amount: $(100) }] },
        rows: [
          {
            id: 'r1',
            label: 'Deposit cash',
            postings: [post(you, 'checking', 'dr', 100), post(you, 'cash', 'cr', 100)],
          },
        ],
        showBalanceSheets: true,
      },
      {
        id: 'bank',
        name: bankName(),
        accounts: bank,
        opening: {
          lines: [
            { accountId: 'reserves-fed', amount: $(1000) },
            { accountId: 'paid-in-capital', amount: $(1000) },
          ],
        },
        rows: [
          {
            id: 'r1',
            label: 'Customer deposits cash',
            postings: [post(bank, 'vault-cash', 'dr', 100), post(bank, 'deposits-checking', 'cr', 100)],
          },
        ],
        showBalanceSheets: true,
      },
    ],
  };
}

// ---------- 2. Loan — both sides ----------
function loan(): SandboxState {
  const you = youAccounts([
    { id: 'loan-payable', name: 'Loan Payable', type: 'liability' },
    { id: 'interest-expense', name: 'Interest Expense', type: 'expense' },
  ]);
  const bank = bankAccounts(['reserves-fed', 'loans-receivable', 'deposits-checking', 'paid-in-capital', 'interest-income']);
  return {
    v: 1,
    title: 'Loan — both sides',
    scenario:
      'The bank lends you **$500**, credited straight to your checking account. A month later you pay **$5** of interest from checking.\n\n' +
      'Notice the bank creates the deposit when it makes the loan — no reserves move. ' +
      'Each row in your books mirrors a row in the bank’s books, with assets and liabilities swapped.',
    entities: [
      {
        id: 'you',
        name: youName(),
        accounts: you,
        rows: [
          {
            id: 'r1',
            label: 'Borrow $500',
            postings: [post(you, 'checking', 'dr', 500), post(you, 'loan-payable', 'cr', 500)],
          },
          {
            id: 'r2',
            label: 'Pay $5 interest',
            postings: [post(you, 'interest-expense', 'dr', 5), post(you, 'checking', 'cr', 5)],
          },
        ],
        showBalanceSheets: true,
      },
      {
        id: 'bank',
        name: bankName(),
        accounts: bank,
        opening: {
          lines: [
            { accountId: 'reserves-fed', amount: $(1000) },
            { accountId: 'paid-in-capital', amount: $(1000) },
          ],
        },
        rows: [
          {
            id: 'r1',
            label: 'Make the loan',
            postings: [post(bank, 'loans-receivable', 'dr', 500), post(bank, 'deposits-checking', 'cr', 500)],
          },
          {
            id: 'r2',
            label: 'Collect interest from checking',
            postings: [post(bank, 'deposits-checking', 'dr', 5), post(bank, 'interest-income', 'cr', 5)],
          },
        ],
        showBalanceSheets: true,
      },
    ],
  };
}

// ---------- 3. FBO top-up ----------
function fboTopUp(): SandboxState {
  const zap: Account[] = [
    { id: 'operating-cash', name: 'Cash – Operating', type: 'asset', description: 'Zap’s own money at the bank.' },
    { id: 'fbo-cash', name: 'Cash – FBO Account', type: 'asset', description: 'Customer money held at the bank for the benefit of Zap users.' },
    { id: 'customer-balances', name: 'Customer Balances Payable', type: 'liability', description: 'What Zap owes its users (their wallet balances).' },
    { id: 'paid-in-capital', name: 'Paid-in Capital', type: 'equity', equityGroup: 'paid-in' },
  ];
  const bank = bankAccounts(['reserves-fed', 'deposits-checking', 'deposits-fbo', 'paid-in-capital']);
  return {
    v: 1,
    title: 'FBO top-up — Zap and the bank',
    scenario:
      'Alice tops up her **Zap** wallet with **$50** from her checking account at **First Example Bank**, where Zap holds its FBO account.\n\n' +
      '- The bank just moves the liability from Alice’s checking deposit to the FBO deposit.\n' +
      '- Zap records the FBO cash as an asset and the wallet balance as what it owes Alice.',
    entities: [
      {
        id: 'zap',
        name: 'Zap',
        accounts: zap,
        opening: {
          lines: [
            { accountId: 'operating-cash', amount: $(200) },
            { accountId: 'paid-in-capital', amount: $(200) },
          ],
        },
        rows: [
          {
            id: 'r1',
            label: 'Alice tops up $50',
            postings: [post(zap, 'fbo-cash', 'dr', 50), post(zap, 'customer-balances', 'cr', 50)],
          },
        ],
        showBalanceSheets: true,
      },
      {
        id: 'bank',
        name: bankName(),
        accounts: bank,
        opening: {
          lines: [
            { accountId: 'reserves-fed', amount: $(1000) },
            { accountId: 'deposits-checking', amount: $(500) },
            { accountId: 'paid-in-capital', amount: $(500) },
          ],
        },
        rows: [
          {
            id: 'r1',
            label: 'Move $50 from Alice’s checking to Zap’s FBO',
            postings: [post(bank, 'deposits-checking', 'dr', 50), post(bank, 'deposits-fbo', 'cr', 50)],
          },
        ],
        showBalanceSheets: true,
      },
    ],
  };
}

export const EXAMPLES: { id: string; label: string; build: () => SandboxState }[] = [
  { id: 'cash-deposit', label: 'Cash deposit — you and the bank', build: cashDeposit },
  { id: 'loan', label: 'Loan — both sides', build: loan },
  { id: 'fbo-top-up', label: 'FBO top-up — Zap and the bank', build: fboTopUp },
];
