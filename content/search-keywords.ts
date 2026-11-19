/**
 * Search keywords for each section's "Ledger engineer's lens". Search only indexes titles, and every lens shares
 * one heading, so each lens gets a short topic (shown as the result title) and the engineering terms a reader
 * would type to find it. Keep keywords specific to *this* lens — generic words ("balance", "account") make every
 * lens match. A test checks that every section with a lens has an entry here, and every key is a real section.
 */
import type { SectionId } from '@contracts';

export interface LensKeywords {
  topic: string;
  keywords: string[];
}

export const lensKeywords: Partial<Record<SectionId, LensKeywords>> = {
  '00-start': {
    topic: 'Transactions own postings',
    keywords: [
      'postings table',
      'transactions table',
      'schema',
      'balance is a sum of postings',
      'invariant',
      'commit',
    ],
  },
  '01-equation': {
    topic: 'An account is a row: type and normal side',
    keywords: [
      'accounts table',
      'schema',
      'account type',
      'enum',
      'normal side',
      'chart of accounts',
      'per entity',
    ],
  },
  '02-debits-credits': {
    topic: 'Signed amounts and sign conventions',
    keywords: [
      'signed amount',
      'sign convention',
      'side and amount',
      'negative balance',
      'credit balance',
      'flip the sign for display',
      'normal side',
    ],
  },
  '03-t-accounts': {
    topic: 'Balanced transactions as a database invariant',
    keywords: [
      'invariant',
      'deferred constraint',
      'check constraint',
      'commit',
      'cached balance',
      'source of truth',
      'integer minor units',
      'cents',
      'floats',
      'floating point',
    ],
  },
  '04-perspectives': {
    topic: 'One ledger per entity; sub-ledgers roll up to the GL',
    keywords: [
      'sub-ledger',
      'subledger',
      'control account',
      'general ledger',
      'GL',
      'core ledger',
      'reconcile',
      'reconciliation',
      'data model',
    ],
  },
  '05-journal-entries': {
    topic: 'Journal entries map to your schema',
    keywords: [
      'idempotency',
      'idempotency key',
      'idempotent',
      'atomic transaction',
      'retries',
      'double post',
      'immutable',
      'append-only',
      'reversing entry',
      'effective date',
      'never UPDATE',
    ],
  },
  '06-loans': {
    topic: 'Loan payments and the loan sub-ledger',
    keywords: [
      'loan sub-ledger',
      'lending system',
      'principal',
      'interest',
      'compound entry',
      'reconcile',
      'reconciliation',
    ],
  },
  '07-revenue-expenses': {
    topic: 'Revenue, expenses and closing',
    keywords: [
      'closing entries',
      'period end',
      'batch job',
      'income statement query',
      'retained earnings',
      'immutable',
      'in-flight money',
      'captured',
      'settled',
    ],
  },
  '08-accruals': {
    topic: 'Accruals are scheduled jobs',
    keywords: [
      'cron job',
      'scheduled job',
      'idempotent',
      'idempotency key',
      'retry',
      'capitalization',
      'reconcile',
      'reconciliation',
      'rounding policy',
      'remainder',
      'integer minor units',
    ],
  },
  '09-contra': {
    topic: 'Contra accounts vs. negative balances',
    keywords: [
      'store gross derive net',
      'gross',
      'net',
      'negative postings',
      'estimate',
      'revisions',
    ],
  },
  '10-processes': {
    topic: 'The trial balance is an invariant',
    keywords: [
      'invariant check',
      'data corruption',
      'reconciliation',
      'reconcile',
      'reversal',
      'audit trail',
      'effective date',
      'created at',
      'adjustments',
      'page someone',
    ],
  },
  '11-fintech': {
    topic: 'In-flight money, sub-ledgers and reversals',
    keywords: [
      'clearing account',
      'in-flight money',
      'settlement',
      'status flag',
      'sub-ledger',
      'control account',
      'daily reconciliation',
      'reconcile',
      'reversal',
      'correcting entry',
      'idempotency key',
      'retry',
      'suspense',
      'quarantine',
      'wallets',
    ],
  },
  '12-capstone': {
    topic: 'The chart of accounts is a schema',
    keywords: [
      'schema',
      'schema migration',
      'parent id',
      'currency',
      'restricted',
      'split an account',
      'reclassify history',
      'high cardinality',
      'wallets',
      'sub-ledger',
      'control account',
      'reconcile',
      'invariants',
    ],
  },
  review: {
    topic: 'The whole model in five lines',
    keywords: ['summary', 'append-only', 'invariants', 'sign convention', 'reverse and rebook'],
  },
};
