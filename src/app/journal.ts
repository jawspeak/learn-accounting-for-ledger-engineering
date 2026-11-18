/**
 * Journal entries, rendered one consistent way everywhere: a simple accountant-style sheet with
 * Account | Debit | Credit columns, debits first, credit accounts indented, and a totals line per entry.
 *
 * Used by ```journal blocks in authored markdown, the problem "Reference entry" panel, statement-fill
 * problems, and the builder's Journal view. Authored syntax (blank line between entries; a non-Dr/Cr line
 * is the entry's title, e.g. a date and description):
 *
 * ```journal
 * 2026-11-02  Deposit cash
 * Dr  Checking Account     100
 *     Cr  Cash                  100
 * ```
 */
import type { Side, TransactionRow } from '@contracts';

export interface JLine {
  account: string;
  side: Side;
  /** Integer cents. */
  amount: number;
}
export interface JEntry {
  title?: string;
  lines: JLine[];
}

const LINE_RE = /^(dr|cr|debit|credit)\.?\s+(.+?)\s+\$?\s*([\d,]+(?:\.\d\d)?)\s*$/i;

/** Parse a ```journal block. Throws a line-specific error on anything it can't read (caught by the content test). */
export function parseJournal(src: string): JEntry[] {
  const entries: JEntry[] = [];
  let current: JEntry | null = null;
  src.split('\n').forEach((raw, i) => {
    const line = raw.trim();
    if (!line) {
      current = null;
      return;
    }
    const m = LINE_RE.exec(line);
    if (!m) {
      // A title line: starts a new entry, or names the entry that's about to get lines.
      if (!current || current.lines.length > 0) {
        current = { title: line, lines: [] };
        entries.push(current);
      } else current.title = current.title ? `${current.title} ${line}` : line;
      return;
    }
    if (!current) {
      current = { lines: [] };
      entries.push(current);
    }
    const amount = Math.round(Number(m[3]!.replace(/,/g, '')) * 100);
    if (!Number.isFinite(amount) || amount <= 0)
      throw new Error(`journal line ${i + 1}: bad amount "${m[3]}"`);
    const side: Side = m[1]!.toLowerCase().startsWith('d') ? 'dr' : 'cr';
    (current as JEntry).lines.push({ account: m[2]!.trim(), side, amount });
  });
  for (const e of entries)
    if (e.lines.length === 0) throw new Error(`journal entry "${e.title ?? ''}" has no lines`);
  return entries;
}

export const journalTotals = (e: JEntry) => ({
  dr: e.lines.filter((l) => l.side === 'dr').reduce((s, l) => s + l.amount, 0),
  cr: e.lines.filter((l) => l.side === 'cr').reduce((s, l) => s + l.amount, 0),
});

/** Builder / engine rows → entries ("1. Label"), account ids resolved to names. */
export function rowsToEntries(rows: TransactionRow[], nameOf: (id: string) => string): JEntry[] {
  return rows.map((r, i) => ({
    title: `${i + 1}. ${r.label || `Transaction ${i + 1}`}`,
    lines: r.postings.map((p) => ({
      account: nameOf(p.accountId),
      side: p.side,
      amount: p.amount,
    })),
  }));
}

const esc = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
const money = (cents: number) =>
  `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;

/**
 * The journal sheet's HTML (all text escaped). `caption` is trusted HTML (callers pass rendered inline
 * markdown from authored content, or nothing).
 */
export function journalHtml(entries: JEntry[], opts: { captionHtml?: string } = {}): string {
  const body = entries
    .map((e) => {
      const lines = [
        ...e.lines.filter((l) => l.side === 'dr'),
        ...e.lines.filter((l) => l.side === 'cr'),
      ];
      const t = journalTotals(e);
      const ok = t.dr === t.cr && t.dr > 0;
      const head = e.title
        ? `<tr class="je-head"><th colspan="3" scope="rowgroup">${esc(e.title)}</th></tr>`
        : '';
      const rows = lines.length
        ? lines
            .map(
              (l) =>
                `<tr class="je-line is-${l.side}"><td class="je-acct">${esc(l.account)}</td>` +
                `<td class="je-num">${l.side === 'dr' ? money(l.amount) : ''}</td>` +
                `<td class="je-num">${l.side === 'cr' ? money(l.amount) : ''}</td></tr>`,
            )
            .join('')
        : `<tr class="je-line"><td class="je-acct je-empty" colspan="3">(no lines yet)</td></tr>`;
      const total = lines.length
        ? `<tr class="je-total"><td class="je-acct"><span class="${ok ? 'is-ok' : 'is-bad'}"><span aria-hidden="true">${ok ? '✓' : '✗'}</span> ${ok ? 'Debits = credits' : 'Debits ≠ credits'}</span></td>` +
          `<td class="je-num">${money(t.dr)}</td><td class="je-num">${money(t.cr)}</td></tr>`
        : '';
      return `<tbody class="je-entry">${head}${rows}${total}</tbody>`;
    })
    .join('');
  return (
    `<div class="je"><table class="je-table">` +
    (opts.captionHtml ? `<caption>${opts.captionHtml}</caption>` : '') +
    `<thead><tr><th scope="col" class="je-acct">Account</th><th scope="col" class="je-num">Debit</th><th scope="col" class="je-num">Credit</th></tr></thead>` +
    `${body}</table></div>`
  );
}

/** A ```journal block → HTML, or a visible error (never a silently wrong entry). */
export function journalBlockHtml(src: string): string {
  try {
    return journalHtml(parseJournal(src));
  } catch (err) {
    return `<pre class="je-error">${esc(err instanceof Error ? err.message : String(err))}\n\n${esc(src)}</pre>`;
  }
}
