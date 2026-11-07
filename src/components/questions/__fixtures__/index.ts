import type {
  ClassifyProblem,
  CoaDesignProblem,
  DrCrPredictProblem,
  EquationFillProblem,
  MultipleChoiceProblem,
  StatementFillProblem,
} from '@contracts';

const base = {
  sectionId: '01-equation' as const,
  role: 'practice' as const,
  difficulty: 1 as const,
  hints: ['Think about it.'],
  explanation: 'Because.',
};

export const classifyFx: ClassifyProblem = {
  ...base,
  id: 'fx-classify',
  kind: 'classify',
  title: 'Classify accounts',
  prompt: 'Sort each account into its type.',
  buckets: ['asset', 'liability', 'equity'],
  items: [
    { label: 'Cash', answer: 'asset', explanation: 'You own it.' },
    { label: 'Loan Payable', answer: 'liability', explanation: 'You owe it.' },
    { label: 'Net Worth', answer: 'equity', explanation: 'Residual.' },
  ],
};

export const drCrFx: DrCrPredictProblem = {
  ...base,
  id: 'fx-drcr',
  kind: 'dr-cr-predict',
  title: 'Dr or Cr?',
  prompt: 'Which side?',
  items: [
    {
      accountName: 'Cash',
      accountType: 'asset',
      change: 'increase',
      answer: 'dr',
      explanation: 'Assets are debit-normal.',
    },
    {
      accountName: 'Loan Payable',
      accountType: 'liability',
      change: 'increase',
      answer: 'cr',
      explanation: 'Liabilities are credit-normal.',
    },
  ],
};

export const equationFx: EquationFillProblem = {
  ...base,
  id: 'fx-eq',
  kind: 'equation-fill',
  title: 'Fill the equation',
  prompt: 'Find the missing piece.',
  items: [
    { assets: 100, liabilities: 40, equity: null, explanation: 'E = A - L = 60' },
    { assets: null, liabilities: 10, equity: 5, explanation: 'A = 15' },
  ],
};

export const statementFx: StatementFillProblem = {
  ...base,
  id: 'fx-stmt',
  kind: 'statement-fill',
  title: 'Balance sheet',
  prompt: 'Fill in the balance sheet.',
  entityId: 'you',
  statement: 'balance-sheet',
  opening: {
    lines: [
      { accountId: 'cash', amount: 10000 },
      { accountId: 'net-worth', amount: 10000 },
    ],
  },
  rows: [
    {
      id: 't1',
      label: 'Deposit cash',
      postings: [
        { accountId: 'checking', side: 'dr', amount: 10000 },
        { accountId: 'cash', side: 'cr', amount: 10000 },
      ],
    },
  ],
  answer: {
    balanceSheet: {
      lines: [
        { accountId: 'cash', amount: 0 },
        { accountId: 'checking', amount: 10000 },
        { accountId: 'net-worth', amount: 10000 },
      ],
    },
  },
};

export const trialBalanceFx: StatementFillProblem = {
  ...statementFx,
  id: 'fx-tb',
  statement: 'trial-balance',
  title: 'Trial balance',
  answer: {
    trialBalance: [
      { accountId: 'checking', side: 'dr', amount: 10000 },
      { accountId: 'net-worth', side: 'cr', amount: 10000 },
    ],
  },
};

export const mcFx: MultipleChoiceProblem = {
  ...base,
  id: 'fx-mc',
  kind: 'multiple-choice',
  title: 'Pick',
  prompt: 'Which are assets?',
  multi: false,
  options: [
    { text: 'Cash', correct: true, explanation: 'Yes.' },
    { text: 'A **loan** you owe', correct: false, explanation: 'No.' },
  ],
};

export const mcMultiFx: MultipleChoiceProblem = { ...mcFx, id: 'fx-mc-multi', multi: true };

export const coaFx: CoaDesignProblem = {
  ...base,
  id: 'fx-coa',
  kind: 'coa-design',
  title: 'Design a CoA',
  prompt: 'A lemonade stand.',
  candidates: [
    { name: 'Cash', answerType: 'asset', required: true, explanation: 'Needed.' },
    { name: 'Spaceships', answerType: 'asset', required: false, explanation: 'Irrelevant.' },
  ],
};
