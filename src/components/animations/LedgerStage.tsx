import { useLayoutEffect, useRef, type RefObject } from 'react';
import type { AccountId, AccountType, Money, Side, TransactionRow } from '@contracts';
import { normalSide } from '@engine';
import {
  accountOf,
  balancesOf,
  equationOf,
  formatMoney,
  rowTotals,
  typeLookup,
  type AnimLedger,
  type AnimStep,
  type LedgerAnimationDef,
} from './model';
import { StepAnimation, type StageContext } from './StepAnimation';

const TYPE_LABEL: Record<AccountType, string> = {
  asset: 'asset',
  'contra-asset': 'contra-asset',
  liability: 'liability',
  'contra-liability': 'contra-liability',
  equity: 'equity',
  'contra-equity': 'contra-equity',
  revenue: 'revenue',
  'contra-revenue': 'contra-revenue',
  expense: 'expense',
  dividend: 'dividends',
};

const sideName = (s: Side) => (s === 'dr' ? 'Dr' : 'Cr');

/** Show at most `max` items: the first `head`, an ellipsis, the last `tail`. */
function collapse<T>(
  items: T[],
  max: number,
  head: number,
  tail: number,
): { items: T[]; hidden: number; at: number } {
  if (items.length <= max) return { items, hidden: 0, at: -1 };
  return {
    items: [...items.slice(0, head), ...items.slice(-tail)],
    hidden: items.length - head - tail,
    at: head,
  };
}

type EntryState = 'opening' | 'posted' | 'new' | 'draft';
interface Entry {
  key: string;
  ref: string;
  side: Side;
  amount: Money;
  state: EntryState;
}

function rowNumbers(ledger: AnimLedger, step: AnimStep): Map<string, number> {
  const m = new Map<string, number>();
  (step.posted[ledger.id] ?? []).forEach((r, i) => m.set(r.id, i + 1));
  if (step.draft?.ledger === ledger.id && !m.has(step.draft.row.id))
    m.set(step.draft.row.id, m.size + 1);
  return m;
}

type LedgerLine =
  | { kind: 'opening'; key: string }
  | { kind: 'tx'; key: string; row: TransactionRow; n: number; state: EntryState; changed: boolean }
  | { kind: 'more'; key: string; hidden: number };

/**
 * The line structure shared by every T in a ledger at this step: opening (if any account has one), one line per
 * transaction in order (posted, then the draft), with a long run collapsed to first 3 · "⋯ N more" · last 3.
 */
function ledgerLines(
  ledger: AnimLedger,
  step: AnimStep,
  seen: Set<string>,
  changed: Set<string>,
): LedgerLine[] {
  const nums = rowNumbers(ledger, step);
  const out: LedgerLine[] = [];
  if (
    ledger.tAccounts.some(
      (id) => (ledger.opening.find((l) => l.accountId === id)?.amount ?? 0) !== 0,
    )
  )
    out.push({ kind: 'opening', key: 'open' });
  const tx: { row: TransactionRow; state: EntryState }[] = (step.posted[ledger.id] ?? []).map(
    (row) => ({
      row,
      state: seen.has(row.id) ? 'posted' : 'new',
    }),
  );
  if (step.draft?.ledger === ledger.id) tx.push({ row: step.draft.row, state: 'draft' });
  const c = collapse(tx, 7, 3, 3);
  c.items.forEach(({ row, state }, i) => {
    if (i === c.at && c.hidden > 0) out.push({ kind: 'more', key: 'more', hidden: c.hidden });
    out.push({
      kind: 'tx',
      key: row.id,
      row,
      n: nums.get(row.id) ?? 0,
      state,
      changed: state === 'draft' || changed.has(row.id),
    });
  });
  return out;
}

