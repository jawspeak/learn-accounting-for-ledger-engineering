/**
 * Runtime validation for content and URL state (zod). FROZEN CONTRACT — mirrors the TS types.
 * Content tests validate every entity and problem against these.
 */
import { z } from 'zod';

export const accountTypeSchema = z.enum([
  'asset',
  'contra-asset',
  'liability',
  'contra-liability',
  'equity',
  'contra-equity',
  'revenue',
  'contra-revenue',
  'expense',
  'dividend',
]);
export const sideSchema = z.enum(['dr', 'cr']);
const id = z.string().regex(/^[a-z0-9][a-z0-9-]*$/, 'kebab-case id');
const money = z.number().int();
const md = z.string();

export const accountSchema = z
  .object({
    id,
    name: z.string().min(1),
    type: accountTypeSchema,
    contraOf: id.optional(),
    equityGroup: z.enum(['paid-in', 'retained']).optional(),
    description: z.string().optional(),
    subtitle: z.string().optional(),
    number: z.string().optional(),
    tags: z.array(z.string()).optional(),
  })
  .refine((a) => !a.type.startsWith('contra-') || !!a.contraOf, 'contra accounts need contraOf');

export const entitySchema = z.object({
  id,
  name: z.string().min(1),
  kind: z.enum(['person', 'bank', 'company', 'fintech']),
  basis: z.enum(['cash', 'accrual']),
  accounts: z.array(accountSchema).min(1),
});

export const postingSchema = z.object({
  accountId: id,
  side: sideSchema,
  amount: money.positive(),
  chosenType: accountTypeSchema.optional(),
});
export const rowSchema = z.object({
  id: z.string().min(1),
  label: z.string().optional(),
  postings: z.array(postingSchema),
});
export const balanceSheetSchema = z.object({
  lines: z.array(z.object({ accountId: id, amount: money })),
});
export const trialBalanceLineSchema = z.object({ accountId: id, side: sideSchema, amount: money });

const diagnosticCode = z.enum([
  'UNBALANCED_ROW',
  'WRONG_TYPE',
  'WRONG_SIDE',
  'WRONG_AMOUNT',
  'MISSING_ACCOUNT',
  'EXTRA_ACCOUNT',
  'COUNTERPARTY_ACCOUNT',
  'TRAP_ACCOUNT',
  'SPLIT_ENTRY',
  'WRONG_ROW',
  'BS_MISMATCH',
  'EQUATION_BROKEN',
  'WRONG_ITEM',
]);

const sectionId = z.enum([
  '00-start',
  '01-equation',
  '02-debits-credits',
  '03-t-accounts',
  '04-perspectives',
  '05-journal-entries',
  '06-loans',
  '07-revenue-expenses',
  '08-accruals',
  '09-contra',
  '10-processes',
  '11-fintech',
  '12-capstone',
  'review',
]);

const base = {
  id: z.string().regex(/^(\d\d|rv)-[a-z0-9-]+$/, 'problem id: <NN>-<slug> or rv-<slug>'),
  sectionId,
  title: z.string().min(1),
  role: z.enum(['worked', 'faded', 'practice', 'review']),
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  prompt: md.min(1),
  hints: z.array(md),
  explanation: md.min(1),
  walkthrough: z.array(md).optional(),
  diagnosticExplanations: z.partialRecord(diagnosticCode, md).optional(),
  perspectivePairId: z.string().optional(),
  tags: z.array(z.string()).optional(),
};

export const trapAccountSchema = z.object({
  id,
  name: z.string().min(1),
  type: accountTypeSchema,
  contraOf: id.optional(),
  equityGroup: z.enum(['paid-in', 'retained']).optional(),
  description: z.string().optional(),
  trap: z.object({
    kind: z.enum(['counterparty', 'near-synonym', 'wrong-scope', 'other']),
    explanation: md.min(1),
  }),
});

