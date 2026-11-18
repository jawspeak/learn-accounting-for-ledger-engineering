/**
 * "T-account ledger" figures for authored markdown: one or more accounts, each drawn as a T with all of its
 * postings (opening first), and optionally its balance under a rule. Same marks as the ```tentry figures:
 * the INCREASING side is shaded with ▲ on its label; each posting shows ▲ increase / ▼ decrease.
 *
 * ```taccount
 * Checking Account (asset)
 * Opening: Dr 1,000
 * ATM withdrawal: Cr 60
 * Balance
 * ```
 *
 * A blank line starts the next account; accounts are shown side by side in Assets → Liabilities → Equity order.
 * Each posting line is `[label:] Dr|Cr amount` ("Opening" is shown as the starting balance); a line that says
 * just `Balance` adds the computed balance (on the side it falls, flagged if abnormal).
 */
import type { AccountType, Side } from '@contracts';
import { engine } from '@engine';
import { TYPE_ALIASES, TYPE_LABEL } from './tentry';

export interface LedgerPosting {
  label?: string;
  side: Side;
  /** Whole dollars. */
  amount: number;
  opening: boolean;
}
export interface Ledger {
  account: string;
  type: AccountType;
  postings: LedgerPosting[];
  showBalance: boolean;
}

const HEAD_RE = /^(.+?)\s*\(\s*([a-z -]+?)\s*\)\s*$/i;
const POST_RE = /^(?:(.+?)\s*:\s*)?(dr|cr|debit|credit)\s+\$?\s*([\d,]+)\s*$/i;

export function parseTAccounts(src: string): Ledger[] {
  const out: Ledger[] = [];
  let cur: Ledger | null = null;
  src.split('\n').forEach((raw, i) => {
    const line = raw.trim();
    if (!line) {
      cur = null;
      return;
    }
    if (!cur) {
      const h = HEAD_RE.exec(line);
      if (!h)
        throw new Error(`taccount line ${i + 1}: expected "Account name (type)", got "${line}"`);
      const type = TYPE_ALIASES[h[2]!.toLowerCase().replace(/\s+/g, '-')];
      if (!type) throw new Error(`taccount line ${i + 1}: unknown account type "${h[2]}"`);
      cur = { account: h[1]!.trim(), type, postings: [], showBalance: false };
      out.push(cur);
      return;
    }
    if (/^balance$/i.test(line)) {
      (cur as Ledger).showBalance = true;
      return;
    }
    const m = POST_RE.exec(line);
    if (!m)
      throw new Error(`taccount line ${i + 1}: expected "[label:] Dr|Cr amount", got "${line}"`);
    const amount = Number(m[3]!.replace(/,/g, ''));
    if (!Number.isInteger(amount) || amount <= 0)
      throw new Error(`taccount line ${i + 1}: bad amount "${m[3]}"`);
    const label = m[1]?.trim();
    (cur as Ledger).postings.push({
      label,
      side: m[2]!.toLowerCase().startsWith('d') ? 'dr' : 'cr',
      amount,
      opening: !!label && /^opening( balance)?$/i.test(label),
    });
  });
  for (const l of out)
    if (l.postings.length === 0) throw new Error(`taccount "${l.account}" has no postings`);
  return out;
}

/** Balance on the account's normal side (negative = abnormal). */
export function ledgerBalance(l: Ledger): number {
  const dr = l.postings.filter((p) => p.side === 'dr').reduce((s, p) => s + p.amount, 0);
  const cr = l.postings.filter((p) => p.side === 'cr').reduce((s, p) => s + p.amount, 0);
  return engine.normalSide(l.type) === 'dr' ? dr - cr : cr - dr;
}

const esc = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
const usd = (n: number) => `$${n.toLocaleString('en-US')}`;