function TAccount({
  ledger,
  accountId,
  step,
  seen,
  changed,
  prevPosted,
  note,
  highlighted,
  labelBalance,
}: {
  ledger: AnimLedger;
  accountId: AccountId;
  step: AnimStep;
  seen: Set<string>;
  /** Rows this step added (vs the previous step) — marked amber. */
  changed: Set<string>;
  /** What was posted on the previous step, to tell whether this account's total changed. */
  prevPosted: TransactionRow[] | undefined;
  note?: string;
  highlighted: boolean;
  /** Write the word "balance" by the total (introductory animation only); otherwise rule + bold total. */
  labelBalance: boolean;
}) {
  const account = accountOf(ledger, accountId);
  if (!account) return null;
  const normal = normalSide(account.type);
  const posted = step.posted[ledger.id] ?? [];
  const balance = balancesOf(ledger, posted).get(accountId) ?? 0;
  const balSide: Side = balance >= 0 ? normal : normal === 'dr' ? 'cr' : 'dr';
  const totalChanged =
    prevPosted !== undefined && (balancesOf(ledger, prevPosted).get(accountId) ?? 0) !== balance;

  // The same lines in every T of this set of books, so line n is transaction n everywhere (even when the T's
  // wrap onto several rows): an opening line if ANY T has an opening balance, then one line per transaction
  // (empty where this account isn't touched), then the total. Long runs collapse the same way in every T.
  const lines = ledgerLines(ledger, step, seen, changed);
  const ownOpening = ledger.opening.find((l) => l.accountId === accountId)?.amount ?? 0;
  const cellsFor = (line: LedgerLine): Partial<Record<Side, Entry>> => {
    if (line.kind === 'opening') {
      if (ownOpening === 0) return {};
      const side: Side = ownOpening > 0 ? normal : normal === 'dr' ? 'cr' : 'dr';
      return {
        [side]: { key: 'open', ref: 'Bal', side, amount: Math.abs(ownOpening), state: 'opening' },
      };
    }
    if (line.kind !== 'tx') return {};
    const out: Partial<Record<Side, Entry>> = {};
    for (const side of ['dr', 'cr'] as Side[]) {
      const amount = line.row.postings
        .filter((q) => q.accountId === accountId && q.side === side)
        .reduce((sum, q) => sum + q.amount, 0);
      if (amount)
        out[side] = {
          key: `${line.row.id}-${side}`,
          ref: `(${line.n})`,
          side,
          amount,
          state: line.state,
        };
    }
    return out;
  };

  // This step touches the account (a new or drafted line, or its total moved): outline it, like a hand-picked one.
  const touched =
    totalChanged ||
    lines.some(
      (l) => l.kind === 'tx' && l.changed && l.row.postings.some((q) => q.accountId === accountId),
    );

  const cell = (e: Entry | undefined, side: Side) =>
    e ? (
      <span className={`tacct__cell tacct__${side}`}>
        <span className="tacct__ref">{e.ref}</span>
        <span className="tacct__amt">{formatMoney(e.amount)}</span>
        <span className="visually-hidden">
          {' '}
          {sideName(side)}
          {e.state === 'draft' ? ' (pending)' : ''}
        </span>
      </span>
    ) : (
      <span className={`tacct__cell tacct__${side}`} />
    );

  return (
    <div
      className={`tacct inc-${normal}${highlighted || touched ? ' is-highlighted' : ''}`}
      // Rows on the ledger's shared grid: header, Dr/Cr labels, one per line, the total. Every T in the ledger
      // has the same count, so each line is as tall as its tallest version across the row (see animations.css).
      style={{ ['--tacct-rows' as string]: lines.length + 3 }}
      data-acct={`${ledger.id}:${accountId}`}
      role="group"
      aria-label={`${account.name}, ${TYPE_LABEL[account.type]} T-account (increases on the ${normal === 'dr' ? 'debit' : 'credit'} side), balance ${formatMoney(Math.abs(balance))} ${sideName(balSide)}`}
    >
      <div className="tacct__head">
        <span className="tacct__name">{account.name}</span>
        {/* The type only — the increasing side is shown by the shaded half and its ▲ (same as everywhere else). */}
        <span className="tacct__type">
          {TYPE_LABEL[account.type].replace(/^./, (c) => c.toUpperCase())}
        </span>
        {note && <span className="tacct__note">{note}</span>}
      </div>
      {/* The T: one continuous stem from the top bar to the bottom, drawn by .tacct__t (not per row), so even an
          account with no entries reads as a T. */}
      <div className="tacct__t" style={{ ['--tacct-t-rows' as string]: lines.length + 2 }}>
        <div className="tacct__sides" aria-hidden="true">
          <span>Dr{normal === 'dr' && <span className="tacct__inc"> ▲</span>}</span>
          <span>Cr{normal === 'cr' && <span className="tacct__inc"> ▲</span>}</span>
        </div>
        <ul className="tacct__body" style={{ ['--tacct-body-rows' as string]: lines.length + 1 }}>
          {lines.map((line) => {
            if (line.kind === 'more')
              return (
                <li key={line.key} className="tacct__row tacct__more-row">
                  <span className="tacct__cell tacct__dr tacct__more">⋯ {line.hidden} more</span>
                  <span className="tacct__cell tacct__cr" />
                </li>
              );
            const c = cellsFor(line);
            const state = line.kind === 'opening' ? 'opening' : line.state;
            const chg = line.kind === 'tx' && line.changed;
            return (
              <li
                key={line.key}
                className={`tacct__row is-${state}${c.dr || c.cr ? '' : ' is-blank'}${chg ? ' is-changed' : ''}`}
              >
                {cell(c.dr, 'dr')}
                {cell(c.cr, 'cr')}
              </li>
            );
          })}
          {/* The total: extra space above it, a short rule only under the side that carries it. */}
          <li className="tacct__row tacct__total">
            {(['dr', 'cr'] as Side[]).map((s) => (
              <span
                key={s}
                className={`tacct__cell tacct__${s}${s === balSide ? ` is-total${totalChanged ? ' is-changed' : ''}` : ''}`}
              >
                {s === balSide && (
                  <>
                    {labelBalance ? (
                      <span className="tacct__ref">balance</span>
                    ) : (
                      <span className="visually-hidden">balance </span>
                    )}
                    <strong key={balance} className="tacct__balval">
                      {formatMoney(Math.abs(balance))}
                    </strong>
                  </>
                )}
              </span>
            ))}
          </li>
        </ul>
      </div>
    </div>
  );
}

