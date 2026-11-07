import type { MultipleChoiceAnswer, MultipleChoiceProblem } from '@contracts';
import { Markdown } from '../../app/Markdown';
import { itemClass, Mark, type QuestionInputProps } from './types';

/** Single or multi select. Writes `items = [selectedIndices]`. Marks use the option index as itemIndex. */
export function MultipleChoice({
  problem,
  value,
  onChange,
  correctItems,
  wrongItems,
}: QuestionInputProps<MultipleChoiceProblem>) {
  const selected = ((value.items as MultipleChoiceAnswer | undefined)?.[0] ?? []) as number[];
  const toggle = (i: number) => {
    let next: number[];
    if (problem.multi)
      next = selected.includes(i)
        ? selected.filter((x) => x !== i)
        : [...selected, i].sort((a, b) => a - b);
    else next = [i];
    onChange({ ...value, items: [next] });
  };
  return (
    <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
      <legend className="note">{problem.multi ? 'Select all that apply.' : 'Select one.'}</legend>
      <ul className="mc-options">
        {problem.options.map((o, i) => (
          <li key={i} className={`q-item ${itemClass(i, correctItems, wrongItems)}`}>
            <Mark i={i} correct={correctItems} wrong={wrongItems} />
            <label
              className="q-label"
              style={{ display: 'flex', gap: '0.6rem', alignItems: 'baseline', cursor: 'pointer' }}
            >
              <input
                type={problem.multi ? 'checkbox' : 'radio'}
                name={problem.id}
                checked={selected.includes(i)}
                onChange={() => toggle(i)}
              />
              <Markdown text={o.text} inline />
            </label>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}
