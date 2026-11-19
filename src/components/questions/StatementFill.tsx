import { Fragment, type ReactNode } from 'react';
import type {
  AccountId,
  AccountType,
  BalanceLine,
  EntityCoA,
  Side,
  StatementFillProblem,
  TrialBalanceLine,
} from '@contracts';
import { engine } from '@engine';
import { formatDollars } from '../builder/model';
import { itemClass, Mark, type QuestionInputProps } from './types';
import { JournalTable } from './JournalTable';
import { MoneyInput } from './MoneyInput';

const TITLES = {
  'balance-sheet': 'Balance sheet after these transactions',
  'trial-balance': 'Trial balance after these transactions',
  'income-statement': 'Income statement for these transactions',
} as const;

type Section = 'assets' | 'liabilities' | 'equity' | 'revenue' | 'expenses';
const SECTION_LABEL: Record<Section, string> = {
  assets: 'Assets',
  liabilities: 'Liabilities',
  equity: 'Equity',
  revenue: 'Revenue',
  expenses: 'Expenses',
};
/** Balance sheet: income-statement accounts sit inside equity until closing. */
const BS_SECTION: Record<AccountType, Section> = {
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
const IS_SECTION = (t: AccountType): Section => (t === 'expense' ? 'expenses' : 'revenue');
/** Lines that reduce their section's total (entered as positive amounts on their normal side). */
const REDUCES = new Set<AccountType>([
  'contra-asset',
  'contra-liability',
  'contra-equity',
  'contra-revenue',
  'expense',
  'dividend',
]);

/** The entity's chart-of-accounts order (assets first, contras right after their parent, …). */
function inCoaOrder(ids: AccountId[], entity: EntityCoA | undefined): AccountId[] {
  const rank = new Map((entity?.accounts ?? []).map((a, i) => [a.id, i]));
  return [...ids].sort((a, b) => (rank.get(a) ?? 1e9) - (rank.get(b) ?? 1e9));
}

interface Line {
  id: AccountId;
  /** Amount on the account's normal side; undefined = blank (counts as 0 in totals). */
  amount: number | undefined;
  /** The editable input, or nothing for a read-only statement. */
  input?: ReactNode;
  /** Item index in the authored answer (for ✓ / ✗ marks). */
  item?: number;
}

/**
 * A statement laid out the conventional way: section headings, "less" lines for contras / expenses, a net line
 * under each contra, section totals and the check that matters (A = L + E, or net income). Totals are live sums
 * of whatever is in the lines — they never reveal an answer the learner hasn't typed.
 */
function StatementTable({
  kind,
  caption,
  lines,
  typeOf,
  nameOf,
  contraOf,
  correctItems,
  wrongItems,
}: {
  kind: 'balance-sheet' | 'income-statement';
  caption: string;
  lines: Line[];
  typeOf(id: AccountId): AccountType | undefined;
  nameOf(id: AccountId): string;
  contraOf(id: AccountId): AccountId | undefined;
  correctItems?: number[];
  wrongItems?: number[];
}) {
  const sectionOf = (id: AccountId): Section => {
    const t = typeOf(id) ?? 'asset';
    return kind === 'balance-sheet' ? BS_SECTION[t] : IS_SECTION(t);
  };
  const sections: Section[] =
    kind === 'balance-sheet' ? ['assets', 'liabilities', 'equity'] : ['revenue', 'expenses'];
  const amt = (l: Line) => l.amount ?? 0;
  /** Balance sheet: contras, expenses and dividends reduce their section. Income statement: expenses are
   *  their own (positive) section and only contra-revenue reduces revenue. */
  const reduces = (id: AccountId) => {
    const t = typeOf(id) ?? 'asset';
    return kind === 'balance-sheet' ? REDUCES.has(t) : t === 'contra-revenue';
  };
  const signed = (l: Line) => (reduces(l.id) ? -amt(l) : amt(l));
  const total = (s: Section) =>
    lines.filter((l) => sectionOf(l.id) === s).reduce((sum, l) => sum + signed(l), 0);
  const editable = lines.some((l) => l.input);

  // Balance-sheet check, from the engine (the same rule the grader uses).
  const eq = engine.checkEquation(
    { lines: lines.map((l) => ({ accountId: l.id, amount: amt(l) })) },
    typeOf,
  );
  const net = total('revenue') - total('expenses');
  const anyEntered = lines.some((l) => l.amount !== undefined);

  /** After the last contra of a parent that is listed: "Equipment, net". */
  const netLineAfter = (i: number, inSection: Line[]): ReactNode => {
    const l = inSection[i]!;
    const parent = contraOf(l.id);
    if (!parent || !typeOf(l.id)?.startsWith('contra-')) return null;
    const next = inSection[i + 1];
    if (next && contraOf(next.id) === parent) return null;
    const p = lines.find((x) => x.id === parent);
    if (!p) return null;
    const contras = lines.filter((x) => contraOf(x.id) === parent);
    const shown = p.amount !== undefined || contras.some((c) => c.amount !== undefined);
    return (
      <tr className="stmt-net">
        <td />
        <th scope="row">{nameOf(parent)}, net</th>
        <td className="stmt-num">
          {shown ? formatDollars(amt(p) - contras.reduce((s, c) => s + amt(c), 0)) : '—'}
        </td>
      </tr>
    );
  };

  return (
    <table className="stmt stmt-statement">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr>
          <th scope="col">
            <span className="sr-only">Result</span>
          </th>
          <th scope="col">Account</th>
          <th scope="col" className="stmt-num">
            Amount ($)
          </th>
        </tr>
      </thead>
      {sections.map((s) => {
        const inSection = lines.filter((l) => sectionOf(l.id) === s);
        if (inSection.length === 0) return null;
        return (
          <tbody key={s}>
            <tr className="stmt-sec">
              <th scope="rowgroup" colSpan={3}>
                {SECTION_LABEL[s]}
              </th>
            </tr>
            {inSection.map((l, i) => {
              const less = reduces(l.id);
              return (
                <Fragment key={l.id}>
                  <tr
                    className={
                      l.item === undefined ? '' : itemClass(l.item, correctItems, wrongItems)
                    }
                  >
                    <td>
                      {l.item !== undefined && (
                        <Mark i={l.item} correct={correctItems} wrong={wrongItems} />
                      )}
                    </td>
                    <th scope="row" className={less ? 'stmt-less' : undefined}>
                      {nameOf(l.id)}
                      {less && <span className="stmt-less-tag"> (less)</span>}
                    </th>
                    <td className="stmt-num">{l.input ?? formatDollars(amt(l))}</td>
                  </tr>
                  {netLineAfter(i, inSection)}
                </Fragment>
              );
            })}
            <tr className="stmt-total">
              <td />
              <th scope="row">Total {SECTION_LABEL[s].toLowerCase()}</th>
              <td className="stmt-num">{formatDollars(total(s))}</td>
            </tr>
          </tbody>
        );
      })}
      <tfoot>
        {kind === 'balance-sheet' ? (
          <>
            <tr className="stmt-total">
              <td />
              <th scope="row">Total liabilities and equity</th>
              <td className="stmt-num">{formatDollars(eq.liabilities + eq.equity)}</td>
            </tr>
            <tr className={`stmt-check ${eq.balanced ? 'is-ok' : 'is-bad'}`}>
              <td
                colSpan={3}
                role={editable ? 'status' : undefined}
                aria-live={editable ? 'polite' : undefined}
              >
                {!anyEntered ? (
                  <>Fill in the balances: the totals and the A = L + E check update as you type.</>
                ) : (
                  <>
                    <span aria-hidden="true">{eq.balanced ? '✓' : '✗'}</span> A{' '}
                    {eq.balanced ? '=' : '≠'} L + E: {formatDollars(eq.assets)}{' '}
                    {eq.balanced ? '=' : '≠'} {formatDollars(eq.liabilities)} +{' '}
                    {formatDollars(eq.equity)}
                    {editable && !eq.balanced && ' — check each line'}
                  </>
                )}
              </td>
            </tr>
          </>
        ) : (
          <tr className="stmt-total stmt-bottom-line">
            <td />
            <th scope="row">{net < 0 ? 'Net loss' : 'Net income'}</th>
            <td className="stmt-num">{formatDollars(Math.abs(net))}</td>
          </tr>
        )}
      </tfoot>
    </table>
  );
}

/**
 * One input per account line. balance-sheet / income-statement write `value.balanceSheet.lines`
 * (amount on the account's normal side, in cents); trial-balance writes `value.trialBalance`
 * (a line with side + amount). The lines are the accounts in the expected answer, shown in the entity's
 * chart-of-accounts order; an item's index (for ✓ / ✗) is still its position in the authored answer.
 */
export function StatementFill({
  problem,
  value,
  onChange,
  correctItems,
  wrongItems,
  accountName,
  entity,
}: QuestionInputProps<StatementFillProblem>) {
  const account = (id: AccountId) => entity?.accounts.find((a) => a.id === id);
  const nameOf = (id: AccountId) => accountName?.(id) ?? account(id)?.name ?? id;
  const typeOf = (id: AccountId) => account(id)?.type;
  const contraOf = (id: AccountId) => account(id)?.contraOf;

  const isTB = problem.statement === 'trial-balance';
  const answerIds = isTB
    ? (problem.answer.trialBalance ?? []).map((l) => l.accountId)
    : (problem.answer.balanceSheet?.lines ?? []).map((l) => l.accountId);
  const itemOf = new Map(answerIds.map((id, i) => [id, i]));
  const ids = inCoaOrder(answerIds, entity);

  const bsLine = (id: string) => value.balanceSheet?.lines.find((l) => l.accountId === id);
  const tbLine = (id: string) => value.trialBalance?.find((l) => l.accountId === id);

  const setBs = (id: string, cents: number | null) => {
    const others = (value.balanceSheet?.lines ?? []).filter((l) => l.accountId !== id);
    const lines: BalanceLine[] =
      cents === null ? others : [...others, { accountId: id, amount: cents }];
    onChange({ ...value, balanceSheet: { lines } });
  };
  const setTb = (id: string, side: Side, cents: number | null) => {
    const others = (value.trialBalance ?? []).filter((l) => l.accountId !== id);
    const lines: TrialBalanceLine[] =
      cents === null ? others : [...others, { accountId: id, side, amount: cents }];
    onChange({ ...value, trialBalance: lines });
  };

  const opening = problem.opening && problem.opening.lines.length > 0 ? problem.opening : null;

  return (
    <div>
      {opening && (
        <details open className="stmt-opening">
          <summary>Opening balance sheet</summary>
          <StatementTable
            kind="balance-sheet"
            caption="Opening balance sheet"
            lines={inCoaOrder(
              opening.lines.map((l) => l.accountId),
              entity,
            ).map((id) => ({ id, amount: opening.lines.find((l) => l.accountId === id)!.amount }))}
            typeOf={typeOf}
            nameOf={nameOf}
            contraOf={contraOf}
          />
        </details>
      )}
      <h3>Transactions</h3>
      <JournalTable rows={problem.rows} nameOf={nameOf} />
      <h3>{TITLES[problem.statement]}</h3>
      <div className="table-scroll">
        {isTB ? (
          <TrialBalanceTable
            ids={ids}
            itemOf={itemOf}
            nameOf={nameOf}
            tbLine={tbLine}
            setTb={setTb}
            correctItems={correctItems}
            wrongItems={wrongItems}
          />
        ) : (
          <StatementTable
            kind={problem.statement === 'income-statement' ? 'income-statement' : 'balance-sheet'}
            caption={TITLES[problem.statement]}
            lines={ids.map((id) => ({
              id,
              amount: bsLine(id)?.amount,
              item: itemOf.get(id),
              input: (
                <MoneyInput
                  label={`${nameOf(id)} amount`}
                  cents={bsLine(id)?.amount}
                  onCents={(c) => setBs(id, c)}
                />
              ),
            }))}
            typeOf={typeOf}
            nameOf={nameOf}
            contraOf={contraOf}
            correctItems={correctItems}
            wrongItems={wrongItems}
          />
        )}
      </div>
    </div>
  );
}

/** Trial balance: every account in CoA order, debit or credit, with a live Σ Dr = Σ Cr row. */
function TrialBalanceTable({
  ids,
  itemOf,
  nameOf,
  tbLine,
  setTb,
  correctItems,
  wrongItems,
}: {
  ids: AccountId[];
  itemOf: Map<AccountId, number>;
  nameOf(id: AccountId): string;
  tbLine(id: AccountId): TrialBalanceLine | undefined;
  setTb(id: AccountId, side: Side, cents: number | null): void;
  correctItems?: number[];
  wrongItems?: number[];
}) {
  const sum = (s: Side) =>
    ids.reduce((t, id) => t + (tbLine(id)?.side === s ? tbLine(id)!.amount : 0), 0);
  const dr = sum('dr');
  const cr = sum('cr');
  const anyEntered = ids.some((id) => tbLine(id));
  return (
    <table className="stmt stmt-statement">
      <thead>
        <tr>
          <th scope="col">
            <span className="sr-only">Result</span>
          </th>
          <th scope="col">Account</th>
          <th scope="col" className="stmt-num">
            Debit ($)
          </th>
          <th scope="col" className="stmt-num">
            Credit ($)
          </th>
        </tr>
      </thead>
      <tbody>
        {ids.map((id) => {
          const i = itemOf.get(id)!;
          const tb = tbLine(id);
          return (
            <tr key={id} className={itemClass(i, correctItems, wrongItems)}>
              <td>
                <Mark i={i} correct={correctItems} wrong={wrongItems} />
              </td>
              <th scope="row">{nameOf(id)}</th>
              {(['dr', 'cr'] as Side[]).map((s) => (
                <td key={s} className="stmt-num">
                  <MoneyInput
                    label={`${nameOf(id)} ${s === 'dr' ? 'debit' : 'credit'}`}
                    cents={tb && tb.side === s ? tb.amount : undefined}
                    onCents={(c) => setTb(id, s, c)}
                  />
                </td>
              ))}
            </tr>
          );
        })}
      </tbody>
      <tfoot>
        <tr className="stmt-total">
          <td />
          <th scope="row">Totals</th>
          <td className="stmt-num">{formatDollars(dr)}</td>
          <td className="stmt-num">{formatDollars(cr)}</td>
        </tr>
        <tr className={`stmt-check ${dr === cr ? 'is-ok' : 'is-bad'}`}>
          <td colSpan={4} role="status" aria-live="polite">
            {!anyEntered ? (
              <>Fill in each balance on its side: the totals update as you type.</>
            ) : (
              <>
                <span aria-hidden="true">{dr === cr ? '✓' : '✗'}</span> Total debits{' '}
                {dr === cr ? '=' : '≠'} total credits: {formatDollars(dr)} {dr === cr ? '=' : '≠'}{' '}
                {formatDollars(cr)}
              </>
            )}
          </td>
        </tr>
      </tfoot>
    </table>
  );
}
