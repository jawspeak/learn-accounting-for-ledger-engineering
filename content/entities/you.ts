import type { EntityCoA } from '@contracts';

/** "You" — a person, cash basis. Owned by C1. Phase-0 starter CoA; C1 extends. */
const you: EntityCoA = {
  id: 'you',
  name: 'You',
  kind: 'person',
  basis: 'cash',
  accounts: [
    { id: 'cash', name: 'Cash', type: 'asset', description: 'Physical cash in your wallet.' },
    { id: 'checking', name: 'Checking Account', type: 'asset', description: 'Your checking account at the bank.' },
    { id: 'savings', name: 'Savings Account', type: 'asset', description: 'Your savings account at the bank.' },
    { id: 'net-worth', name: 'Net Worth', type: 'equity', equityGroup: 'retained', description: "A person's equity." },
  ],
};
export default you;
