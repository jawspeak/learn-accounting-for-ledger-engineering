import type { AccountType, CoaDesignAnswer, CoaDesignProblem } from '@contracts';
import { ALL_TYPES, itemClass, itemsOf, Mark, TYPE_LABEL, type QuestionInputProps } from './types';

export function CoaDesign({
  problem,
  value,
  onChange,
  correctItems,
  wrongItems,
}: QuestionInputProps<CoaDesignProblem>) {
  const answers = itemsOf<{ included: boolean; type: AccountType | null }>(
    value,
    problem.candidates.length,
    {
      included: false,
      type: null,
    },
  ) as CoaDesignAnswer;
  const set = (i: number, patch: Partial<CoaDesignAnswer[number]>) => {
    const next = answers.map((a) => ({ ...a }));
    next[i] = { ...next[i]!, ...patch };
    if (patch.included === false) next[i]!.type = null;
    onChange({ ...value, items: next });
  };
  return (
    <div className="table-scroll">
      <table className="stmt">
        <caption className="note" style={{ textAlign: 'left' }}>
          Tick the accounts this business needs and choose each one’s type.
        </caption>
        <thead>
          <tr>
            <th scope="col">
              <span className="sr-only">Result</span>
            </th>
            <th scope="col">Include?</th>
            <th scope="col">Candidate account</th>
            <th scope="col">Type</th>
          </tr>
        </thead>
        <tbody>
          {problem.candidates.map((c, i) => (
            <tr key={i} className={itemClass(i, correctItems, wrongItems)}>
              <td>
                <Mark i={i} correct={correctItems} wrong={wrongItems} />
              </td>
              <td>
                <input
                  type="checkbox"
                  aria-label={`Include ${c.name}`}
                  checked={answers[i]!.included}
                  onChange={(e) => set(i, { included: e.target.checked })}
                />
              </td>
              <th scope="row">{c.name}</th>
              <td>
                <select
                  aria-label={`Type of ${c.name}`}
                  disabled={!answers[i]!.included}
                  value={answers[i]!.type ?? ''}
                  onChange={(e) => set(i, { type: (e.target.value || null) as AccountType | null })}
                >
                  <option value="">Type…</option>
                  {ALL_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {TYPE_LABEL[t]}
                    </option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
