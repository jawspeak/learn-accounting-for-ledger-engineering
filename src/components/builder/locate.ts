import type { DiagnosticLocation } from '@contracts';

const PULSE_MS = 2400;

/**
 * Scroll a diagnostic's location in a rendered T-account builder into view, focus it, and pulse it briefly.
 * Falls back from the exact cell → the account's column head → the row → the builder itself.
 * A missing account (MISSING_ACCOUNT) has no column, so it lands on its row — never revealing the answer.
 */
export function locateInBuilder(root: ParentNode, loc: DiagnosticLocation): HTMLElement | null {
  const q = (sel: string) => root.querySelector<HTMLElement>(sel);
  const acct = loc.accountId ? CSS.escape(loc.accountId) : null;
  const row = loc.rowId ? CSS.escape(loc.rowId) : null;

  let el: HTMLElement | null = null;
  if (loc.field === 'bs-line' && acct) el = q(`.tab-bs-after [data-account="${acct}"]`);
  if (!el && loc.field === 'type' && acct) el = q(`[data-col-head="${acct}"]`);
  if (!el && row && acct) el = q(`tr[data-row="${row}"] td[data-account="${acct}"]`);
  if (!el && acct) el = q(`[data-col-head="${acct}"]`);
  if (!el && row) el = q(`tr[data-row="${row}"]`);
  if (!el) el = q('.tab-builder');
  if (!el) return null;

  const reduce =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView?.({ block: 'center', inline: 'center', behavior: reduce ? 'auto' : 'smooth' });
  const focusable =
    loc.field === 'type'
      ? el.querySelector<HTMLElement>('select')
      : el.querySelector<HTMLElement>('input, select, button');
  focusable?.focus({ preventScroll: true });
  el.classList.remove('tab-pulse');
  void el.offsetWidth; // restart the animation when the same spot is located twice
  el.classList.add('tab-pulse');
  const target = el;
  setTimeout(() => target.classList.remove('tab-pulse'), PULSE_MS);
  return el;
}
