import type { ReactNode } from 'react';

/** Draws one T-account. `inc` = which half increases the account (shaded and marked "+"). */
function T({
  x,
  y,
  w = 190,
  title,
  inc,
  note,
}: {
  x: number;
  y: number;
  w?: number;
  title: string;
  inc: 'dr' | 'cr';
  note?: string;
}) {
  const h = 84;
  const mid = x + w / 2;
  const sign = (side: 'dr' | 'cr') => (inc === side ? '▲ increases' : '▼ decreases');
  return (
    <g>
      <rect className="t-frame" x={x} y={y} width={w} height={h} rx="6" />
      {inc === 'dr' ? (
        <rect className="t-inc" x={x + 1} y={y + 30} width={w / 2 - 1} height={h - 31} />
      ) : (
        <rect className="t-inc" x={mid} y={y + 30} width={w / 2 - 1} height={h - 31} />
      )}
      <text className="title" x={mid} y={y + 21} textAnchor="middle">
        {title}
      </text>
      <line className="t-line" x1={x} x2={x + w} y1={y + 30} y2={y + 30} />
      <line className="t-line" x1={mid} x2={mid} y1={y + 30} y2={y + h} />
      <text className="cell-b" x={x + w / 4} y={y + 52} textAnchor="middle">
        Debit
      </text>
      <text className="cell" x={x + w / 4} y={y + 72} textAnchor="middle">
        {sign('dr')}
      </text>
      <text className="cell-b" x={x + (3 * w) / 4} y={y + 52} textAnchor="middle">
        Credit
      </text>
      <text className="cell" x={x + (3 * w) / 4} y={y + 72} textAnchor="middle">
        {sign('cr')}
      </text>
      {note && (
        <text className="small muted" x={mid} y={y + h + 16} textAnchor="middle">
          {note}
        </text>
      )}
    </g>
  );
}

function Arrow({ d, id }: { d: string; id?: string }) {
  return <path className="arrow" d={d} markerEnd={id ? `url(#${id})` : undefined} />;
}

export function CheatSheetSvg() {
  return (
    <svg
      className="cheat-svg"
      viewBox="0 0 640 560"
      role="img"
      aria-labelledby="cs-title cs-desc"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title id="cs-title">Accounting equation cheat sheet</title>
      <desc id="cs-desc">
        Assets equal Liabilities plus Equity. Assets increase with debits; Liabilities and Equity
        increase with credits. Equity is Paid-in Capital plus Retained Earnings. Revenue increases
        Retained Earnings with credits; Expenses and Dividends reduce it and increase with debits.
      </desc>
      <defs>
        <marker
          id="cs-head"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto"
        >
          <path className="arrow-head" d="M0,0 L10,5 L0,10 z" />
        </marker>
      </defs>

      <text className="big" x="320" y="34" textAnchor="middle">
        Assets = Liabilities + Equity
      </text>

      {/* Row 1 */}
      <T x={10} y={56} title="Assets" inc="dr" />
      <text className="big" x="213" y="104" textAnchor="middle">
        =
      </text>
      <T x={225} y={56} title="Liabilities" inc="cr" />
      <text className="big" x="428" y="104" textAnchor="middle">
        +
      </text>
      <T x={440} y={56} title="Equity" inc="cr" />

      {/* Equity splits */}
      <Arrow d="M535,140 L535,176" id="cs-head" />
      <Arrow d="M535,158 L320,158 L320,176" id="cs-head" />
      <text className="small muted" x="428" y="153" textAnchor="middle">
        Equity =
      </text>

      {/* Row 2 */}
      <T x={225} y={178} title="Paid-in Capital" inc="cr" note="Owners’ money put in" />
      <T x={440} y={178} title="Retained Earnings" inc="cr" note="Profits kept, less dividends" />
      <text className="small muted" x="10" y="200">
        Shaded half + “▲ increases”
      </text>
      <text className="small muted" x="10" y="218">
        = the side that grows the account.
      </text>

      {/* Feeders */}
      <path className="arrow" d="M100,330 L100,306 L535,306" />
      <path className="arrow" d="M320,330 L320,306" />
      <Arrow d="M535,330 L535,282" id="cs-head" />
      <text className="small muted" x="320" y="299" textAnchor="middle">
        feed Retained Earnings
      </text>

      <T x={10} y={332} title="Revenue" inc="cr" note="Credit ▲ → raises Retained Earnings" />
      <T x={225} y={332} title="Expenses" inc="dr" note="Debit ▲ → lowers Retained Earnings" />
      <T
        x={440}
        y={332}
        title="Dividends / Draws"
        inc="dr"
        note="Debit ▲ → lowers Retained Earnings"
      />

      {/* Footer */}
      <text className="cell-b" x="10" y="470">
        Every transaction: total debits = total credits.
      </text>
      <text className="cell" x="10" y="492">
        Debit-normal (grow with Dr): Dividends, Expenses, Assets
      </text>
      <text className="cell" x="10" y="512">
        Credit-normal (grow with Cr): Liabilities, Equity, Revenue
      </text>
      <text className="small muted" x="10" y="540">
        Contra accounts sit opposite their parent: Accumulated Depreciation (credit) reduces an
        Asset.
      </text>
    </svg>
  );
}

export function CheatSheetBody({ heading = 'h1' }: { heading?: 'h1' | 'h2' }): ReactNode {
  const H = heading;
  return (
    <>
      <H>Cheat sheet</H>
      <CheatSheetSvg />
      <h3>Mnemonic: DEALER</h3>
      <ul className="dealer" aria-label="DEALER mnemonic">
        {[
          ['D', 'Dividends', 'dr'],
          ['E', 'Expenses', 'dr'],
          ['A', 'Assets', 'dr'],
          ['L', 'Liabilities', 'cr'],
          ['E', 'Equity', 'cr'],
          ['R', 'Revenue', 'cr'],
        ].map(([l, name, side], i) => (
          <li key={i} className={side}>
            <b>{l}</b>
            <span>{name}</span>
            <span className="note">{side === 'dr' ? 'Debit-normal' : 'Credit-normal'}</span>
          </li>
        ))}
      </ul>
      <h3>Contra accounts</h3>
      <p>
        A contra account has the <strong>opposite</strong> normal side of its parent and reduces it.
        Example: Allowance for Doubtful Accounts (credit-normal) reduces Accounts Receivable
        (debit-normal). Net the two to get the carrying value.
      </p>
    </>
  );
}
