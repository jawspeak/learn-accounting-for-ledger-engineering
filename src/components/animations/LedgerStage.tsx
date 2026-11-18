import { Fragment, useLayoutEffect, useRef, type RefObject } from 'react';
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

function TAccount({
  ledger,
  accountId,
  step,
  seen,
  note,
  highlighted,
  labelBalance,
}: {
  ledger: AnimLedger;
  accountId: AccountId;
  step: AnimStep;
  seen: Set<string>;
  note?: string;
  highlighted: boolean;
  /** Write the word "balance" by the total (introductory animation only); otherwise rule + bold total. */
  labelBalance: boolean;
}) {
  const account = accountOf(ledger, accountId);
  if (!account) return null;
  const normal = normalSide(account.type);
  const nums = rowNumbers(ledger, step);
  const posted = step.posted[ledger.id] ?? [];
  const entries: Entry[] = [];
  const opening = ledger.opening.find((l) => l.accountId === accountId)?.amount ?? 0;
  if (opening !== 0) {
    entries.push({
      key: 'open',
      ref: 'Bal',
      side: opening > 0 ? normal : normal === 'dr' ? 'cr' : 'dr',
      amount: Math.abs(opening),
      state: 'opening',
    });
  }
  const addRow = (r: TransactionRow, state: EntryState) =>
    r.postings.forEach((p, i) => {
      if (p.accountId !== accountId) return;
      entries.push({
        key: `${r.id}-${i}`,
        ref: `(${nums.get(r.id) ?? '?'})`,
        side: p.side,
        amount: p.amount,
        state,
      });
    });
  for (const r of posted) addRow(r, seen.has(r.id) ? 'posted' : 'new');
  if (step.draft?.ledger === ledger.id) addRow(step.draft.row, 'draft');

  const balance = balancesOf(ledger, posted).get(accountId) ?? 0;
  const balSide: Side = balance >= 0 ? normal : normal === 'dr' ? 'cr' : 'dr';

  // One line per entry, like a ledger: the opening balance first, then each posting on its own line on its side.
  const c = collapse(entries, 7, 3, 3);
  const cell = (e: Entry, side: Side) =>
    e.side === side ? (
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
      className={`tacct${highlighted ? ' is-highlighted' : ''}`}
      data-acct={`${ledger.id}:${accountId}`}
      role="group"
      aria-label={`${account.name} T-account, balance ${formatMoney(Math.abs(balance))} ${sideName(balSide)}`}
    >
      <div className="tacct__head">
        <span className="tacct__name">{account.name}</span>
        <span className="tacct__type">
          {TYPE_LABEL[account.type]} · normal {sideName(normal)}
        </span>
        {note && <span className="tacct__note">{note}</span>}
      </div>
      {/* The T: one continuous stem from the top bar to the bottom, drawn by .tacct__t (not per row), so even an
          account with no entries reads as a T. */}
      <div className="tacct__t">
        <div className="tacct__sides" aria-hidden="true">
          <span>Dr</span>
          <span>Cr</span>
        </div>
        <ul className="tacct__body">
          {c.items.map((e, i) => (
            <Fragment key={e.key}>
              {i === c.at && c.hidden > 0 && (
                <li className="tacct__row tacct__more-row">
                  <span className="tacct__cell tacct__dr tacct__more">⋯ {c.hidden} more</span>
                  <span className="tacct__cell tacct__cr" />
                </li>
              )}
              <li className={`tacct__row is-${e.state}`}>
                {cell(e, 'dr')}
                {cell(e, 'cr')}
              </li>
            </Fragment>
          ))}
          {/* The total: extra space above it, a short rule only under the side that carries it. */}
          <li className="tacct__row tacct__total">
            {(['dr', 'cr'] as Side[]).map((s) => (
              <span
                key={s}
                className={`tacct__cell tacct__${s}${s === balSide ? ' is-total' : ''}`}
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
}: {
  ledger: AnimLedger;
  step: AnimStep;
  seen: Set<string>;
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
    return <p className="journal__empty">No entries yet.</p>;
  }
  const c = collapse(rows, 6, 2, 3);
  const name = (id: AccountId) => accountOf(ledger, id)?.name ?? id;
  return (
    <table className="journal">
      <caption className="visually-hidden">{ledger.title}: journal</caption>
      <thead>
        <tr>
          <th scope="col">#</th>
          <th scope="col">Account</th>
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
        const status = t.balanced
          ? state === 'draft'
            ? `Dr ${formatMoney(t.dr)} = Cr ${formatMoney(t.cr)} ✓ ready to post`
            : `✓ balanced`
          : `Dr ${formatMoney(t.dr)} ≠ Cr ${formatMoney(t.cr)} — not balanced yet`;
        return (
          <tbody key={row.id} className={`journal__row is-${state}`}>
            {i === c.at && c.hidden > 0 && (
              <tr className="journal__more">
                <td colSpan={4}>⋯ {c.hidden} more identical rows ⋯</td>
              </tr>
            )}
            {row.postings.map((p, j) => (
              <tr key={j}>
                <td className="journal__num">{j === 0 ? `(${nums.get(row.id)})` : ''}</td>
                <td className={p.side === 'cr' ? 'journal__cr' : undefined}>{name(p.accountId)}</td>
                <td className="num">{p.side === 'dr' ? formatMoney(p.amount) : ''}</td>
                <td className="num">{p.side === 'cr' ? formatMoney(p.amount) : ''}</td>
              </tr>
            ))}
            <tr className={`journal__status ${t.balanced ? 'is-ok' : 'is-pending'}`}>
              <td />
              <td colSpan={3}>
                {row.label ? <span className="journal__label">{row.label} · </span> : null}
                {status}
              </td>
            </tr>
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
  highlighted,
}: {
  ledger: AnimLedger;
  step: AnimStep;
  highlighted: Set<string>;
}) {
  const posted = step.posted[ledger.id] ?? [];
  const before = balancesOf(ledger, []);
  const now = balancesOf(ledger, posted);
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
                line(a.id, a.name, signed(before, a.id), signed(now, a.id), highlighted.has(a.id)),
              )}
              {showIncome &&
                line(
                  '__income',
                  'Net income (revenue − expenses)',
                  netIncome(before),
                  netIncome(now),
                  ledger.accounts.some(
                    (a) => incomeTypes.includes(a.type) && highlighted.has(a.id),
                  ),
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
  labelBalances,
}: {
  ledger: AnimLedger;
  step: AnimStep;
  seen: Set<string>;
  labelBalances: boolean;
}) {
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
            note={hl.get(id)}
            highlighted={hl.has(id)}
            labelBalance={labelBalances}
          />
        ))}
      </div>
      <div className="ledger__journal">
        <Journal ledger={ledger} step={step} seen={seen} />
      </div>
      {ledger.showBalanceSheet && (
        <BalanceSheetPanel ledger={ledger} step={step} highlighted={new Set(hl.keys())} />
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
