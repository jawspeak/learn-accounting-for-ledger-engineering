import type { AccountId, TransactionRow } from '@contracts';
import { journalHtml, rowsToEntries } from '../../app/journal';

/** Read-only journal-entry rendering of the builder's rows, in the app-wide journal look (VISION-2 §5). */
export function JournalView({
  rows,
  nameOf,
}: {
  rows: TransactionRow[];
  nameOf(id: AccountId): string;
}) {
  if (rows.length === 0) return <p className="tab-muted">No transactions yet.</p>;
  return (
    <div
      className="tab-journal"
      dangerouslySetInnerHTML={{ __html: journalHtml(rowsToEntries(rows, nameOf)) }}
    />
  );
}
