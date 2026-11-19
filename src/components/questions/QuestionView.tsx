import { useState } from 'react';
import type { AttemptState, CheckResult, Problem, RevealLevel } from '@contracts';
import { engine } from '@engine';
import { entities } from '@content';
import { FeedbackPanel } from '../feedback/FeedbackPanel';
import { Classify } from './Classify';
import { DrCrPredict } from './DrCrPredict';
import { EquationFill } from './EquationFill';
import { StatementFill } from './StatementFill';
import { MultipleChoice } from './MultipleChoice';
import { CoaDesign } from './CoaDesign';
import { KeyConcept } from './types';

export type NonBookingProblem = Exclude<Problem, { kind: 'booking' }>;

/** Kinds graded the moment a choice is made: no Check button, feedback under each choice. */
const INSTANT = new Set<Problem['kind']>(['multiple-choice', 'dr-cr-predict']);

/** Which item indices to show as correct / wrong given the reveal level. */
export function marksFor(result: CheckResult | null, level: RevealLevel) {
  const correctItems =
    result && level >= 1
      ? result.correctParts.map((c) => c.itemIndex).filter((i): i is number => i !== undefined)
      : undefined;
  const wrongItems =
    result && level >= 2
      ? result.diagnostics
          .map((d) => d.location.itemIndex)
          .filter((i): i is number => i !== undefined)
      : undefined;
  return { correctItems, wrongItems };
}

/** Pure input switch (no checking) — useful in tests and fixtures. */
export function QuestionInput({
  problem,
  value,
  onChange,
  correctItems,
  wrongItems,
}: {
  problem: NonBookingProblem;
  value: AttemptState;
  onChange(next: AttemptState): void;
  correctItems?: number[];
  wrongItems?: number[];
}) {
  const common = { value, onChange, correctItems, wrongItems };
  switch (problem.kind) {
    case 'classify':
      return <Classify problem={problem} {...common} />;
    case 'dr-cr-predict':
      return <DrCrPredict problem={problem} {...common} />;
    case 'equation-fill':
      return <EquationFill problem={problem} {...common} />;
    case 'statement-fill': {
      const ent = entities[problem.entityId];
      const nameOf = (id: string) => ent?.accounts.find((a) => a.id === id)?.name ?? id;
      return <StatementFill problem={problem} {...common} accountName={nameOf} entity={ent} />;
    }
    case 'multiple-choice':
      return <MultipleChoice problem={problem} {...common} />;
    case 'coa-design':
      return <CoaDesign problem={problem} {...common} />;
  }
}

/** Input + Check button + FeedbackPanel for one non-booking problem. */
export function QuestionView({
  problem,
  initial,
  onAttemptChange,
  onChecked,
  next,
}: {
  problem: NonBookingProblem;
  next?: { href: string; title: string };
  initial?: AttemptState;
  onAttemptChange?(a: AttemptState): void;
  /** Called with the verdict whenever an answer is checked (progress tracking). */
  onChecked?(correct: boolean): void;
}) {
  const [value, setValue] = useState<AttemptState>(initial ?? { v: 1, problemId: problem.id });
  const [result, setResult] = useState<CheckResult | null>(null);
  const [level, setLevel] = useState<RevealLevel>(0);

  const change = (next: AttemptState) => {
    setValue(next);
    setResult(null);
    setLevel(0);
    onAttemptChange?.(next);
    // Instant kinds are graded as you choose: each choice is a check.
    if (INSTANT.has(problem.kind))
      onChecked?.(engine.checkProblem(problem, next, entities).correct);
  };
  const { correctItems, wrongItems } = marksFor(result, level);

  if (INSTANT.has(problem.kind)) {
    // Graded as you choose (one question, one verdict) — the components show ✓/✗ and the "why" inline.
    const done = engine.checkProblem(problem, value, entities).correct;
    return (
      <div>
        <QuestionInput problem={problem} value={value} onChange={change} />
        {done && <KeyConcept text={problem.explanation} next={next} />}
        <FeedbackPanel
          result={null}
          level={0}
          onEscalate={() => {}}
          hints={problem.hints}
          explanation={problem.explanation}
        />
      </div>
    );
  }

  return (
    <div>
      <QuestionInput
        problem={problem}
        value={value}
        onChange={change}
        correctItems={correctItems}
        wrongItems={wrongItems}
      />
      <div className="toolbar">
        <button
          type="button"
          className="primary"
          onClick={() => {
            const r = engine.checkProblem(problem, value, entities);
            setResult(r);
            setLevel(1);
            onChecked?.(r.correct);
          }}
        >
          Check answer
        </button>
      </div>
      <FeedbackPanel
        result={result}
        level={level}
        onEscalate={() => setLevel((l) => Math.min(5, l + 1) as RevealLevel)}
        hints={problem.hints}
        explanation={problem.explanation}
        walkthrough={problem.walkthrough}
        accounts={'entityId' in problem ? entities[problem.entityId]?.accounts : undefined}
        next={next}
      />
    </div>
  );
}
