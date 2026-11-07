import type { AccountType, AttemptState } from '@contracts';

/** Controlled-component props shared by all non-booking question inputs. */
export interface QuestionInputProps<P> {
  problem: P;
  /** Current attempt (items / balanceSheet / trialBalance). */
  value: AttemptState;
  onChange(next: AttemptState): void;
  /** Item indices marked correct (reveal level >= 1). */
  correctItems?: number[];
  /** Item indices to highlight as wrong (reveal level >= 2). */
  wrongItems?: number[];
  /** Display names for entity accounts (statement-fill). */
  accountName?(id: string): string;
}

export const ALL_TYPES: AccountType[] = [
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
];

export function itemClass(i: number, correct?: number[], wrong?: number[]): string {
  if (wrong?.includes(i)) return 'is-wrong';
  if (correct?.includes(i)) return 'is-correct';
  return '';
}

/** Mark that never relies on colour alone. */
export function Mark({ i, correct, wrong }: { i: number; correct?: number[]; wrong?: number[] }) {
  if (wrong?.includes(i))
    return (
      <span className="q-mark err">
        <span aria-hidden="true">✗</span>
        <span className="sr-only">Incorrect</span>
      </span>
    );
  if (correct?.includes(i))
    return (
      <span className="q-mark ok">
        <span aria-hidden="true">✓</span>
        <span className="sr-only">Correct</span>
      </span>
    );
  return <span className="q-mark" aria-hidden="true" />;
}

/** Copy items array to a fixed length. */
export function itemsOf<T>(value: { items?: unknown[] }, n: number, empty: T): T[] {
  const src = (value.items ?? []) as T[];
  return Array.from({ length: n }, (_, i) => (src[i] === undefined ? empty : src[i]!));
}

export const TYPE_LABEL: Record<AccountType, string> = {
  asset: 'Asset',
  'contra-asset': 'Contra-asset',
  liability: 'Liability',
  'contra-liability': 'Contra-liability',
  equity: 'Equity',
  'contra-equity': 'Contra-equity',
  revenue: 'Revenue',
  'contra-revenue': 'Contra-revenue',
  expense: 'Expense',
  dividend: 'Dividend',
};
