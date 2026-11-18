import type { DrCrPredictAnswer, DrCrPredictProblem, Side } from '@contracts';
import { itemsOf, TYPE_LABEL, Verdict, type QuestionInputProps } from './types';

const SIDE_WORD: Record<Side, string> = { dr: 'Debit', cr: 'Credit' };

/**
 * One Dr/Cr choice per row, each graded the moment it's picked (no Check button): ✓/✗ and the reason under
 * the row. With only two choices a wrong pick already implies the right one, so the verdict names it.
 */
export function DrCrPredict({ problem, value, onChange }: QuestionInputProps<DrCrPredictProblem>) {
  const answers = itemsOf<Side | null>(value, problem.items.length, null) as DrCrPredictAnswer;
  const set = (i: number, side: Side) => {
    const next = answers.slice();
    next[i] = side;
    onChange({ ...value, items: next });
  };
  return (
    <ol className="q-items">
      {problem.items.map((it, i) => {
        const a = answers[i];
        const ok = a === it.answer;
        return (
          <li key={i} className={`q-item ${a ? (ok ? 'is-correct' : 'is-wrong') : ''}`}>
            <span className={`q-mark ${a ? (ok ? 'ok' : 'err') : ''}`}>
              <span aria-hidden="true">{a ? (ok ? '✓' : '✗') : ''}</span>
              {a && <span className="sr-only">{ok ? 'Correct' : 'Incorrect'}</span>}
            </span>
            <div className="mc-body">
              <div className="drcr-row">
                <span className="q-label">
                  To <strong>{it.change}</strong> <strong>{it.accountName}</strong> (
                  {TYPE_LABEL[it.accountType]}), you…
                </span>
                <fieldset className="choice-group" aria-label={`${it.change} ${it.accountName}`}>
                  {(['dr', 'cr'] as Side[]).map((s) => (
                    <label key={s} className="choice">
                      <input
                        type="radio"
                        name={`${problem.id}-${i}`}
                        checked={a === s}
                        onChange={() => set(i, s)}
                      />
                      {SIDE_WORD[s]}
                    </label>
                  ))}
                </fieldset>
              </div>
              {a && (
                <Verdict
                  ok={ok}
                  lead={
                    ok
                      ? `Right — ${SIDE_WORD[it.answer].toLowerCase()}.`
                      : `Not quite — it’s a ${SIDE_WORD[it.answer].toLowerCase()}.`
                  }
                  why={it.explanation}
                />
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
