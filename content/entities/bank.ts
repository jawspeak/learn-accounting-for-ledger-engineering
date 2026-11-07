import type { EntityCoA } from '@contracts';

/**
 * First Example Bank — accrual basis. Owned by C1.
 * The account ids below are a CROSS-STREAM CONTRACT (C2 uses them in §8 and §11):
 * C1 may add accounts, edit names/descriptions, and reorder, but must not remove or rename these ids or change their types.
 * Order: assets (liquidity order) → liabilities → equity → revenue → expenses.
 */
const bank: EntityCoA = {
  id: 'bank',
  name: 'First Example Bank',
  kind: 'bank',
  basis: 'accrual',
  accounts: [
    // Assets
    { id: 'vault-cash', name: 'Cash – Vault', type: 'asset', description: 'Physical currency held in the vault, teller drawers and ATMs.' },
    { id: 'reserves-fed', name: 'Reserves at the Federal Reserve', type: 'asset', description: "The bank's own account at the Fed. Payments to and from other banks settle here." },
    { id: 'securities', name: 'Investment Securities', type: 'asset', description: 'Treasury bonds and other securities the bank owns.' },
    { id: 'interest-receivable', name: 'Interest Receivable', type: 'asset', description: 'Interest earned on loans, not yet collected.' },
    { id: 'loans-receivable', name: 'Loans Receivable', type: 'asset', description: 'Principal owed to the bank by borrowers.' },
    { id: 'premises', name: 'Premises & Equipment', type: 'asset', description: 'Branches, ATMs, computers.' },
    // Liabilities
    { id: 'deposits-checking', name: 'Customer Deposits – Checking', type: 'liability', description: 'What the bank owes checking customers.' },
    { id: 'deposits-savings', name: 'Customer Deposits – Savings', type: 'liability', description: 'What the bank owes savings customers.' },
    { id: 'deposits-business', name: 'Business Deposits', type: 'liability', description: 'What the bank owes business customers (e.g. Bean There Coffee Co.).' },
    { id: 'deposits-fbo', name: 'Deposits – FBO Accounts', type: 'liability', description: 'Funds held in For-Benefit-Of accounts for fintechs’ customers.' },
    { id: 'accrued-interest-payable', name: 'Accrued Interest Payable', type: 'liability', description: 'Interest owed to depositors, accrued but not yet posted.' },
    // Equity
    { id: 'paid-in-capital', name: 'Paid-in Capital', type: 'equity', equityGroup: 'paid-in', description: "Money the bank's shareholders invested." },
    { id: 'retained-earnings', name: 'Retained Earnings', type: 'equity', equityGroup: 'retained', description: 'Accumulated profits kept in the bank.' },
    // Revenue
    { id: 'interest-income', name: 'Interest Income', type: 'revenue', description: 'Interest earned on loans and securities.' },
    { id: 'fee-income', name: 'Fee Income', type: 'revenue', description: 'Account, overdraft and other service fees charged to customers.' },
    // Expenses
    { id: 'interest-expense', name: 'Interest Expense', type: 'expense', description: 'Interest the bank pays depositors.' },
    { id: 'salaries-expense', name: 'Salaries Expense', type: 'expense', description: 'Pay for bank employees.' },
    { id: 'occupancy-expense', name: 'Occupancy Expense', type: 'expense', description: 'Rent, utilities and upkeep for branches.' },
  ],
};
export default bank;
