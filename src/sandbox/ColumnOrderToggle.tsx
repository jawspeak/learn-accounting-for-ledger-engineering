import type { OrderMode } from './model';

/**
 * The account order, shared by every view and the Accounts panel:
 *  - Auto: the balance-sheet order (A = L + E, contras right after their parent);
 *  - By number: by GL account number (offered while codes are shown; unnumbered accounts follow in Auto order);
 *  - Manual: your own order, with ← → on every account (↑ ↓ in the Accounts list).
 */
export function ColumnOrderToggle({
  mode,
  disabled,
  byNumber,
  onChange,
}: {
  mode: OrderMode;
  disabled?: boolean;
  /** Offer "By number" (when GL numbers are shown). */
  byNumber?: boolean;
  onChange(mode: OrderMode): void;
}) {
  const options: [OrderMode, string, string][] = [
    [
      'auto',
      'Auto (A = L + E)',
      'Balance-sheet order: assets, then liabilities and equity (contras after their parent)',
    ],
    ...(byNumber || mode === 'number'
      ? ([['number', 'By number', 'By GL account number (accounts without one come last)']] as [
          OrderMode,
          string,
          string,
        ][])
      : []),
    [
      'manual',
      'Manual',
      'Your own order: move accounts with ← → in the Grid or ↑ ↓ in the Accounts list',
    ],
  ];
  return (
    <span className="vs-order" role="group" aria-label="Account order">
      <span className="vs-order-label">Account order</span>
      {options.map(([m, label, title]) => (
        <button
          key={m}
          type="button"
          aria-pressed={mode === m}
          disabled={disabled}
          title={title}
          onClick={() => onChange(m)}
        >
          {label}
        </button>
      ))}
    </span>
  );
}
