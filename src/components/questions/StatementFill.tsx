import type { BalanceLine, Side, StatementFillProblem, TrialBalanceLine } from '@contracts';
import { itemClass, Mark, type QuestionInputProps } from './types';
import { JournalTable } from './JournalTable';
import { MoneyInput } from './MoneyInput';

const TITLES = {
  'balance-sheet': 'Balance sheet after these transactions',
  'trial-balance': 'Trial balance after these transactions',
  'income-statement': 'Income statement for these transactions',
} as const;

/**
 * One input per account line. balance-sheet / income-statement write `value.balanceSheet.lines`
 * (amount on the account's normal side, in cents); trial-balance writes `value.trialBalance`
 * (a line with side + amount). The account lines listed are the ones in the expected answer, in order;
 * an item's index is its position in that list.
 */
export function StatementFill({
  problem,
  value,
  onChange,
  correctItems,
  wrongItems,
  accountName = (id) => id,
}: QuestionInputProps<StatementFillProblem>) {
  const isTB = problem.statement === 'trial-balance';
  const accountIds = isTB
    ? (problem.answer.trialBalance ?? []).map((l) => l.accountId)
    : (problem.answer.balanceSheet?.lines ?? []).map((l) => l.accountId);

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

  return (
    <div>
      {problem.opening && problem.opening.lines.length > 0 && (
        <details open>
          <summary>Opening balances</summary>
          <ul>
            {problem.opening.lines.map((l) => (
              <li key={l.accountId}>
                {accountName(l.accountId)}: ${(l.amount / 100).toLocaleString('en-US')}
              </li>
            ))}
          </ul>
        </details>
      )}
      <h3>Transactions</h3>
      <JournalTable rows={problem.rows} nameOf={accountName} />
      <h3>{TITLES[problem.statement]}</h3>
      <div className="table-scroll">
        <table className="stmt">
          <thead>
            <tr>
              <th scope="col">
                <span className="sr-only">Result</span>
              </th>
              <th scope="col">Account</th>
              {isTB ? (
                <>
                  <th scope="col">Debit ($)</th>
                  <th scope="col">Credit ($)</th>
                </>
              ) : (
                <th scope="col">Amount ($)</th>
              )}
            </tr>
          </thead>
          <tbody>
            {accountIds.map((id, i) => {
              const tb = tbLine(id);
              return (
                <tr key={id} className={itemClass(i, correctItems, wrongItems)}>
                  <td>
                    <Mark i={i} correct={correctItems} wrong={wrongItems} />
                  </td>
                  <th scope="row">{accountName(id)}</th>
                  {isTB ? (
                    (['dr', 'cr'] as Side[]).map((s) => (
                      <td key={s}>
                        <MoneyInput
                          label={`${accountName(id)} ${s === 'dr' ? 'debit' : 'credit'}`}
                          cents={tb && tb.side === s ? tb.amount : undefined}
                          onCents={(c) => setTb(id, s, c)}
                        />
                      </td>
                    ))
                  ) : (
                    <td>
                      <MoneyInput
                        label={`${accountName(id)} amount`}
                        cents={bsLine(id)?.amount}
                        onCents={(c) => setBs(id, c)}
                      />
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
