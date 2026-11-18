import type { EquationFillAnswer, EquationFillProblem } from '@contracts';
import { Markdown } from '../../app/Markdown';
import { itemClass, itemsOf, Mark, type QuestionInputProps } from './types';

type Part = 'assets' | 'liabilities' | 'equity';
const PARTS: { key: Part; label: string; sep: string }[] = [
  { key: 'assets', label: 'Assets', sep: '=' },
  { key: 'liabilities', label: 'Liabilities', sep: '+' },
  { key: 'equity', label: 'Equity', sep: '' },
];

/** Parse "1,200" / "$1200" / "" into a number or null. Whole dollars. */
export function parseAmount(s: string): number | null {
  const t = s.replace(/[$,\s]/g, '');
  if (t === '' || t === '-' || !/^-?\d*\.?\d*$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function EquationFill({
  problem,
  value,
  onChange,
  correctItems,
  wrongItems,
}: QuestionInputProps<EquationFillProblem>) {
  const answers = itemsOf<number | null>(value, problem.items.length, null) as EquationFillAnswer;
  const set = (i: number, s: string) => {
    const next = answers.slice();
    next[i] = parseAmount(s);
    onChange({ ...value, items: next });
  };
  return (
    <ol className="q-items">
      {problem.items.map((it, i) => (
        <li key={i} className={`q-item ${itemClass(i, correctItems, wrongItems)}`}>
          <Mark i={i} correct={correctItems} wrong={wrongItems} />
          {it.story && (
            <div className="eq-story">
              <Markdown text={it.story} />
            </div>
          )}
          <div className="eq">
            {PARTS.map((p) => {
              const given = it[p.key];
              return (
                <span key={p.key} style={{ display: 'contents' }}>
                  <label>
                    <span className="note">{p.label}</span>{' '}
                    {given !== null && problem.hideGiven ? (
                      // Word problem: the learner works this total out from the story.
                      <span
                        className="eq-hidden"
                        aria-label={`${p.label}: work it out from the story`}
                      >
                        …
                      </span>
                    ) : given === null ? (
                      <input
                        inputMode="decimal"
                        className="money-input"
                        aria-label={`Item ${i + 1}: missing ${p.label}`}
                        defaultValue={answers[i] ?? ''}
                        onChange={(e) => set(i, e.target.value)}
                      />
                    ) : (
                      <strong>${given.toLocaleString('en-US')}</strong>
                    )}
                  </label>
                  {p.sep && <span aria-hidden="true">{p.sep}</span>}
                </span>
              );
            })}
          </div>
        </li>
      ))}
    </ol>
  );
}
