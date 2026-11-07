import type { TransactionRow } from '@contracts';
import { Markdown } from '../../app/Markdown';

const fmt = (cents: number) => `$${(cents / 100).toLocaleString('en-US')}`;

/** Read-only journal listing of rows (Dr lines first, Cr lines indented). */
export function JournalTable({
  rows,
  nameOf,
  caption,
}: {
  rows: TransactionRow[];
  nameOf(id: string): string;
  caption?: string;
}) {
  return (
    <div className="table-scroll">
      <table className="journal">
        {caption && (
          <caption>
            <Markdown text={caption} inline />
          </caption>
        )}
        <thead>
          <tr>
            <th scope="col">Account</th>
            <th scope="col" className="num">
              Debit
            </th>
            <th scope="col" className="num">
              Credit
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => {
            const lines = [
              ...r.postings.filter((p) => p.side === 'dr'),
              ...r.postings.filter((p) => p.side === 'cr'),
            ];
            return [
              <tr key={`${r.id}-h`}>
                <th
                  scope="colgroup"
                  colSpan={3}
                  style={{ fontFamily: 'var(--font-sans)', paddingTop: '0.5rem' }}
                >
                  {ri + 1}. {r.label ?? ''}
                </th>
              </tr>,
              ...lines.map((p, pi) => (
                <tr key={`${r.id}-${pi}`}>
                  <td className={p.side === 'cr' ? 'cr-acct' : ''}>{nameOf(p.accountId)}</td>
                  <td className="num">{p.side === 'dr' ? fmt(p.amount) : ''}</td>
                  <td className="num">{p.side === 'cr' ? fmt(p.amount) : ''}</td>
                </tr>
              )),
            ];
          })}
        </tbody>
      </table>
    </div>
  );
}
