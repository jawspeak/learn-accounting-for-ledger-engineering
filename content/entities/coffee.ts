import type { EntityCoA } from '@contracts';

/**
 * Bean There Coffee Co. — a small café, accrual basis. Owned by C2.
 * Organized as a small corporation with one owner (Maya): owner investment → Paid-in Capital,
 * owner withdrawals → Dividends (Owner Draws). Inventory uses a month-end count (periodic):
 * purchases go to Inventory, and beans/supplies used are moved to COGS at month-end.
 * "Cash" covers the till and Bean There's checking account at First Example Bank.
 */
const coffee: EntityCoA = {
  id: 'coffee',
  name: 'Bean There Coffee Co.',
  kind: 'company',
  basis: 'accrual',
  accounts: [
    // Assets, most liquid first (contra-assets right after the asset they reduce)
    { id: 'cash', name: 'Cash', type: 'asset', description: 'Cash in the till plus the checking account at First Example Bank.' },
    {
      id: 'card-receivable',
      name: 'Card Receivables (Cash in Transit)',
      type: 'asset',
      description: 'Card sales the payment processor owes us but has not yet deposited (settles in 1–2 days).',
    },
    {
      id: 'savings',
      name: 'Savings Account – First Example Bank',
      type: 'asset',
      description: 'Interest-bearing savings account at First Example Bank.',
    },
    { id: 'accounts-receivable', name: 'Accounts Receivable', type: 'asset', description: 'Invoiced catering customers who have not paid yet.' },
    {
      id: 'allowance-doubtful',
      name: 'Allowance for Doubtful Accounts',
      type: 'contra-asset',
      contraOf: 'accounts-receivable',
      description: 'Estimate of receivables we expect never to collect. Reduces Accounts Receivable on the balance sheet.',
    },
    { id: 'interest-receivable', name: 'Interest Receivable', type: 'asset', description: 'Interest earned on savings but not yet paid into the account.' },
    { id: 'inventory', name: 'Inventory – Beans & Supplies', type: 'asset', description: 'Coffee beans, milk, cups and lids on hand.' },
    { id: 'prepaid-rent', name: 'Prepaid Rent', type: 'asset', description: 'Rent paid in advance for months not yet used.' },
    { id: 'equipment', name: 'Equipment', type: 'asset', description: 'Espresso machine, grinders and other equipment, at original cost.' },
    {
      id: 'accum-depreciation',
      name: 'Accumulated Depreciation – Equipment',
      type: 'contra-asset',
      contraOf: 'equipment',
      description: 'Total depreciation recorded so far on equipment. Reduces Equipment on the balance sheet.',
    },
    // Liabilities
    { id: 'accounts-payable', name: 'Accounts Payable', type: 'liability', description: 'Bills from suppliers we have not paid yet.' },
    { id: 'wages-payable', name: 'Wages Payable', type: 'liability', description: 'Wages employees have earned but have not been paid yet.' },
    {
      id: 'unearned-gift-cards',
      name: 'Unearned Revenue – Gift Cards',
      type: 'liability',
      description: 'Cash received for gift cards not yet redeemed — we owe the coffee.',
    },
    // Equity
    { id: 'paid-in-capital', name: 'Paid-in Capital', type: 'equity', equityGroup: 'paid-in', description: 'What the owner has invested in the company.' },
    { id: 'retained-earnings', name: 'Retained Earnings', type: 'equity', equityGroup: 'retained', description: 'Cumulative profits kept in the business.' },
    {
      id: 'dividends',
      name: 'Dividends (Owner Draws)',
      type: 'dividend',
      description: 'Profits paid out to the owner. Not an expense.',
    },
    // Revenue
    { id: 'sales-revenue', name: 'Sales Revenue', type: 'revenue', description: 'Coffee, pastries, beans and catering sold.' },
    {
      id: 'sales-returns',
      name: 'Sales Returns & Allowances',
      type: 'contra-revenue',
      contraOf: 'sales-revenue',
      description: 'Refunds and price reductions given to customers. Reduces Sales Revenue on the income statement.',
    },
    { id: 'interest-income', name: 'Interest Income', type: 'revenue', description: 'Interest earned on the savings account.' },
    // Expenses
    { id: 'cogs', name: 'Cost of Goods Sold', type: 'expense', description: 'Beans and supplies used up making what we sold.' },
    { id: 'rent-expense', name: 'Rent Expense', type: 'expense' },
    { id: 'wages-expense', name: 'Wages Expense', type: 'expense' },
    { id: 'utilities-expense', name: 'Utilities Expense', type: 'expense' },
    { id: 'depreciation-expense', name: 'Depreciation Expense', type: 'expense' },
    { id: 'bad-debt-expense', name: 'Bad Debt Expense', type: 'expense' },
    { id: 'card-fees', name: 'Card Processing Fees', type: 'expense', description: 'Fees the card processor keeps from each card sale.' },
  ],
};
export default coffee;
