import { useState, type ReactNode } from 'react';
import type {
  Account,
  AttemptState,
  BookingProblem,
  CheckResult,
  Problem,
  RevealLevel,
  SandboxState,
  TransactionRow,
} from '@contracts';
import { engine } from '@engine';
import { entities, problems, sections } from '@content';
import { TAccountBuilder } from '../../components/builder/TAccountBuilder';
import { FeedbackPanel } from '../../components/feedback/FeedbackPanel';
import { QuestionView, type NonBookingProblem } from '../../components/questions/QuestionView';
import { JournalTable } from '../../components/questions/JournalTable';
import { Markdown } from '../Markdown';
import { href, replaceHash } from '../router';
import { DifficultyBadge, KindBadge, ROLE_LABEL } from '../badges';

export function ProblemPage({ id, attempt }: { id: string; attempt?: string }) {
  const problem = problems[id];
  if (!problem)
    return (
      <p>
        Unknown problem “{id}”. <a href={href.home()}>Go home</a>
      </p>
    );
  const decoded = attempt ? engine.decodeAttempt(attempt) : null;
  const initial = decoded && decoded.problemId === id ? decoded : undefined;
  return problem.kind === 'booking' ? (
    <BookingView key={id} problem={problem} initial={initial} />
  ) : (
    <ProblemFrame problem={problem}>
      <QuestionView
        key={id}
        problem={problem as NonBookingProblem}
        initial={initial}
        onAttemptChange={(a) => saveAttempt(problem.id, a)}
      />
    </ProblemFrame>
  );
}

function saveAttempt(problemId: string, a: AttemptState) {
  replaceHash(href.problem(problemId, engine.encodeState(a)));
}

function entityNameOf(p: Problem): string | undefined {
  return 'entityId' in p ? entities[p.entityId]?.name : undefined;
}

function CopyLinkButton() {
  const [state, setState] = useState<'idle' | 'ok' | 'fail'>('idle');
  return (
    <>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(window.location.href);
            setState('ok');
          } catch {
            setState('fail');
          }
          setTimeout(() => setState('idle'), 2500);
        }}
      >
        Copy link
      </button>
      <span role="status" className="note">
        {state === 'ok'
          ? '✓ Link copied (includes your current answer)'
          : state === 'fail'
            ? 'Could not copy. Copy the address bar instead.'
            : ''}
      </span>
    </>
  );
}

/** Header (breadcrumb, title, badges, prompt, toolbar) + prev/next around a problem body. */
function ProblemFrame({
  problem,
  toolbarExtra,
  children,
}: {
  problem: Problem;
  toolbarExtra?: ReactNode;
  children: ReactNode;
}) {
  const section = sections.find((s) => s.id === problem.sectionId);
  const ids = section?.problemIds ?? [];
  const idx = ids.indexOf(problem.id);
  const prev = idx > 0 ? problems[ids[idx - 1]!] : undefined;
  const next = idx >= 0 ? problems[ids[idx + 1]!] : undefined;
  const pair = problem.perspectivePairId ? problems[problem.perspectivePairId] : undefined;
  const entityName = entityNameOf(problem);

  return (
    <article>
      <div className="breadcrumb">
        <a href={href.home()}>Home</a> /{' '}
        {section ? (
          <a href={href.section(section.id)}>
            {section.id === 'review' ? section.title : `${section.number}. ${section.title}`}
          </a>
        ) : (
          problem.sectionId
        )}
      </div>
      <h1>{problem.title}</h1>
      <div className="meta-row">
        <span className="badge">{ROLE_LABEL[problem.role]}</span>
        <KindBadge kind={problem.kind} />
        <DifficultyBadge level={problem.difficulty} />
        {entityName && <span className="badge entity">Books of: {entityName}</span>}
      </div>
      <Markdown text={problem.prompt} />
      <div className="toolbar">
        <CopyLinkButton />
        {toolbarExtra}
        {pair && (
          <a className="btn" href={href.problem(pair.id)}>
            See the other side: {pair.title}
          </a>
        )}
      </div>
      {children}
      <nav className="pager" aria-label="Problem navigation">
        {prev ? (
          <a className="btn" href={href.problem(prev.id)}>
            ← {prev.title}
          </a>
        ) : (
          <span />
        )}
        {next ? (
          <a className="btn" href={href.problem(next.id)}>
            {next.title} →
          </a>
        ) : (
          <span />
        )}
      </nav>
    </article>
  );
}

/** Fill chosenType on authored rows so the builder can show them. */
function withTypes(rows: TransactionRow[], accounts: Account[]): TransactionRow[] {
  return rows.map((r) => ({
    ...r,
    postings: r.postings.map((p) => ({
      ...p,
      chosenType: p.chosenType ?? accounts.find((a) => a.id === p.accountId)?.type,
    })),
  }));
}

