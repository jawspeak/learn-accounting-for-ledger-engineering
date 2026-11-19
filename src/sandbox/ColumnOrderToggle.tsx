import './viewSwitch.css';

/**
 * One account order for the whole Sandbox, in both views: Auto = the conventional balance-sheet order
 * (A = L + E, contras right after their parent); Manual = your own order, with ◀ ▶ on every account.
 */
export function ColumnOrderToggle({
  manual,
  onChange,
  disabled,
}: {
  manual: boolean;
  onChange(manual: boolean): void;
  disabled?: boolean;
}) {
  return (
    <span className="vs-order" role="group" aria-label="Account order">
      <span className="vs-order-label">Account order</span>
      <button
        type="button"
        aria-pressed={!manual}
        disabled={disabled}
        title="Balance-sheet order: assets, then liabilities and equity (contras after their parent)"
        onClick={() => onChange(false)}
      >
        Auto (A = L + E)
      </button>
      <button
        type="button"
        aria-pressed={manual}
        disabled={disabled}
        title="Your own order: move accounts with ◀ ▶ (in either view)"
        onClick={() => onChange(true)}
      >
        Manual
      </button>
    </span>
  );
}
