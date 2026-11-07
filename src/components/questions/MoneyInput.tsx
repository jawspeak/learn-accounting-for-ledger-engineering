import { useState } from 'react';
import { parseAmount } from './EquationFill';

/** Whole-dollar text input that keeps the learner's raw text while typing ("1." stays "1."). `cents` is the stored value. */
export function MoneyInput({
  cents,
  onCents,
  label,
}: {
  cents: number | undefined;
  onCents(c: number | null): void;
  label: string;
}) {
  const [text, setText] = useState(cents === undefined ? '' : String(cents / 100));
  const parsed = parseAmount(text);
  const inSync = (parsed === null ? undefined : Math.round(parsed * 100)) === cents;
  const shown = inSync ? text : cents === undefined ? '' : String(cents / 100);
  return (
    <input
      className="money-input"
      inputMode="decimal"
      aria-label={label}
      value={shown}
      onChange={(e) => {
        setText(e.target.value);
        const n = parseAmount(e.target.value);
        onCents(n === null ? null : Math.round(n * 100));
      }}
    />
  );
}
