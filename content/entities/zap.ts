import type { EntityCoA } from '@contracts';

/**
 * Zap — a P2P payments fintech, accrual basis. Owned by C2.
 * Customer funds are held in an FBO account at First Example Bank and shown on Zap's balance sheet
 * (gross-up model): Cash – FBO (restricted asset) and an equal liability to customers.
 * Customer wallets are shown as one liability account per customer so P2P transfers are visible;
 * in production these would be sub-ledger accounts rolling up to one GL control account
 * "Customer Balances Payable".
 */
const zap: EntityCoA = {
  id: 'zap',
  name: 'Zap',
  kind: 'fintech',
  basis: 'accrual',
  accounts: [
    // Assets
    {
      id: 'cash-operating',
      name: 'Cash – Operating',
      type: 'asset',
      description: "Zap's own money, in its operating account at First Example Bank.",
    },
    {
      id: 'cash-fbo',
      name: 'Cash – FBO (Restricted)',
      type: 'asset',
      description: "Customers' money held in the FBO account at First Example Bank. Zap controls it but may not spend it.",
    },
    {
      id: 'cash-in-transit',
      name: 'Cash in Transit – Incoming ACH',
      type: 'asset',
      description: 'Incoming ACH transfers that have been initiated but have not yet landed in the FBO account.',
    },
    {
      id: 'settlement-receivable',
      name: 'Settlement Receivable',
      type: 'asset',
      description: 'Debit-card top-ups the card processor owes us; settles into the FBO account in 1–2 days.',
    },
    { id: 'interest-receivable', name: 'Interest Receivable', type: 'asset', description: 'Interest earned on the operating account, not yet paid.' },
    { id: 'prepaid-expenses', name: 'Prepaid Expenses', type: 'asset', description: 'Software subscriptions and insurance paid in advance.' },
    // Liabilities
    {
      id: 'cbp-alice',
      name: 'Customer Balances Payable – Alice',
      type: 'liability',
      description: "What Zap owes Alice: her wallet balance. (Sub-ledger account under the Customer Balances Payable control account.)",
    },
    { id: 'cbp-bob', name: 'Customer Balances Payable – Bob', type: 'liability', description: "What Zap owes Bob: his wallet balance." },
    { id: 'cbp-carol', name: 'Customer Balances Payable – Carol', type: 'liability', description: "What Zap owes Carol: her wallet balance." },
    {
      id: 'ach-cashout-clearing',
      name: 'Clearing – Pending ACH Cash-outs',
      type: 'liability',
      description: 'Cash-outs a customer has requested and Zap has deducted from their wallet, but the ACH has not settled out of the FBO account yet.',
    },
    {
      id: 'suspense',
      name: 'Suspense',
      type: 'liability',
      description: 'Money received that cannot yet be matched to a customer. Should be cleared to zero quickly.',
    },
    { id: 'accounts-payable', name: 'Accounts Payable', type: 'liability', description: 'Vendor invoices received, not yet paid.' },
    {
      id: 'accrued-expenses',
      name: 'Accrued Expenses',
      type: 'liability',
      description: 'Costs incurred this period that have not been invoiced yet.',
    },
    // Equity
    { id: 'paid-in-capital', name: 'Paid-in Capital', type: 'equity', equityGroup: 'paid-in', description: 'Money invested by Zap’s shareholders.' },
    { id: 'retained-earnings', name: 'Retained Earnings', type: 'equity', equityGroup: 'retained' },
    // Revenue
    { id: 'transaction-fee-revenue', name: 'Transaction Fee Revenue', type: 'revenue', description: 'Fees Zap charges customers (e.g. instant transfers).' },
    { id: 'interchange-revenue', name: 'Interchange Revenue', type: 'revenue', description: 'Share of card fees earned when customers spend with a Zap card.' },
    { id: 'interest-income', name: 'Interest Income', type: 'revenue', description: 'Interest earned on the operating account.' },
    // Expenses
    { id: 'processing-expense', name: 'Processing Expense', type: 'expense', description: 'ACH and card-processing costs charged by processors and the bank.' },
    { id: 'salaries-expense', name: 'Salaries Expense', type: 'expense' },
    { id: 'hosting-expense', name: 'Cloud Hosting Expense', type: 'expense' },
    { id: 'fraud-losses', name: 'Fraud & Chargeback Losses', type: 'expense' },
  ],
};
export default zap;
