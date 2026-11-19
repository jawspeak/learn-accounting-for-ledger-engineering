import { useRef, useState, type ReactNode } from 'react';
import type {
  Account,
  AccountType,
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
import { locateInBuilder } from '../../components/builder/locate';
import { PICKER_TYPES, isContraType } from '../../components/builder/model';
import { FeedbackPanel } from '../../components/feedback/FeedbackPanel';
import { QuestionView, type NonBookingProblem } from '../../components/questions/QuestionView';
import { JournalTable } from '../../components/questions/JournalTable';
import { Markdown } from '../Markdown';
import { href, replaceHash } from '../router';
import { problemNumber } from '../problemNumber';
import { boardFor, solvedRows, withTypes } from '../solutionBoard';
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
        next={nextLink(problem)}
        initial={initial}
        onAttemptChange={(a) => saveAttempt(problem.id, a)}
      />
    </ProblemFrame>
  );
}

function saveAttempt(problemId: string, a: AttemptState) {
  replaceHash(href.problem(problemId, engine.encodeState(a)));
}

/** Previous / next problem within the section, and this problem's position in it. */
function neighbors(problem: Problem) {
  const section = sections.find((s) => s.id === problem.sectionId);
  const ids = section?.problemIds ?? [];
  const idx = ids.indexOf(problem.id);
  return {
    section,
    index: idx,
    total: ids.length,
    prev: idx > 0 ? problems[ids[idx - 1]!] : undefined,
    next: idx >= 0 ? problems[ids[idx + 1]!] : undefined,
  };
}

function nextLink(problem: Problem): { href: string; title: string } | undefined {
  const { next, section } = neighbors(problem);
  if (next) return { href: href.problem(next.id), title: next.title };
  const si = sections.findIndex((s) => s.id === section?.id);
  const nextSection = si >= 0 ? sections[si + 1] : undefined;
  return nextSection
    ? { href: href.section(nextSection.id), title: `section ${nextSection.title}` }
    : undefined;
}

/**
 * Contra types are introduced in §9; before that they'd just be noise in the picker. They're still offered
 * earlier if the problem's own accounts include a contra account (e.g. an opening BS with accumulated depreciation).
 */
function pickerTypesFor(problem: BookingProblem, accounts: Account[]): AccountType[] | undefined {
  const sectionNumber = sections.find((s) => s.id === problem.sectionId)?.number ?? 99;
  if (sectionNumber >= 9) return undefined;
  const inPlay = new Set(
    [...problem.solution, ...(problem.prefill?.rows ?? [])].flatMap((r) =>
      r.postings.map((p) => p.accountId),
    ),
  );
  problem.opening?.lines.forEach((l) => inPlay.add(l.accountId));
  if (accounts.some((a) => inPlay.has(a.id) && isContraType(a.type))) return undefined;
  return PICKER_TYPES.map((t) => t.type).filter((t) => !isContraType(t));
}

/** Count the top-level numbered list items in a markdown prompt ("7. A catering client pays…"). */
const numberedEvents = (md: string) => md.split('\n').filter((l) => /^\d+\.\s/.test(l)).length;

/**
 * Starting rows. When the prompt numbers its events and the solution has one row per event, start with one
 * labelled row per event so the learner can go straight to booking. Otherwise a single empty row — the
 * number of rows is part of the answer there (e.g. reversal + correction).
 */
function startingRows(problem: BookingProblem): TransactionRow[] {
  const n = problem.solution.length;
  if (n > 1 && numberedEvents(problem.prompt) === n)
    return problem.solution.map((r, i) => ({
      id: `r${i + 1}`,
      ...(r.label ? { label: r.label } : {}),
      postings: [],
    }));
  return [{ id: 'r1', postings: [] }];
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
  const { section, index, total, prev, next } = neighbors(problem);
  const pair = problem.perspectivePairId ? problems[problem.perspectivePairId] : undefined;
  const entityName = entityNameOf(problem);
  const num = problemNumber(problem.id);

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
        {num && (
          <>
            {' '}
            {/* Where you are, once: the problem's number (same as in the section lists) and its place. */}
            / <span aria-current="page">Problem {num}</span>
            {index >= 0 && (
              <span className="breadcrumb-of">
                {' '}
                ({index + 1} of {total})
              </span>
            )}
          </>
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
            ← {problemNumber(prev.id)} {prev.title}
          </a>
        ) : (
          <span />
        )}
        {next ? (
          <a className="btn" href={href.problem(next.id)}>
            {problemNumber(next.id)} {next.title} →
          </a>
        ) : (
          <span />
        )}
      </nav>
    </article>
  );
}

