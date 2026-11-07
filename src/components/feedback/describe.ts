import type { Diagnostic, DiagnosticLocation } from '@contracts';

/**
 * Human-readable location for a diagnostic ("Row 1 · Checking"), used at reveal level 2.
 *
 * FeedbackPanelProps carries no account list or rows, so names are derived from ids:
 * row ids ending in a number become "Row N"; kebab-case account ids are title-cased.
 * The account is omitted for MISSING_ACCOUNT — naming the solution's account would give the answer away.
 */
export function describeLocation(d: Pick<Diagnostic, 'code' | 'location'>): string {
  const loc: DiagnosticLocation = d.location;
  const parts: string[] = [];
  if (loc.itemIndex !== undefined) parts.push(`Item ${loc.itemIndex + 1}`);
  if (loc.rowId) parts.push(rowName(loc.rowId));
  if (loc.field === 'bs-line') parts.push('After balance sheet');
  if (loc.accountId && d.code !== 'MISSING_ACCOUNT') parts.push(humanize(loc.accountId));
  if (parts.length === 0) return d.code === 'EQUATION_BROKEN' ? 'Balance sheet' : 'Whole answer';
  return parts.join(' · ');
}

export function rowName(rowId: string): string {
  const m = /(\d+)$/.exec(rowId);
  return m ? `Row ${Number(m[1])}` : `Row “${rowId}”`;
}

export function humanize(id: string): string {
  const s = id.replace(/[-_]+/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}