function Journal({
  ledger,
  step,
  seen,
  changed,
}: {
  ledger: AnimLedger;
  step: AnimStep;
  seen: Set<string>;
  changed: Set<string>;
}) {
  const posted = step.posted[ledger.id] ?? [];
  const draft = step.draft?.ledger === ledger.id ? step.draft.row : undefined;
  const nums = rowNumbers(ledger, step);
  const rows: { row: TransactionRow; state: EntryState }[] = posted.map((r) => ({
    row: r,
    state: seen.has(r.id) ? 'posted' : 'new',
  }));
  if (draft) rows.push({ row: draft, state: 'draft' });
  if (rows.length === 0) {
    return <p className="sa-journal__empty">No entries yet.</p>;
  }
  // Repeated entries (e.g. 30 daily accruals) collapse hard: the first, "… N more like it", the last two.
  const c = collapse(rows, 4, 1, 2);
  const name = (id: AccountId) => accountOf(ledger, id)?.name ?? id;
  return (
    // The same postings as the T-accounts above, as journal entries: (n) here is (n) in the T's.
    <table className="sa-journal">
      <caption className="visually-hidden">{ledger.title}: journal</caption>
      <thead>
        <tr>
          <th scope="col">Journal</th>
          <th scope="col" className="num">
            Dr
          </th>
          <th scope="col" className="num">
            Cr
          </th>
        </tr>
      </thead>
      {c.items.map(({ row, state }, i) => {
        const t = rowTotals(row);
        // Only the entry being added at this step says whether it balances; posted ones already did.
        const status =
          state === 'posted'
            ? null
            : t.balanced
              ? state === 'draft'
                ? `✓ Dr ${formatMoney(t.dr)} = Cr ${formatMoney(t.cr)}, ready to post`
                : '✓ balanced'
              : `Dr ${formatMoney(t.dr)} ≠ Cr ${formatMoney(t.cr)}, not balanced yet`;
        const lines = [
          ...row.postings.filter((p) => p.side === 'dr'),
          ...row.postings.filter((p) => p.side === 'cr'),
        ];
        return (
          <tbody
            key={row.id}
            className={`sa-journal__entry is-${state}${state === 'draft' || changed.has(row.id) ? ' is-changed' : ''}`}
          >
            {i === c.at && c.hidden > 0 && (
              <tr className="sa-journal__more">
                <td colSpan={3}>⋯ {c.hidden} more like it ⋯</td>
              </tr>
            )}
            <tr className="sa-journal__head">
              <th scope="rowgroup" colSpan={3}>
                <span className="sa-journal__ref">({nums.get(row.id)})</span> {row.label ?? ''}
                {status && (
                  <span className={`sa-journal__status ${t.balanced ? 'is-ok' : 'is-pending'}`}>
                    {' '}
                    · {status}
                  </span>
                )}
              </th>
            </tr>
            {lines.map((p, j) => (
              <tr key={j} className={`sa-journal__line is-${p.side}`}>
                <td className="sa-journal__acct">{name(p.accountId)}</td>
                <td className="num">{p.side === 'dr' ? formatMoney(p.amount) : ''}</td>
                <td className="num">{p.side === 'cr' ? formatMoney(p.amount) : ''}</td>
              </tr>
            ))}
          </tbody>
        );
      })}
    </table>
  );
}

