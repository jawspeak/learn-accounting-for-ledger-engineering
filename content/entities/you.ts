import type { EntityCoA } from '@contracts';

/**
 * "You" — a person, cash basis. Owned by C1.
 * Order: assets (liquidity order) → liabilities → equity → revenue (income) → expenses.
 */
const you: EntityCoA = {
  id: 'you',
  name: 'You',
  kind: 'person',
  basis: 'cash',
  accounts: [
    // Assets — what you own, most liquid first.
    { id: 'cash', name: 'Cash', type: 'asset', description: 'Physical cash in your wallet.' },
    { id: 'checking', name: 'Checking Account', type: 'asset', description: 'Your checking account at First Example Bank — the bank owes you this money.' },
    { id: 'savings', name: 'Savings Account', type: 'asset', description: 'Your savings account at First Example Bank.' },
    { id: 'loan-to-friend', name: 'Loan to a Friend', type: 'asset', description: 'Money you lent to a friend and expect to get back (a receivable).' },
    { id: 'car', name: 'Car', type: 'asset', description: 'Your car, recorded at what you paid for it.' },
    // Liabilities — what you owe.
    { id: 'credit-card-payable', name: 'Credit Card Payable', type: 'liability', description: 'What you owe on your credit card.' },
    { id: 'car-loan-payable', name: 'Car Loan Payable', type: 'liability', description: 'Principal still owed on your car loan.' },
    { id: 'loan-payable', name: 'Loan Payable', type: 'liability', description: 'Principal still owed on your personal loan from First Example Bank.' },
    // Equity.
    { id: 'net-worth', name: 'Net Worth', type: 'equity', equityGroup: 'retained', description: "A person's equity: everything you own minus everything you owe." },
    // Revenue (income) — increases net worth.
    { id: 'salary-income', name: 'Salary Income', type: 'revenue', description: 'Pay from your job.' },
    { id: 'interest-income', name: 'Interest Income', type: 'revenue', description: 'Interest the bank pays you on your savings.' },
    { id: 'gift-income', name: 'Gifts Received', type: 'revenue', description: 'Money given to you that you never have to pay back.' },
    // Expenses — decrease net worth.
    { id: 'rent-expense', name: 'Rent Expense', type: 'expense', description: 'Rent for your apartment.' },
    { id: 'groceries-expense', name: 'Groceries Expense', type: 'expense' },
    { id: 'dining-expense', name: 'Dining Out Expense', type: 'expense' },
    { id: 'utilities-expense', name: 'Utilities Expense', type: 'expense', description: 'Electricity, water, internet.' },
    { id: 'transportation-expense', name: 'Transportation Expense', type: 'expense', description: 'Gas, transit fares, parking.' },
    { id: 'interest-expense', name: 'Interest Expense', type: 'expense', description: 'Interest you pay on loans and credit cards.' },
    { id: 'bank-fees-expense', name: 'Bank Fees Expense', type: 'expense', description: 'Fees your bank charges you.' },
  ],
};
export default you;
