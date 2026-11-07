import { useState } from 'react';
import type { CheckResult, Diagnostic, FeedbackPanelProps } from '@contracts';
import { Markdown } from '../../app/Markdown';
import { describeLocation, type LocationContext } from './describe';
import './feedback.css';

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * Progressive-reveal feedback (VISION-2 §6):
 * 1 count + correct parts · 2 where · 3 what kind · 4 why (explanations) · 5 full solution + walkthrough.
 * Hints are independent of checking and revealed one at a time.
 */
export function FeedbackPanel({
  result,
  level,
  onEscalate,
  hints,
  explanation,
  walkthrough,
  accounts,
  rows,
}: FeedbackPanelProps) {
  const [hintCount, setHintCount] = useState(0);
  /** "Why does this work?" is tied to the result it was asked for, so a new check hides it again. */
  const [whyFor, setWhyFor] = useState<CheckResult | null>(null);

  const checked = result !== null && level >= 1;
  const errors = result?.diagnostics.filter((d) => d.severity === 'error') ?? [];
  const nearMisses = result?.diagnostics.filter((d) => d.severity === 'near-miss') ?? [];
  const ordered = [...errors, ...nearMisses];
  const correct = !!result?.correct;
  const showWhy = correct && whyFor === result;
  const showSolution = checked && (level >= 5 || showWhy);

  return (
    <section className="fb" aria-label="Feedback">
      {hints.length > 0 && (
        <div className="fb-hints">
          <h3 className="fb-h">Hints</h3>
          {hintCount > 0 && (
            <ol className="fb-hint-list" aria-live="polite">
              {hints.slice(0, hintCount).map((h, i) => (
                <li key={i}>
                  <Markdown text={h} />
                </li>
              ))}
            </ol>
          )}
          {hintCount < hints.length ? (
            <button type="button" className="fb-btn" onClick={() => setHintCount(hintCount + 1)}>
              {hintCount === 0 ? 'Show a hint' : 'Show next hint'} ({hintCount + 1} of {hints.length})
            </button>
          ) : (
            <p className="fb-muted">That’s all the hints.</p>
          )}
        </div>
      )}

      <div className="fb-result" aria-live="polite">
        {checked && (
          <>
            <Summary correct={correct} errors={errors.length} nearMisses={nearMisses} correctParts={result!.correctParts.length} />

            {!correct && level >= 2 && (
              <ul className="fb-diags">
                {ordered.map((d, i) => (
                  <DiagnosticItem key={i} d={d} level={level} ctx={{ accounts, rows }} />
                ))}
              </ul>
            )}

            {showSolution && (
              <div className="fb-solution">
                <h3 className="fb-h">{correct ? 'Why this works' : 'Solution'}</h3>
                <Markdown text={explanation} />
                {walkthrough && walkthrough.length > 0 && (
                  <>
                    <h4 className="fb-h">Walkthrough</h4>
                    <ol className="fb-walk">
                      {walkthrough.map((step, i) => (
                        <li key={i}>
                          <Markdown text={step} />
                        </li>
                      ))}
                    </ol>
                  </>
                )}
              </div>
            )}

            {correct && !showSolution && (
              <button type="button" className="fb-btn fb-primary" onClick={() => setWhyFor(result)}>
                Why does this work?
              </button>
            )}
            {!correct && level < 5 && (
              <button type="button" className="fb-btn fb-primary" onClick={onEscalate}>
                {level === 4 ? 'Show the full solution' : 'Tell me more'}
              </button>
            )}
            {!correct && level < 5 && <p className="fb-muted fb-step">Feedback step {level} of 5</p>}
          </>
        )}
      </div>
    </section>
  );
}

function Summary({
  correct,
  errors,
  nearMisses,
  correctParts,
}: {
  correct: boolean;
  errors: number;
  nearMisses: Diagnostic[];
  correctParts: number;
}) {
  if (correct)
    return (
      <div className="fb-summary is-ok">
        <p className="fb-headline">
          <span aria-hidden="true">✓</span> Correct!
        </p>
        {nearMisses.length > 0 && (
          <div className="fb-near">
            <p>
              <span aria-hidden="true">⚠</span> {nearMisses.length === 1 ? 'One thing' : `${nearMisses.length} things`} worth a
              closer look:
            </p>
            <ul>
              {nearMisses.map((d, i) => (
                <li key={i}>{d.message}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  return (
    <div className="fb-summary is-bad">
      <p className="fb-headline">
        <span aria-hidden="true">✗</span> {plural(errors, 'issue')} found
        {nearMisses.length > 0 && <> (plus {plural(nearMisses.length, 'near-miss', 'near-misses')})</>}.
      </p>
      <p>
        {correctParts > 0 ? (
          <>
            <span aria-hidden="true">✓ </span>
            {plural(correctParts, 'part')} correct — marked with ✓.
          </>
        ) : (
          'No parts correct yet.'
        )}
      </p>
    </div>
  );
}

function DiagnosticItem({ d, level, ctx }: { d: Diagnostic; level: number; ctx: LocationContext }) {
  return (
    <li className={`fb-diag is-${d.severity}`}>
      <p className="fb-loc">
        <span aria-hidden="true">{d.severity === 'error' ? '✗' : '⚠'}</span>{' '}
        <span className="fb-sev">{d.severity === 'error' ? 'Issue' : 'Near-miss'}:</span> {describeLocation(d, ctx)}
      </p>
      {level >= 3 && <p className="fb-msg">{d.message}</p>}
      {level >= 4 &&
        (d.explanation ? (
          <div className="fb-expl">
            <Markdown text={d.explanation} />
          </div>
        ) : (
          <p className="fb-muted">No extra explanation for this one — try a hint, or reveal the solution.</p>
        ))}
    </li>
  );
}
