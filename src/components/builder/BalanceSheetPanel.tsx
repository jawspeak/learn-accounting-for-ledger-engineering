import { useId } from 'react';
import type { AccountId, AccountType, BalanceSheet, Money } from '@contracts';
import { engine } from '@engine';
import { AmountInput } from './AmountInput';
import { formatDollars } from './model';

export interface BalanceSheetPanelProps {
  title: string;
  bs: BalanceSheet;
  /** Accounts to list, in display order. Lines for other accounts in `bs` are appended. */
  accountIds: AccountId[];
  typeOf(id: AccountId): AccountType | undefined;
  nameOf(id: AccountId): string;
  /** When given, every listed account gets an editable whole-dollar input. */
  onChange?(bs: BalanceSheet): void;
  highlighted?: Set<AccountId>;
  /** Mark lines that differ from this balance sheet (the opening) and show the change. */
  compareTo?: BalanceSheet;
}

type Section = 'assets' | 'liabilities' | 'equity';
const SECTION: Record<AccountType, Section> = {
  asset: 'assets',
  'contra-asset': 'assets',
  liability: 'liabilities',
  'contra-liability': 'liabilities',
  equity: 'equity',
  'contra-equity': 'equity',
  revenue: 'equity',
  'contra-revenue': 'equity',
  expense: 'equity',
  dividend: 'equity',
};
/** Types that reduce their section's total. */
const REDUCES = new Set<AccountType>(['contra-asset', 'contra-liability', 'contra-equity', 'contra-revenue', 'expense', 'dividend']);
const SECTION_LABEL: Record<Section, string> = { assets: 'Assets', liabilities: 'Liabilities', equity: 'Equity' };

/** Grouped balance sheet with totals and a live A = L + E indicator (text + icon, never color only). */
export function BalanceSheetPanel({ title, bs, accountIds, typeOf, nameOf, onChange, highlighted, compareTo }: BalanceSheetPanelProps) {
  const amountOf = new Map(bs.lines.map((l) => [l.accountId, l.amount]));
  const beforeOf = compareTo ? new Map(compareTo.lines.map((l) => [l.accountId, l.amount])) : null;
  /** Change vs. the opening; only for lines that have a value (a blank learner input is "unanswered", not 0). */
  const deltaOf = (id: AccountId): Money => {
    if (!beforeOf || (onChange && !amountOf.has(id))) return 0;
    return (amountOf.get(id) ?? 0) - (beforeOf.get(id) ?? 0);
  };
  const ids = [...accountIds, ...bs.lines.map((l) => l.accountId).filter((id) => !accountIds.includes(id))];
  const eq = engine.checkEquation(bs, typeOf);
  const totals: Record<Section, Money> = { assets: eq.assets, liabilities: eq.liabilities, equity: eq.equity };

  const setLine = (id: AccountId, cents: Money, blank: boolean) => {
    // A blank field removes the line (unanswered); an explicit 0 is kept. Display order is preserved.
    const lines = ids
      .filter((a) => (a === id ? !blank : amountOf.has(a)))
      .map((accountId) => ({ accountId, amount: accountId === id ? cents : amountOf.get(accountId)! }));
    onChange?.({ lines });
  };

  const sections: Section[] = ['assets', 'liabilities', 'equity'];
  const titleId = useId();
  return (
    <section className={`tab-bs${onChange ? ' is-editable' : ''}`} aria-labelledby={titleId}>
      <h3 id={titleId}>{title}</h3>
      {onChange && <p className="tab-bs-note">Fill in each account’s balance after the transactions.</p>}
      {sections.map((s) => {
        const lineIds = ids.filter((id) => {
          const t = typeOf(id);
          return t && SECTION[t] === s;
        });
        return (
          <div key={s} className="tab-bs-section">
            <h4>{SECTION_LABEL[s]}</h4>
            {lineIds.length === 0 ? (
              <p className="tab-bs-empty">—</p>
            ) : (
              <ul>
                {lineIds.map((id) => {
                  const t = typeOf(id)!;
                  const amt = amountOf.get(id) ?? 0;
                  const hl = highlighted?.has(id);
                  const delta = deltaOf(id);
                  const cls = [hl && 'tab-hl', delta !== 0 && 'is-changed'].filter(Boolean).join(' ') || undefined;
                  return (
                    <li key={id} className={cls} data-account={id}>
                      <span className="tab-bs-name">
                        {nameOf(id)}
                        {REDUCES.has(t) && <span className="tab-bs-less"> (less)</span>}
                        {delta !== 0 && (
                          <span className={`tab-bs-delta ${delta > 0 ? 'is-up' : 'is-down'}`}>
                            <span aria-hidden="true">{delta > 0 ? ' ▲ ' : ' ▼ '}</span>
                            <span className="sr-only">{delta > 0 ? ' up ' : ' down '}</span>
                            {formatDollars(Math.abs(delta))}
                          </span>
                        )}
                      </span>
                      {onChange ? (
                        <AmountInput
                          className="tab-bs-input"
                          aria-label={`${title}: ${nameOf(id)}`}
                          cents={amt}
                          allowNegative
                          showZero={amountOf.has(id)}
                          onCentsChange={(c, blank) => setLine(id, c, blank)}
                        />
                      ) : (
                        <span className="tab-bs-amt">{REDUCES.has(t) && amt !== 0 ? `(${formatDollars(amt)})` : formatDollars(amt)}</span>
                      )}
                      {hl && <span className="sr-only"> (flagged)</span>}
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="tab-bs-total">
              <span>Total {SECTION_LABEL[s].toLowerCase()}</span>
              <span>{formatDollars(totals[s])}</span>
            </p>
          </div>
        );
      })}
      <p className={`tab-eq ${eq.balanced ? 'is-ok' : 'is-bad'}`} data-testid="equation">
        <span aria-hidden="true">{eq.balanced ? '✓' : '✗'}</span>{' '}
        {eq.balanced ? 'A = L + E' : 'A ≠ L + E'}
        <span className="tab-eq-detail">
          {' '}
          {formatDollars(eq.assets)} {eq.balanced ? '=' : '≠'} {formatDollars(eq.liabilities)} + {formatDollars(eq.equity)}
        </span>
        <span className="sr-only">{eq.balanced ? ' (balanced)' : ' (not balanced)'}</span>
      </p>
    </section>
  );
}