/** "Open in Sandbox" + "Open in Spreadsheet" for a board. */
function BoardLinks({ board, prefix = '' }: { board: SandboxState; prefix?: string }) {
  const enc = engine.encodeState(board);
  return (
    <>
      <a className="btn" href={href.sandbox(enc)}>
        Open {prefix}in Sandbox
      </a>
      <a className="btn" href={href.sheet(enc)} title="Wide grid view (desktop)">
        Open {prefix}in Spreadsheet
      </a>
    </>
  );
}

/**
 * The full solution on demand (VISION-2: revealing the answer is always possible, as the last step).
 * Collapsed by default so it never spoils the problem by accident.
 */
function SolutionPanel({ problem, accounts }: { problem: BookingProblem; accounts: Account[] }) {
  // Rendered only once opened: no hidden second grid in the page (or in the accessibility tree) before then.
  const [open, setOpen] = useState(false);
  return (
    <details className="solution-reveal" onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>
        Show the solution <span className="note">(spoiler: try it first)</span>
      </summary>
      {open && <SolutionBody problem={problem} accounts={accounts} />}
    </details>
  );
}

function SolutionBody({ problem, accounts }: { problem: BookingProblem; accounts: Account[] }) {
  const entity = entities[problem.entityId]!;
  const rows = solvedRows(problem);
  const pair = problem.perspectivePairId ? problems[problem.perspectivePairId] : undefined;
  return (
    <>
      <TAccountBuilder
        mode="problem"
        readOnly
        accounts={accounts}
        coaOrder={entity.accounts.map((a) => a.id)}
        rows={rows}
        onRowsChange={() => {}}
        lockedRowCount={rows.length}
        showBalanceSheets={problem.showBalanceSheets}
        opening={problem.opening}
        journalView
      />
      {problem.walkthrough && problem.walkthrough.length > 0 && (
        <>
          <h3>Walkthrough</h3>
          <ol className="steps">
            {problem.walkthrough.map((s, i) => (
              <li key={i}>
                <Markdown text={s} />
              </li>
            ))}
          </ol>
        </>
      )}
      <h3>Why this works</h3>
      <Markdown text={problem.explanation} />
      <div className="toolbar">
        <BoardLinks board={boardFor(problem, accounts, rows, true)} prefix="solution " />
        {pair?.kind === 'booking' && pair.entityId !== problem.entityId && (
          <span className="note">
            Includes the other side’s books ({entities[pair.entityId]?.name}).
          </span>
        )}
      </div>
    </>
  );
}

function BookingView({ problem, initial }: { problem: BookingProblem; initial?: AttemptState }) {
  const entity = entities[problem.entityId];
  const worked = problem.role === 'worked';
  const accounts = entity ? engine.pickerAccounts(problem, entity) : [];
  const [rows, setRows] = useState<TransactionRow[]>(() => {
    if (worked) return withTypes(problem.solution, accounts);
    return (
      initial?.rows ??
      (problem.prefill ? withTypes(problem.prefill.rows, accounts) : startingRows(problem))
    );
  });
  const [bs, setBs] = useState(initial?.balanceSheet ?? { lines: [] });
  const [result, setResult] = useState<CheckResult | null>(null);
  const [level, setLevel] = useState<RevealLevel>(0);
  const builderRef = useRef<HTMLDivElement>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);

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
      toolbarExtra={<BoardLinks board={boardFor(problem, accounts, rows, worked)} />}
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
      <div ref={builderRef}>
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
          lockedPostings={
            // Faded examples: lock only the given half, so the missing side goes in the same row.
            !worked && problem.prefill?.locked
              ? problem.prefill.rows.flatMap((r) =>
                  r.postings.map((p) => ({ rowId: r.id, accountId: p.accountId, side: p.side })),
                )
              : undefined
          }
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
          pickerTypes={pickerTypesFor(problem, accounts)}
          correctParts={level >= 1 ? result?.correctParts : undefined}
          highlights={level >= 2 ? result?.diagnostics.map((d) => d.location) : undefined}
        />
      </div>
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
                // Bring the verdict into view without jumping away from the grid more than needed.
                requestAnimationFrame(() =>
                  feedbackRef.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' }),
                );
              }}
            >
              Check answer
            </button>
          </div>
          <div ref={feedbackRef}>
            <FeedbackPanel
              result={result}
              level={level}
              onEscalate={() => setLevel((l) => Math.min(5, l + 1) as RevealLevel)}
              hints={problem.hints}
              explanation={problem.explanation}
              walkthrough={problem.walkthrough}
              accounts={accounts}
              rows={rows}
              onLocate={(loc) => builderRef.current && locateInBuilder(builderRef.current, loc)}
              next={nextLink(problem)}
            />
          </div>
          <SolutionPanel problem={problem} accounts={accounts} />
        </>
      )}
    </ProblemFrame>
  );
}
