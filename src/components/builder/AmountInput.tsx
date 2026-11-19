import { useState, type InputHTMLAttributes } from 'react';
import type { Money } from '@contracts';
import { centsToInput, parseDollars } from './model';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  cents: Money;
  /** `blank` is true when the field was emptied (vs. an explicit 0). */
  onCentsChange(cents: Money, blank: boolean): void;
  allowNegative?: boolean;
  /** Accept dollars and cents ("44.24"); otherwise whole dollars only (problems). */
  allowCents?: boolean;
  /** Show an explicit "0" instead of an empty field for a zero value. */
  showZero?: boolean;
};

/**
 * Dollar input that stores integer cents: whole dollars, or dollars and cents with `allowCents`. Other keystrokes
 * are rejected; the draft text is kept while editing so "-", "1,0" or "44." don't get reformatted under the cursor.
 */
export function AmountInput({
  cents,
  onCentsChange,
  allowNegative,
  allowCents,
  showZero,
  onFocus,
  onBlur,
  ...rest
}: Props) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = showZero && cents === 0 ? '0' : centsToInput(cents);
  return (
    <input
      type="text"
      inputMode={allowNegative ? 'text' : allowCents ? 'decimal' : 'numeric'}
      autoComplete="off"
      {...rest}
      value={draft ?? shown}
      onFocus={(e) => {
        setDraft(shown);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setDraft(null);
        onBlur?.(e);
      }}
      onChange={(e) => {
        const parsed = parseDollars(e.target.value, { allowNegative, allowCents });
        if (parsed === null) return;
        const blank = e.target.value.trim() === '';
        setDraft(e.target.value);
        if (parsed !== cents || blank !== (shown === '')) onCentsChange(parsed, blank);
      }}
    />
  );
}
