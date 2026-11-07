import type { DrCrPredictAnswer, DrCrPredictProblem, Side } from '@contracts';
import { itemClass, itemsOf, Mark, TYPE_LABEL, type QuestionInputProps } from './types';

export function DrCrPredict({
  problem,
  value,
  onChange,
  correctItems,
  wrongItems,
}: QuestionInputProps<DrCrPredictProblem>) {
  const answers = itemsOf<Side | null>(value, problem.items.length, null) as DrCrPredictAnswer;
  const set = (i: number, side: Side) => {
    const next = answers.slice();
    next[i] = side;
    onChange({ ...value, items: next });
  };
  return (
    <ol className="q-items">
      {problem.items.map((it, i) => (
        <li key={i} className={`q-item ${itemClass(i, correctItems, wrongItems)}`}>
          <Mark i={i} correct={correctItems} wrong={wrongItems} />
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
                  checked={answers[i] === s}
                  onChange={() => set(i, s)}
                />
                {s === 'dr' ? 'Debit' : 'Credit'}
              </label>
            ))}
          </fieldset>
        </li>
      ))}
    </ol>
  );
}
