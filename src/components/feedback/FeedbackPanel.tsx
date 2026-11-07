import { useState } from 'react';
import type { FeedbackPanelProps } from '@contracts';
import { Markdown } from '../../app/Markdown';

/** PHASE-0 STUB. UI workstream builds the full progressive-reveal panel (VISION-2 §6). */
export function FeedbackPanel({
  result,
  level,
  onEscalate,
  hints,
  explanation,
}: FeedbackPanelProps) {
  const [hintCount, setHintCount] = useState(0);
  const errors = result?.diagnostics ?? [];
  return (
    <section className="feedback" aria-live="polite">
      {hints.slice(0, hintCount).map((h, i) => (
        <Markdown key={i} text={`**Hint ${i + 1}:** ${h}`} />
      ))}
      {hintCount < hints.length && (
        <button onClick={() => setHintCount(hintCount + 1)}>Hint</button>
      )}
      {result && level >= 1 && (
        <p>
          {result.correct
            ? '✓ Correct!'
            : `${errors.length} issue(s) found. ${result.correctParts.length} part(s) correct.`}
        </p>
      )}
      {result && level >= 3 && (
        <ul>
          {errors.map((d, i) => (
            <li key={i}>{d.message}</li>
          ))}
        </ul>
      )}
      {result &&
        level >= 4 &&
        errors.map((d, i) => d.explanation && <Markdown key={i} text={d.explanation} />)}
      {result && level >= 5 && <Markdown text={explanation} />}
      {result && level < 5 && (
        <button onClick={onEscalate}>
          {result.correct ? 'Why does this work?' : 'Tell me more'}
        </button>
      )}
    </section>
  );
}