export const problemSchema = z.discriminatedUnion('kind', [
  z.object({
    ...base,
    kind: z.literal('booking'),
    entityId: id,
    opening: balanceSheetSchema.optional(),
    showBalanceSheets: z.boolean(),
    askAfterBalanceSheet: z.boolean().optional(),
    journalView: z.boolean().optional(),
    trapAccounts: z.array(trapAccountSchema).optional(),
    accountChoiceIds: z.array(id).optional(),
    prefill: z.object({ rows: z.array(rowSchema), locked: z.boolean() }).optional(),
    reference: z.object({ entityId: id, rows: z.array(rowSchema), caption: md }).optional(),
    solution: z.array(rowSchema).min(1),
  }),
  z.object({
    ...base,
    kind: z.literal('classify'),
    buckets: z.array(accountTypeSchema).min(2),
    items: z
      .array(
        z.object({
          label: z.string(),
          entityId: id.optional(),
          answer: accountTypeSchema,
          explanation: md,
        }),
      )
      .min(1),
  }),
  z.object({
    ...base,
    kind: z.literal('dr-cr-predict'),
    items: z
      .array(
        z.object({
          accountName: z.string(),
          accountType: accountTypeSchema,
          change: z.enum(['increase', 'decrease']),
          answer: sideSchema,
          explanation: md,
        }),
      )
      .min(1),
  }),
  z.object({
    ...base,
    kind: z.literal('equation-fill'),
    hideGiven: z.boolean().optional(),
    items: z
      .array(
        z.object({
          assets: z.number().nullable(),
          liabilities: z.number().nullable(),
          equity: z.number().nullable(),
          story: md.optional(),
          explanation: md,
        }),
      )
      .min(1),
  }),
  z.object({
    ...base,
    kind: z.literal('statement-fill'),
    entityId: id,
    statement: z.enum(['balance-sheet', 'trial-balance', 'income-statement']),
    opening: balanceSheetSchema.optional(),
    rows: z.array(rowSchema),
    answer: z.object({
      balanceSheet: balanceSheetSchema.optional(),
      trialBalance: z.array(trialBalanceLineSchema).optional(),
    }),
  }),
  z.object({
    ...base,
    kind: z.literal('multiple-choice'),
    multi: z.boolean(),
    options: z.array(z.object({ text: md, correct: z.boolean(), explanation: md })).min(2),
  }),
  z.object({
    ...base,
    kind: z.literal('coa-design'),
    candidates: z
      .array(
        z.object({
          name: z.string(),
          answerType: accountTypeSchema,
          required: z.boolean(),
          explanation: md,
        }),
      )
      .min(2),
  }),
]);

export const sectionSchema = z.object({
  id: sectionId,
  number: z.number().int(),
  title: z.string().min(1),
  summary: z.string().min(1),
  primer: md,
  lens: md.optional(),
  callouts: z.array(z.object({ title: z.string(), body: md })).optional(),
  problemIds: z.array(z.string()),
});

export const sandboxStateSchema = z.object({
  v: z.literal(3),
  title: z.string().optional(),
  showCodes: z.boolean().optional(),
  entities: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      code: z.string().optional(),
      accounts: z.array(accountSchema),
      showBalanceSheets: z.boolean(),
      columnOrder: z.array(z.string()).optional(),
      sortByNumber: z.boolean().optional(),
    }),
  ),
  scenarios: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        text: z.string(),
        events: z.array(
          z.object({
            id: z.string().min(1),
            label: z.string().optional(),
            lines: z.record(z.string(), z.array(postingSchema)),
            none: z.array(z.string()).optional(),
          }),
        ),
        opening: z.record(z.string(), balanceSheetSchema),
      }),
    )
    .min(1),
});

export const attemptStateSchema = z.object({
  v: z.literal(1),
  problemId: z.string(),
  rows: z.array(rowSchema).optional(),
  balanceSheet: balanceSheetSchema.optional(),
  trialBalance: z.array(trialBalanceLineSchema).optional(),
  items: z.array(z.unknown()).optional(),
});