const GROUPS: { label: string; types: AccountType[] }[] = [
  { label: 'Assets', types: ['asset', 'contra-asset'] },
  { label: 'Liabilities', types: ['liability', 'contra-liability'] },
  { label: 'Equity', types: ['equity', 'contra-equity'] },
];

function BalanceSheetPanel({
  ledger,
  step,
  prevPosted,
}: {
  ledger: AnimLedger;
  step: AnimStep;
  prevPosted: TransactionRow[] | undefined;
}) {
  const posted = step.posted[ledger.id] ?? [];
  const before = balancesOf(ledger, []);
  const now = balancesOf(ledger, posted);
  // A line is marked (amber) only when this step moved it.
  const prevBal = prevPosted ? balancesOf(ledger, prevPosted) : now;
  const moved = (id: string) => (prevBal.get(id) ?? 0) !== (now.get(id) ?? 0);
  const typeOf = typeLookup(ledger);
  const eqBefore = equationOf(ledger, []);
  const eqNow = equationOf(ledger, posted);
  const incomeTypes: AccountType[] = ['revenue', 'contra-revenue', 'expense', 'dividend'];
  const signed = (m: Map<string, Money>, id: string) => {
    const t = typeOf(id);
    const v = m.get(id) ?? 0;
    return t && (t.startsWith('contra') || t === 'expense' || t === 'dividend') ? -v : v;
  };
  const netIncome = (m: Map<string, Money>) =>
    ledger.accounts
      .filter((a) => incomeTypes.includes(a.type))
      .reduce((s, a) => s + signed(m, a.id), 0);

  const line = (key: string, label: string, b: Money, n: Money, hl: boolean) => {
    const delta = n - b;
    return (
      <tr key={key} className={hl ? 'is-highlighted' : undefined}>
        <th scope="row">{label}</th>
        <td className="num">{formatMoney(b)}</td>
        <td className="num">
          {formatMoney(n)}
          <span
            className="bs__delta"
            aria-label={delta === 0 ? 'unchanged' : delta > 0 ? 'increased' : 'decreased'}
          >
            {delta > 0 ? ' ▲' : delta < 0 ? ' ▼' : ''}
          </span>
        </td>
      </tr>
    );
  };

  const eqText = (e: ReturnType<typeof equationOf>) =>
    `${formatMoney(e.assets)} = ${formatMoney(e.liabilities)} + ${formatMoney(e.equity)}`;

  return (
    // Scrolls inside its own box on a narrow phone instead of widening the whole page.
    <div className="bs-scroll">
      <table className="bs">
        <caption>Balance sheet</caption>
        <thead>
          <tr>
            <th scope="col" />
            <th scope="col" className="num">
              Before
            </th>
            <th scope="col" className="num">
              Now
            </th>
          </tr>
        </thead>
        {GROUPS.map((g) => {
          const accts = ledger.accounts.filter(
            (a) =>
              g.types.includes(a.type) &&
              ((before.get(a.id) ?? 0) !== 0 || (now.get(a.id) ?? 0) !== 0),
          );
          const showIncome =
            g.label === 'Equity' && (netIncome(before) !== 0 || netIncome(now) !== 0);
          return (
            <tbody key={g.label}>
              <tr className="bs__group">
                <th scope="rowgroup" colSpan={3}>
                  {g.label}
                </th>
              </tr>
              {accts.map((a) =>
                line(a.id, a.name, signed(before, a.id), signed(now, a.id), moved(a.id)),
              )}
              {showIncome &&
                line(
                  '__income',
                  'Net income (revenue − expenses)',
                  netIncome(before),
                  netIncome(now),
                  ledger.accounts.some((a) => incomeTypes.includes(a.type) && moved(a.id)),
                )}
              {accts.length === 0 && !showIncome && (
                <tr className="bs__none">
                  <th scope="row">—</th>
                  <td className="num">{formatMoney(0)}</td>
                  <td className="num">{formatMoney(0)}</td>
                </tr>
              )}
            </tbody>
          );
        })}
        <tfoot>
          <tr>
            <th scope="row">A = L + E</th>
            <td className={`num ${eqBefore.balanced ? 'is-ok' : 'is-err'}`}>
              {eqText(eqBefore)} {eqBefore.balanced ? '✓' : '✗'}
            </td>
            <td className={`num ${eqNow.balanced ? 'is-ok' : 'is-err'}`}>
              {eqText(eqNow)} {eqNow.balanced ? '✓' : '✗'}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function LedgerPanel({
  ledger,
  step,
  seen,
  prev,
  labelBalances,
}: {
  ledger: AnimLedger;
  step: AnimStep;
  seen: Set<string>;
  /** The previous step (either direction): what this screen changed is computed against it. */
  prev: AnimStep | undefined;
  labelBalances: boolean;
}) {
  const prevPosted = prev ? (prev.posted[ledger.id] ?? []) : undefined;
  const before = new Set((prevPosted ?? step.posted[ledger.id] ?? []).map((r) => r.id));
  const changed = new Set(
    (step.posted[ledger.id] ?? []).filter((r) => !before.has(r.id)).map((r) => r.id),
  );
  const hl = new Map(
    (step.highlight ?? []).filter((h) => h.ledger === ledger.id).map((h) => [h.account, h.note]),
  );
  return (
    <section className="ledger" aria-label={ledger.title}>
      <h4 className="ledger__title">{ledger.title}</h4>
      <div className="ledger__taccts">
        {ledger.tAccounts.map((id) => (
          <TAccount
            key={id}
            ledger={ledger}
            accountId={id}
            step={step}
            seen={seen}
            changed={changed}
            prevPosted={prevPosted}
            note={hl.get(id)}
            highlighted={hl.has(id)}
            labelBalance={labelBalances}
          />
        ))}
      </div>
      <div className="ledger__journal">
        <Journal ledger={ledger} step={step} seen={seen} changed={changed} />
      </div>
      {ledger.showBalanceSheet && (
        <BalanceSheetPanel ledger={ledger} step={step} prevPosted={prevPosted} />
      )}
    </section>
  );
}

/** Slides a "$100" token between T-accounts. Purely decorative; skipped for reduced motion / backward steps. */
function useFlowTokens(
  stageRef: RefObject<HTMLDivElement | null>,
  tokenRefs: RefObject<(HTMLSpanElement | null)[]>,
  step: AnimStep,
  ctx: StageContext,
) {
  useLayoutEffect(() => {
    const stage = stageRef.current;
    const flows = step.flows ?? [];
    if (!stage || !ctx.forward || ctx.reducedMotion || flows.length === 0) return;
    const animations: Animation[] = [];
    const base = stage.getBoundingClientRect();
    flows.forEach((f, i) => {
      const token = tokenRefs.current[i];
      const from = stage.querySelector(`[data-acct="${f.from.ledger}:${f.from.account}"]`);
      const to = stage.querySelector(`[data-acct="${f.to.ledger}:${f.to.account}"]`);
      if (!token || !from || !to || typeof token.animate !== 'function') return;
      const a = from.getBoundingClientRect();
      const b = to.getBoundingClientRect();
      const x0 = a.left + a.width / 2 - base.left;
      const y0 = a.top + a.height / 2 - base.top;
      const x1 = b.left + b.width / 2 - base.left;
      const y1 = b.top + b.height / 2 - base.top;
      const t = (x: number, y: number) => `translate(${x}px, ${y}px) translate(-50%, -50%)`;
      animations.push(
        token.animate(
          [
            { transform: t(x0, y0), opacity: 0 },
            { transform: t(x0, y0), opacity: 1, offset: 0.15 },
            { transform: t(x1, y1), opacity: 1, offset: 0.85 },
            { transform: t(x1, y1), opacity: 0 },
          ],
          { duration: 1200, delay: i * 250, easing: 'ease-in-out', fill: 'both' },
        ),
      );
    });
    return () => animations.forEach((a) => a.cancel());
  }, [stageRef, tokenRefs, step, ctx.forward, ctx.reducedMotion]);
}

function LedgerStage({ def, ctx }: { def: LedgerAnimationDef; ctx: StageContext }) {
  const step = def.steps[ctx.index]!;
  const prev = ctx.index > 0 ? def.steps[ctx.index - 1] : undefined;
  const stageRef = useRef<HTMLDivElement>(null);
  const tokenRefs = useRef<(HTMLSpanElement | null)[]>([]);
  useFlowTokens(stageRef, tokenRefs, step, ctx);

  // Rows already visible (posted or drafted) on the previous step are not "new".
  const seen = new Set<string>();
  if (prev && ctx.forward) {
    for (const rows of Object.values(prev.posted)) rows.forEach((r) => seen.add(r.id));
  } else {
    for (const rows of Object.values(step.posted)) rows.forEach((r) => seen.add(r.id));
  }

  const showTokens = ctx.forward && !ctx.reducedMotion;
  return (
    <div className={`ledger-stage ledger-stage--n${def.ledgers.length}`} ref={stageRef}>
      {def.ledgers.map((l) => (
        <LedgerPanel
          key={l.id}
          ledger={l}
          step={step}
          seen={seen}
          prev={ctx.index > 0 ? def.steps[ctx.index - 1] : undefined}
          labelBalances={!!def.labelBalances}
        />
      ))}
      {showTokens &&
        (step.flows ?? []).map((f, i) => (
          <span
            key={`${ctx.index}-${i}`}
            className="flow-token"
            aria-hidden="true"
            ref={(el) => {
              tokenRefs.current[i] = el;
            }}
          >
            {formatMoney(f.amount)}
          </span>
        ))}
    </div>
  );
}

/** A ledger animation (T-accounts + journal + mini balance sheets) driven by the StepAnimation shell. */
export function LedgerAnimation({ def }: { def: LedgerAnimationDef }) {
  return (
    <StepAnimation
      title={def.title}
      captions={def.steps.map((s) => s.caption)}
      className={`ledger-anim ledger-anim--${def.id}`}
      renderStage={(ctx) => <LedgerStage def={def} ctx={ctx} />}
    />
  );
}
