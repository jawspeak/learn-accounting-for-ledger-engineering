import type { AccountId, TransactionRow } from '@contracts';
import { formatDollars } from './model';

/** Read-only journal-entry rendering of the same rows: Dr lines first, Cr lines indented (VISION-2 §5). */
export function JournalView({ rows, nameOf }: { rows: TransactionRow[]; nameOf(id: AccountId): string }) {
  return (
    <div className="tab-journal">
      {rows.length === 0 && <p className="tab-muted">No transactions yet.</p>}
      {rows.map((r, i) => {
        const lines = [...r.postings.filter((p) => p.side === 'dr'), ...r.postings.filter((p) => p.side === 'cr')];
        return (
          <table key={r.id} className="tab-journal-entry">
            <caption>
              {i + 1}. {r.label || `Transaction ${i + 1}`}
            </caption>
            <thead>
              <tr>
                <th scope="col">Account</th>
                <th scope="col">Dr</th>
                <th scope="col">Cr</th>
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 ? (
                <tr>
                  <td colSpan={3} className="tab-muted">
                    (empty)
                  </td>
                </tr>
              ) : (
                lines.map((p, j) => (
                  <tr key={j} className={p.side === 'cr' ? 'is-cr' : 'is-dr'}>
                    <td className="tab-journal-acct">
                      {p.side === 'dr' ? 'Dr ' : 'Cr '}
                      {nameOf(p.accountId)}
                    </td>
                    <td className="tab-num">{p.side === 'dr' ? formatDollars(p.amount) : ''}</td>
                    <td className="tab-num">{p.side === 'cr' ? formatDollars(p.amount) : ''}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        );
      })}
    </div>
  );
}
