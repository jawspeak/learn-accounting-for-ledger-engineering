import { useState } from 'react';
import type { BookingProblem, CheckResult, RevealLevel, TransactionRow } from '@contracts';
import { engine } from '@engine';
import { entities, problems } from '@content';
import { TAccountBuilder } from '../../components/builder/TAccountBuilder';
import { FeedbackPanel } from '../../components/feedback/FeedbackPanel';
import { Markdown } from '../Markdown';
import { href, replaceHash } from '../router';

/** Phase-0 skeleton: booking problems only. SHELL adds the other question kinds. */
export function ProblemPage({ id, attempt }: { id: string; attempt?: string }) {
  const problem = problems[id];
  if (!problem) return <p>Unknown problem.</p>;
  if (problem.kind !== 'booking') return <p>Question type “{problem.kind}” not built yet.</p>;
  return <BookingView key={id} problem={problem} attempt={attempt} />;
}

function BookingView({ problem, attempt }: { problem: BookingProblem; attempt?: string }) {
  const entity = entities[problem.entityId];
  const initial = (attempt && engine.decodeAttempt(attempt)?.rows) || problem.prefill?.rows || [{ id: 'r1', postings: [] }];
  const [rows, setRows] = useState<TransactionRow[]>(initial);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [level, setLevel] = useState<RevealLevel>(0);
  if (!entity) return <p>Unknown entity {problem.entityId}.</p>;

  const onRowsChange = (next: TransactionRow[]) => {
    setRows(next);
    setResult(null);
    setLevel(0);
    replaceHash(href.problem(problem.id, engine.encodeState({ v: 1, problemId: problem.id, rows: next })));
  };

  return (
    <article>
      <h1>{problem.title}</h1>
      <p>
        <em>Books of: {entity.name}</em>
      </p>
      <Markdown text={problem.prompt} />
      <TAccountBuilder
        mode="problem"
        accounts={engine.pickerAccounts(problem, entity)}
        coaOrder={entity.accounts.map((a) => a.id)}
        rows={rows}
        onRowsChange={onRowsChange}
        lockedRowCount={problem.prefill?.locked ? problem.prefill.rows.length : 0}
        showBalanceSheets={problem.showBalanceSheets}
        opening={problem.opening}
        journalView={problem.journalView}
        correctParts={level >= 1 ? result?.correctParts : undefined}
        highlights={level >= 2 ? result?.diagnostics.map((d) => d.location) : undefined}
      />
      <button
        onClick={() => {
          setResult(engine.checkBooking(problem, entity, { rows }));
          setLevel(1);
        }}
      >
        Check
      </button>
      <button onClick={() => navigator.clipboard?.writeText(window.location.href)}>Copy link</button>
      <FeedbackPanel
        result={result}
        level={level}
        onEscalate={() => setLevel((l) => Math.min(5, l + 1) as RevealLevel)}
        hints={problem.hints}
        explanation={problem.explanation}
        walkthrough={problem.walkthrough}
      />
    </article>
  );
}
