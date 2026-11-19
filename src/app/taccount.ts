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
 * One posting per line (opening first), each on its own side. A blank line starts the next account; accounts are
 * shown side by side in Assets → Liabilities → Equity order.
 * Each posting line is `[label:] Dr|Cr amount` ("Opening" is shown as the starting balance); a line that says
 * just `Balance` adds the computed balance (on the side it falls, flagged if abnormal) as a rule + bold total;
 * `Balance: labelled` also writes the word "balance" (for introductory examples).
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
  /** `Balance: labelled` writes the word by the total (introductory examples); plain `Balance` doesn't. */
  labelBalance?: boolean;
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
    const bal = /^balance(?:\s*:\s*(labell?ed))?$/i.exec(line);
    if (bal) {
      (cur as Ledger).showBalance = true;
      if (bal[1]) (cur as Ledger).labelBalance = true;
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

/**
 * Shared line keys for every account in one block, so line n is the same transaction in every T: an opening line
 * if ANY account has an opening balance, then one line per distinct transaction label in order of first
 * appearance (e.g. "(1)", "(2)" — the same label lines up across accounts). Unlabelled postings get a line each.
 */
function sharedLines(ls: Ledger[]): string[] {
  const keys: string[] = [];
  if (ls.some((l) => l.postings.some((p) => p.opening))) keys.push('opening');
  ls.forEach((l, li) =>
    l.postings.forEach((p, pi) => {
      if (p.opening) return;
      const k = p.label ? `label:${p.label}` : `own:${li}:${pi}`;
      if (!keys.includes(k)) keys.push(k);
    }),
  );
  return keys;
}

function ledgerHtml(l: Ledger, li: number, keys: string[]): string {
  const inc = engine.normalSide(l.type);
  const keyOf = (p: LedgerPosting, pi: number) =>
    p.opening ? 'opening' : p.label ? `label:${p.label}` : `own:${li}:${pi}`;
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
  // One line per shared key: this account's posting for that transaction on its side, or an empty line.
  const rows = keys
    .map((k) => {
      const here = l.postings.filter((p, pi) => keyOf(p, pi) === k);
      return (
        entry(
          here.find((p) => p.side === 'dr'),
          'dr',
        ) +
        entry(
          here.find((p) => p.side === 'cr'),
          'cr',
        )
      );
    })
    .join('');
  let balance = '';
  if (l.showBalance) {
    // After the basics the rule + bold total is the shorthand; screen readers still hear "balance".
    const word = l.labelBalance
      ? '<span class="tl-label">balance</span>'
      : '<span class="sr-only">balance </span>';
    const b = ledgerBalance(l);
    const shown: Side = b < 0 ? (inc === 'dr' ? 'cr' : 'dr') : inc;
    const cell = (s: Side) =>
      s === shown
        ? `<span class="tacct-cell tacct-${s} tl-cell tl-balance is-total"><span class="tl-entry">${s === 'dr' ? word : ''}<strong class="tl-amt">${usd(Math.abs(b))}</strong>${s === 'cr' ? word : ''}</span>${b < 0 ? '<span class="tl-abnormal">(abnormal)</span>' : ''}</span>`
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
  const shown = ordered(ledgers);
  const keys = sharedLines(ledgers);
  return (
    `<figure class="tledgers">` +
    `<div class="tledgers-row">${shown.map((l) => ledgerHtml(l, ledgers.indexOf(l), keys)).join('')}</div>` +
    `<figcaption class="tentry-legend">Shaded half <span aria-hidden="true">(▲)</span> = the side that <strong>increases</strong> the account. ` +
    `Amounts: <span class="is-up">▲ increase</span>, <span class="is-down">▼ decrease</span>.</figcaption></figure>`
  );
}
