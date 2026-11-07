/**
 * Accounts used by the animations. Ids for You and First Example Bank match
 * content/entities/{you,bank}.ts (a test checks the types agree); accounts those CoAs
 * don't have yet (or that belong to Coffee Co. / Zap) are defined locally so the
 * animations don't depend on other workstreams' files.
 */
import type { Account } from '@contracts';

export const YOU = {
  cash: { id: 'cash', name: 'Cash', type: 'asset' },
  checking: { id: 'checking', name: 'Checking Account', type: 'asset' },
  loanPayable: { id: 'loan-payable', name: 'Loan Payable', type: 'liability' },
  netWorth: { id: 'net-worth', name: 'Net Worth', type: 'equity', equityGroup: 'retained' },
  interestExpense: { id: 'interest-expense', name: 'Interest Expense', type: 'expense' },
} satisfies Record<string, Account>;

export const BANK = {
  vaultCash: { id: 'vault-cash', name: 'Cash – Vault', type: 'asset' },
  reserves: { id: 'reserves-fed', name: 'Reserves at the Federal Reserve', type: 'asset' },
  loansReceivable: { id: 'loans-receivable', name: 'Loans Receivable', type: 'asset' },
  depositsChecking: { id: 'deposits-checking', name: 'Customer Deposits – Checking', type: 'liability' },
  depositsFbo: { id: 'deposits-fbo', name: 'Deposits – FBO Accounts', type: 'liability' },
  paidInCapital: { id: 'paid-in-capital', name: 'Paid-in Capital', type: 'equity', equityGroup: 'paid-in' },
  interestIncome: { id: 'interest-income', name: 'Interest Income', type: 'revenue' },
} satisfies Record<string, Account>;

export const COFFEE = {
  savings: { id: 'savings', name: 'Savings Account', type: 'asset' },
  interestReceivable: { id: 'interest-receivable', name: 'Interest Receivable', type: 'asset' },
  paidInCapital: { id: 'paid-in-capital', name: 'Paid-in Capital', type: 'equity', equityGroup: 'paid-in' },
  interestIncome: { id: 'interest-income', name: 'Interest Income', type: 'revenue' },
} satisfies Record<string, Account>;

export const ZAP = {
  cashFbo: {
    id: 'cash-fbo',
    name: 'Cash – FBO (restricted)',
    type: 'asset',
    description: 'Customer money held in the For-Benefit-Of account at the bank. Restricted: not Zap’s to spend.',
  },
  cbpAlice: { id: 'customer-balances-alice', name: 'Customer Balances Payable – Alice', type: 'liability' },
  cbpBob: { id: 'customer-balances-bob', name: 'Customer Balances Payable – Bob', type: 'liability' },
} satisfies Record<string, Account>;