function sandboxHref(problem: BookingProblem, accounts: Account[], rows: TransactionRow[]): string {
  const used = new Set<string>();
  rows.forEach((r) => r.postings.forEach((p) => used.add(p.accountId)));
  problem.opening?.lines.forEach((l) => used.add(l.accountId));
  const entity = entities[problem.entityId];
  const chosen = accounts.filter((a) => used.has(a.id));
  const state: SandboxState = {
    v: 1,
    title: problem.title,
    scenario: problem.prompt,
    entities: [
      {
        id: problem.entityId,
        name: entity?.name ?? problem.entityId,
        accounts: chosen.length > 0 ? chosen : accounts,
        rows,
        opening: problem.opening,
        showBalanceSheets: problem.showBalanceSheets,
      },
    ],
  };
  return href.sandbox(engine.encodeState(state));
}

function BookingView({ problem, initial }: { problem: BookingProblem; initial?: AttemptState }) {
  const entity = entities[problem.entityId];
  const worked = problem.role === 'worked';
  const accounts = entity ? engine.pickerAccounts(problem, entity) : [];
  const [rows, setRows] = useState<TransactionRow[]>(() => {
    if (worked) return withTypes(problem.solution, accounts);
    return (
      initial?.rows ??
      (problem.prefill ? withTypes(problem.prefill.rows, accounts) : [{ id: 'r1', postings: [] }])
    );
  });
  const [bs, setBs] = useState(initial?.balanceSheet ?? { lines: [] });
  const [result, setResult] = useState<CheckResult | null>(null);
  const [level, setLevel] = useState<RevealLevel>(0);

  if (!entity) return <p>Unknown entity {problem.entityId}.</p>;

  const askBs = !!problem.askAfterBalanceSheet && problem.showBalanceSheets;
  const persist = (r: TransactionRow[], b: typeof bs) => {
    setResult(null);
    setLevel(0);
    if (!worked)
      saveAttempt(problem.id, {
        v: 1,
        problemId: problem.id,
        rows: r,
        balanceSheet: askBs ? b : undefined,
      });
  };

  const locked = worked ? rows.length : problem.prefill?.locked ? problem.prefill.rows.length : 0;
  const ref = problem.reference;
  const refEntity = ref ? entities[ref.entityId] : undefined;

  return (
    <ProblemFrame
      problem={problem}
      toolbarExtra={
        <a className="btn" href={sandboxHref(problem, accounts, rows)}>
          Open in Sandbox
        </a>
      }
    >
      {ref && (
        <section className="reference" aria-label="Reference entry">
          <strong>Reference{refEntity ? `: books of ${refEntity.name}` : ''}</strong>
          <JournalTable
            rows={ref.rows}
            nameOf={(id) => refEntity?.accounts.find((a) => a.id === id)?.name ?? id}
            caption={ref.caption}
          />
        </section>
      )}
      <TAccountBuilder
        mode="problem"
        accounts={accounts}
        coaOrder={entity.accounts.map((a) => a.id)}
        rows={rows}
        onRowsChange={(next) => {
          setRows(next);
          persist(next, bs);
        }}
        lockedRowCount={locked}
        showBalanceSheets={problem.showBalanceSheets}
        opening={problem.opening}
        afterBalanceSheet={askBs && !worked ? bs : undefined}
        onAfterBalanceSheetChange={
          askBs && !worked
            ? (next) => {
                setBs(next);
                persist(rows, next);
              }
            : undefined
        }
        journalView={problem.journalView}
        correctParts={level >= 1 ? result?.correctParts : undefined}
        highlights={level >= 2 ? result?.diagnostics.map((d) => d.location) : undefined}
      />
      {worked ? (
        <>
          {problem.walkthrough && problem.walkthrough.length > 0 && (
            <section aria-labelledby="walk">
              <h2 id="walk">Walkthrough</h2>
              <ol className="steps">
                {problem.walkthrough.map((s, i) => (
                  <li key={i}>
                    <Markdown text={s} />
                  </li>
                ))}
              </ol>
            </section>
          )}
          <section aria-labelledby="why">
            <h2 id="why">Why does this work?</h2>
            <Markdown text={problem.explanation} />
          </section>
        </>
      ) : (
        <>
          <div className="toolbar">
            <button
              type="button"
              className="primary"
              onClick={() => {
                const attempt: AttemptState = {
                  v: 1,
                  problemId: problem.id,
                  rows,
                  balanceSheet: askBs ? bs : undefined,
                };
                setResult(engine.checkProblem(problem, attempt, entities));
                setLevel(1);
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
            accounts={accounts}
            rows={rows}
          />
        </>
      )}
    </ProblemFrame>
  );
}
