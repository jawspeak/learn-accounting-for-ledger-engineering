import { useState } from 'react';
import type { MultipleChoiceAnswer, MultipleChoiceProblem } from '@contracts';
import { Markdown } from '../../app/Markdown';
import { type QuestionInputProps, Verdict } from './types';

/**
 * Single or multi select, graded the moment an option is picked (no Check button): the picked option shows
 * ✓/✗ and its own explanation right under it. Writes `items = [selectedIndices]`.
 *
 * - Single select: a wrong pick stays marked "tried" (with its "why" one click away) so the learner can try
 *   another option without losing what they learned.
 * - Multi select: every ticked option is judged on its own; a status line says how many right ones are found.
 */
export function MultipleChoice({
  problem,
  value,
  onChange,
}: QuestionInputProps<MultipleChoiceProblem>) {
  const selected = ((value.items as MultipleChoiceAnswer | undefined)?.[0] ?? []) as number[];
  const [tried, setTried] = useState<number[]>([]);

  const toggle = (i: number) => {
    let next: number[];
    if (problem.multi)
      next = selected.includes(i)
        ? selected.filter((x) => x !== i)
        : [...selected, i].sort((a, b) => a - b);
    else {
      next = [i];
      // Remember earlier wrong picks (single select) so they stay visibly "tried".
      const prev = selected[0];
      if (
        prev !== undefined &&
        prev !== i &&
        !problem.options[prev]!.correct &&
        !tried.includes(prev)
      )
        setTried([...tried, prev]);
    }
    onChange({ ...value, items: [next] });
  };

  const rightCount = problem.options.filter((o) => o.correct).length;
  const foundRight = selected.filter((i) => problem.options[i]?.correct).length;
  const pickedWrong = selected.filter(
    (i) => problem.options[i] && !problem.options[i]!.correct,
  ).length;

  return (
    <fieldset className="mc" style={{ border: 0, padding: 0, margin: 0 }}>
      <legend className="note">
        {problem.multi
          ? 'Select all that apply — each choice is checked as you make it.'
          : 'Select one — you’ll see right away whether it’s right, and why.'}
      </legend>
      <ul className="mc-options">
        {problem.options.map((o, i) => {
          const isSel = selected.includes(i);
          const wasTried = !isSel && tried.includes(i);
          const cls = isSel ? (o.correct ? 'is-correct' : 'is-wrong') : wasTried ? 'is-tried' : '';
          return (
            <li key={i} className={`q-item ${cls}`}>
              <span
                className={`q-mark ${isSel ? (o.correct ? 'ok' : 'err') : wasTried ? 'err' : ''}`}
              >
                <span aria-hidden="true">
                  {isSel ? (o.correct ? '✓' : '✗') : wasTried ? '✗' : ''}
                </span>
                {(isSel || wasTried) && (
                  <span className="sr-only">
                    {isSel && o.correct ? 'Correct' : wasTried ? 'Tried, incorrect' : 'Incorrect'}
                  </span>
                )}
              </span>
              <div className="mc-body">
                <label className="q-label mc-label">
                  <input
                    type={problem.multi ? 'checkbox' : 'radio'}
                    name={problem.id}
                    checked={isSel}
                    onChange={() => toggle(i)}
                  />
                  <Markdown text={o.text} inline />
                </label>
                {isSel && (
                  <Verdict
                    ok={o.correct}
                    // Neutral on purpose: a question may ask for statements that *can't* be true, so
                    // "this one is true" would read as a double negative. The explanation says why.
                    lead={o.correct ? 'Correct.' : problem.multi ? 'Not this one.' : 'Not quite.'}
                    why={
                      o.explanation + (!o.correct && !problem.multi ? ' Try another option.' : '')
                    }
                  />
                )}
                {wasTried && (
                  <details className="mc-tried">
                    <summary>Why not this one?</summary>
                    <Markdown text={o.explanation} inline />
                  </details>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {problem.multi && selected.length > 0 && (
        <p className="note mc-progress" role="status">
          {foundRight === rightCount && pickedWrong === 0
            ? rightCount === 1
              ? 'That’s the one.'
              : `All ${rightCount} correct choices found.`
            : `${foundRight} of ${rightCount} correct ${rightCount === 1 ? 'choice' : 'choices'} found${pickedWrong ? ` · untick the ${pickedWrong === 1 ? 'one' : pickedWrong} marked ✗` : ''}.`}
        </p>
      )}
    </fieldset>
  );
}
