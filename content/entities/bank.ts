import type { EntityCoA } from '@contracts';

/**
 * First Example Bank — accrual basis. Owned by C1.
 * The account ids below are a CROSS-STREAM CONTRACT (C2 uses them in §8 and §11):
 * C1 may add accounts, edit names/descriptions, and reorder, but must not remove or rename these ids or change their types.
 */
const bank: EntityCoA = {
  id: 'bank',
  name: 'First Example Bank',
  kind: 'bank',
  basis: 'accrual',
  accounts: [
    { id: 'vault-cash', name: 'Cash – Vault', type: 'asset', description: 'Physical currency held in the vault and ATMs.' },
    { id: 'reserves-fed', name: 'Reserves at the Federal Reserve', type: 'asset', description: "The bank's account at the Fed." },
    { id: 'loans-receivable', name: 'Loans Receivable', type: 'asset', description: 'Principal owed to the bank by borrowers.' },
    { id: 'interest-receivable', name: 'Interest Receivable', type: 'asset', description: 'Interest earned on loans, not yet collected.' },
    { id: 'deposits-checking', name: 'Customer Deposits – Checking', type: 'liability', description: 'What the bank owes checking customers.' },
    { id: 'deposits-savings', name: 'Customer Deposits – Savings', type: 'liability', description: 'What the bank owes savings customers.' },
    { id: 'deposits-business', name: 'Business Deposits', type: 'liability', description: 'What the bank owes business customers (e.g. Coffee Co.).' },
    { id: 'deposits-fbo', name: 'Deposits – FBO Accounts', type: 'liability', description: 'Funds held in For-Benefit-Of accounts for fintechs’ customers.' },
    { id: 'accrued-interest-payable', name: 'Accrued Interest Payable', type: 'liability', description: 'Interest owed to depositors, accrued but not yet posted.' },
    { id: 'paid-in-capital', name: 'Paid-in Capital', type: 'equity', equityGroup: 'paid-in' },
    { id: 'retained-earnings', name: 'Retained Earnings', type: 'equity', equityGroup: 'retained' },
    { id: 'interest-income', name: 'Interest Income', type: 'revenue' },
    { id: 'fee-income', name: 'Fee Income', type: 'revenue' },
    { id: 'interest-expense', name: 'Interest Expense', type: 'expense' },
  ],
};
export default bank;
