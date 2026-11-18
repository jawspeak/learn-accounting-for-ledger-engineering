/**
 * "T-account entry" figures for authored markdown. A fenced block with the language `tentry` renders as one row
 * per business event: the event on the left, then one small T-account per line of the entry.
 *
 * ```tentry
 * You make a repayment on the loan
 * Loan Payable (liability): Dr 1,000
 * Interest Expense (expense): Dr 50
 * Checking Account (asset): Cr 1,050
 *
 * The bank receives your payment
 * Customer Deposits – Checking (liability): Dr 1,050
 * Loans Receivable (asset): Cr 1,000
 * Interest Income (revenue): Cr 50
 * ```
 *
 * Every T marks its INCREASING side the same way everywhere (shaded half + ▲ on that side's label, matching the
 * cheat sheet), and each amount says whether it raises (▲) or lowers (▼) the account. Each event shows its
 * Σ Dr = Σ Cr check. Events are separated by a blank line; amounts are whole dollars.
 */
import type { AccountType, Side } from '@contracts';
import { engine } from '@engine';

export interface TLine {
  account: string;
  type: AccountType;
  side: Side;
  /** Whole dollars. */
  amount: number;
}
export interface TEvent {
  title: string;
  lines: TLine[];
}

const TYPE_ALIASES: Record<string, AccountType> = {
  asset: 'asset',
  'contra-asset': 'contra-asset',
  liability: 'liability',
  'contra-liability': 'contra-liability',
  equity: 'equity',
  'contra-equity': 'contra-equity',
  revenue: 'revenue',
  income: 'revenue',
  'contra-revenue': 'contra-revenue',
  expense: 'expense',
  dividend: 'dividend',
  dividends: 'dividend',
  draws: 'dividend',
};
const TYPE_LABEL: Record<AccountType, string> = {
  asset: 'Asset',
  'contra-asset': 'Contra-asset',
  liability: 'Liability',
  'contra-liability': 'Contra-liability',
  equity: 'Equity',
  'contra-equity': 'Contra-equity',
  revenue: 'Revenue',
  'contra-revenue': 'Contra-revenue',
  expense: 'Expense',
  dividend: 'Dividends',
};
const SIDE_WORD: Record<Side, string> = { dr: 'debit', cr: 'credit' };

const LINE_RE = /^(.+?)\s*\(\s*([a-z -]+?)\s*\)\s*:\s*(dr|cr|debit|credit)\s+\$?\s*([\d,]+)\s*$/i;

/** Parse a tentry block. Throws with a line-specific message on anything it can't read (caught by the content test). */
export function parseTEntry(src: string): TEvent[] {
  const events: TEvent[] = [];
  let current: TEvent | null = null;
  src.split('\n').forEach((raw, i) => {
    const line = raw.trim();
    if (!line) {
      current = null;
      return;
    }
    const m = LINE_RE.exec(line);
    if (!m) {
      if (current && current.lines.length > 0)
        throw new Error(
          `tentry line ${i + 1}: expected "Account (type): Dr|Cr amount", got "${line}"`,
        );
      if (current) current.title += ` ${line}`;
      else {
        current = { title: line, lines: [] };
        events.push(current);
      }
      return;
    }
    if (!current)
      throw new Error(`tentry line ${i + 1}: a posting needs an event title line above it`);
    const type = TYPE_ALIASES[m[2]!.toLowerCase().replace(/\s+/g, '-')];
    if (!type) throw new Error(`tentry line ${i + 1}: unknown account type "${m[2]}"`);
    const amount = Number(m[4]!.replace(/,/g, ''));
    if (!Number.isInteger(amount) || amount <= 0)
      throw new Error(`tentry line ${i + 1}: bad amount "${m[4]}"`);
    const side: Side = m[3]!.toLowerCase().startsWith('d') ? 'dr' : 'cr';
    (current as TEvent).lines.push({ account: m[1]!.trim(), type, side, amount });
  });
  for (const e of events)
    if (e.lines.length === 0) throw new Error(`tentry event "${e.title}" has no postings`);
  return events;
}

export const totals = (e: TEvent) => ({
  dr: e.lines.filter((l) => l.side === 'dr').reduce((s, l) => s + l.amount, 0),
  cr: e.lines.filter((l) => l.side === 'cr').reduce((s, l) => s + l.amount, 0),
});

const esc = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
const usd = (n: number) => `$${n.toLocaleString('en-US')}`;

function tAccountHtml(l: TLine): string {
  const inc = engine.normalSide(l.type);
  const up = l.side === inc;
  const cell = (s: Side) =>
    s === l.side
      ? `<span class="tacct-amt ${up ? 'is-up' : 'is-down'}">${usd(l.amount)}<span class="tacct-effect" aria-hidden="true">${up ? ' ▲' : ' ▼'}</span></span>`
      : '';
  const label = (s: Side) =>
    `${s === 'dr' ? 'Dr' : 'Cr'}${s === inc ? '<span class="tacct-inc-mark" aria-hidden="true"> ▲</span>' : ''}`;
  const aria = `${l.account}, ${TYPE_LABEL[l.type].toLowerCase()} (increases with a ${SIDE_WORD[inc]}): ${SIDE_WORD[l.side]} ${usd(l.amount)}, ${up ? 'an increase' : 'a decrease'}`;
  return (
    `<div class="tacct inc-${inc} tone-${l.type.replace('contra-', '')}" role="img" aria-label="${esc(aria)}">` +
    `<div class="tacct-name">${esc(l.account)}</div>` +
    `<div class="tacct-type">${TYPE_LABEL[l.type]}</div>` +
    `<div class="tacct-grid">` +
    `<span class="tacct-side tacct-dr">${label('dr')}</span><span class="tacct-side tacct-cr">${label('cr')}</span>` +
    `<span class="tacct-cell tacct-dr">${cell('dr')}</span><span class="tacct-cell tacct-cr">${cell('cr')}</span>` +
    `</div></div>`
  );
}

/** The figure's HTML (all text escaped). One event per row; a short legend explains the marks. */
export function tEntryHtml(src: string): string {
  let events: TEvent[];
  try {
    events = parseTEntry(src);
  } catch (err) {
    return `<pre class="tentry-error">${esc(err instanceof Error ? err.message : String(err))}\n\n${esc(src)}</pre>`;
  }
  const rows = events
    .map((e) => {
      const t = totals(e);
      const ok = t.dr === t.cr;
      return (
        `<div class="tentry-row">` +
        `<div class="tentry-event"><span class="tentry-title">${esc(e.title)}</span>` +
        `<span class="tentry-sum ${ok ? 'is-ok' : 'is-bad'}"><span aria-hidden="true">${ok ? '✓' : '✗'}</span> Dr ${usd(t.dr)} ${ok ? '=' : '≠'} Cr ${usd(t.cr)}</span></div>` +
        `<div class="tentry-ts">${e.lines.map(tAccountHtml).join('')}</div>` +
        `</div>`
      );
    })
    .join('');
  return (
    `<figure class="tentry">${rows}` +
    `<figcaption class="tentry-legend">Shaded half <span aria-hidden="true">(▲)</span> = the side that <strong>increases</strong> the account. ` +
    `Amounts: <span class="is-up">▲ increase</span>, <span class="is-down">▼ decrease</span>.</figcaption></figure>`
  );
}
