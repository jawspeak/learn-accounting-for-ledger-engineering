import type { TransactionRow } from '@contracts';
import { journalHtml, rowsToEntries } from '../../app/journal';
import { renderInline } from '../../app/markdownRender';

/** Read-only journal sheet of rows (the app-wide journal look: see src/app/journal.ts). */
export function JournalTable({
  rows,
  nameOf,
  caption,
}: {
  rows: TransactionRow[];
  nameOf(id: string): string;
  caption?: string;
}) {
  const html = journalHtml(rowsToEntries(rows, nameOf), {
    captionHtml: caption ? renderInline(caption) : undefined,
  });
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