function ledgerHtml(l: Ledger): string {
  const inc = engine.normalSide(l.type);
  // Openings first on each side, then postings in authored order.
  const side = (s: Side) => [
    ...l.postings.filter((p) => p.side === s && p.opening),
    ...l.postings.filter((p) => p.side === s && !p.opening),
  ];
  const dr = side('dr');
  const cr = side('cr');
  const entry = (p: LedgerPosting | undefined, s: Side) => {
    if (!p) return `<span class="tacct-cell tacct-${s} tl-cell"></span>`;
    const up = p.side === inc;
    const mark = p.opening
      ? ''
      : `<span class="tacct-effect ${up ? 'is-up' : 'is-down'}" aria-hidden="true">${up ? '▲' : '▼'}</span>`;
    const label = p.label
      ? `<span class="tl-label">${esc(p.opening ? 'opening' : p.label)}</span>`
      : '';
    const amt = `<span class="tl-amt">${usd(p.amount)}</span>${mark}`;
    const sr = `<span class="sr-only">${p.side === 'dr' ? 'debit' : 'credit'} ${usd(p.amount)}${p.label ? `, ${esc(p.label)}` : ''}${p.opening ? '' : up ? ', increase' : ', decrease'}</span>`;
    // Amounts sit next to the stem of the T: label then amount on the Dr side, amount then label on the Cr side.
    const inner = s === 'dr' ? `${label}${amt}` : `${amt}${label}`;
    return `<span class="tacct-cell tacct-${s} tl-cell${p.opening ? ' is-opening' : ''}"><span aria-hidden="true" class="tl-entry">${inner}</span>${sr}</span>`;
  };
  const rows = Array.from(
    { length: Math.max(dr.length, cr.length) },
    (_, i) => entry(dr[i], 'dr') + entry(cr[i], 'cr'),
  ).join('');
  let balance = '';
  if (l.showBalance) {
    const b = ledgerBalance(l);
    const shown: Side = b < 0 ? (inc === 'dr' ? 'cr' : 'dr') : inc;
    const cell = (s: Side) =>
      s === shown
        ? `<span class="tacct-cell tacct-${s} tl-cell tl-balance is-total"><span class="tl-entry">${s === 'dr' ? '<span class="tl-label">balance</span>' : ''}<strong class="tl-amt">${usd(Math.abs(b))}</strong>${s === 'cr' ? '<span class="tl-label">balance</span>' : ''}</span>${b < 0 ? '<span class="tl-abnormal">(abnormal)</span>' : ''}</span>`
        : `<span class="tacct-cell tacct-${s} tl-cell tl-balance"></span>`;
    balance = cell('dr') + cell('cr');
  }
  const aria = `${l.account}, ${TYPE_LABEL[l.type].toLowerCase()} T-account (increases with a ${inc === 'dr' ? 'debit' : 'credit'})`;
  return (
    `<div class="tacct tledger inc-${inc} tone-${l.type.replace('contra-', '')}" role="group" aria-label="${esc(aria)}">` +
    `<div class="tacct-name">${esc(l.account)}</div><div class="tacct-type">${TYPE_LABEL[l.type]}</div>` +
    `<div class="tacct-grid">` +
    `<span class="tacct-side tacct-dr">Dr${inc === 'dr' ? '<span class="tacct-inc-mark" aria-hidden="true"> ▲</span>' : ''}</span>` +
    `<span class="tacct-side tacct-cr">Cr${inc === 'cr' ? '<span class="tacct-inc-mark" aria-hidden="true"> ▲</span>' : ''}</span>` +
    rows +
    balance +
    `</div></div>`
  );
}

/** Same canonical order as everywhere else: Assets → Liabilities → Equity (revenue, expenses, dividends). */
function ordered(ls: Ledger[]): Ledger[] {
  const cols = engine.orderColumns(
    ls.map((l, i) => ({ accountId: String(i), type: l.type })),
    ls.map((_, i) => String(i)),
  );
  return cols.map((c) => ls[Number(c.accountId)]!);
}

export function tAccountsHtml(src: string): string {
  let ledgers: Ledger[];
  try {
    ledgers = parseTAccounts(src);
  } catch (err) {
    return `<pre class="tentry-error">${esc(err instanceof Error ? err.message : String(err))}\n\n${esc(src)}</pre>`;
  }
  return (
    `<figure class="tledgers">` +
    `<div class="tledgers-row">${ordered(ledgers).map(ledgerHtml).join('')}</div>` +
    `<figcaption class="tentry-legend">Shaded half <span aria-hidden="true">(▲)</span> = the side that <strong>increases</strong> the account. ` +
    `Amounts: <span class="is-up">▲ increase</span>, <span class="is-down">▼ decrease</span>.</figcaption></figure>`
  );
}
