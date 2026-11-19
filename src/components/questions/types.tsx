import type { AccountType, AttemptState, EntityCoA } from '@contracts';
import { Markdown } from '../../app/Markdown';
import { RichMarkdown } from '../../app/RichMarkdown';

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
  /** statement-fill: whose books — account types, CoA order and contra parents for the statement layout. */
  entity?: EntityCoA;
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

/**
 * Instant feedback for one choice (multiple choice, Dr/Cr): ✓/✗ plus the "why", right under the choice.
 * Text + icon, never colour alone; announced politely so screen-reader users hear the verdict too.
 */
export function Verdict({ ok, lead, why: raw }: { ok: boolean; lead?: string; why: string }) {
  // Authored explanations often open with their own "Yes —" / "No." / "Exactly." — the label already says it.
  const why = stripAnswerWord(raw);
  return (
    <div className={`q-verdict ${ok ? 'is-ok' : 'is-bad'}`} role="status" aria-live="polite">
      <span className="q-verdict-head">
        <span aria-hidden="true">{ok ? '✓' : '✗'}</span> {lead ?? (ok ? 'Right.' : 'Not quite.')}
      </span>{' '}
      <Markdown text={why} inline />
    </div>
  );
}

/**
 * Drop a leading stand-alone answer word ("Yes —", "No.", "Exactly —") from an authored explanation, since the
 * verdict label already says it — but only when punctuation follows, so "No money left the bank" or
 * "Right side, wrong account" keep their meaning. The rest is capitalised.
 */
export function stripAnswerWord(text: string): string {
  const out = text.replace(/^\s*(yes|no|right|correct|exactly|true|false|nope)\s*[.,!:;—–-]+\s*/i, '');
  return out === text ? text : out.charAt(0).toUpperCase() + out.slice(1);
}

/** The problem's key concept, shown once the whole question is answered correctly. */
export function KeyConcept({ text, next }: { text: string; next?: { href: string; title: string } }) {
  return (
    <aside className="q-key" aria-label="Key concept">
      <h3 className="q-key-head">
        <span aria-hidden="true">✓</span> Key concept
      </h3>
      <RichMarkdown text={text} />
      {next && (
        <a className="btn" href={next.href}>
          Next: {next.title} <span aria-hidden="true">→</span>
        </a>
      )}
    </aside>
  );
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
