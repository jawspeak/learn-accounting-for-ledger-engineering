import { useId, useRef, useState, type KeyboardEvent } from 'react';
import type { Account, AccountId, AccountType } from '@contracts';
import { PICKER_TYPES, rankAccounts, typeLabel } from './model';

export interface AccountPickerProps {
  /** All choices, already in deterministic (alphabetical) order. Never filtered by type. */
  accounts: Account[];
  /** Accounts that already have a column (picking one again just changes its type). */
  existing: Set<AccountId>;
  /** Types offered in step 1 (defaults to every picker type). */
  types?: AccountType[];
  /** Sandbox: allow creating a new account from the search text. */
  allowCreate?: boolean;
  onPick(accountId: AccountId, type: AccountType): void;
  onCreate?(name: string, type: AccountType): void;
  /** Close the picker ("Done" / Escape). */
  onCancel(): void;
}

type Option = { kind: 'account'; account: Account } | { kind: 'create'; name: string };

/**
 * Two-step picker (VISION-2 §5): commit to a type first, then search the full, unfiltered account list.
 * The list shows names only — no type labels — so a type/name mismatch stays a diagnosable choice.
 *
 * It stays open after each pick so several accounts can be added in a row. The type resets every time on
 * purpose: each account's type is its own decision (that's the point of choosing it first).
 */
export function AccountPicker({
  accounts,
  existing,
  types,
  allowCreate,
  onPick,
  onCreate,
  onCancel,
}: AccountPickerProps) {
  const uid = useId();
  const [type, setType] = useState<AccountType | null>(null);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [added, setAdded] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const typesRef = useRef<HTMLFieldSetElement>(null);

  const typeChoices = types
    ? types.map((t) => PICKER_TYPES.find((p) => p.type === t) ?? { type: t, label: typeLabel(t) })
    : PICKER_TYPES;

  const q = query.trim().toLowerCase();
  const options: Option[] = rankAccounts(accounts, query).map((account) => ({
    kind: 'account',
    account,
  }));
  if (allowCreate && q !== '' && !accounts.some((a) => a.name.toLowerCase() === q))
    options.push({ kind: 'create', name: query.trim() });
  const activeIdx = Math.min(active, Math.max(0, options.length - 1));
  const listId = `${uid}-list`;
  const optId = (i: number) => `${uid}-opt-${i}`;

  const choose = (opt: Option | undefined) => {
    if (!opt || !type) return;
    const name = opt.kind === 'account' ? opt.account.name : opt.name;
    if (opt.kind === 'account') onPick(opt.account.id, type);
    else onCreate?.(opt.name, type);
    setAdded(`Added ${name} as ${typeLabel(type)}.`);
    setType(null);
    setQuery('');
    setActive(0);
    // Back to step 1 for the next account.
    queueMicrotask(() => typesRef.current?.querySelector<HTMLInputElement>('input')?.focus());
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActive(Math.min(options.length - 1, activeIdx + 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActive(Math.max(0, activeIdx - 1));
        break;
      case 'Home':
        e.preventDefault();
        setActive(0);
        break;
      case 'End':
        e.preventDefault();
        setActive(Math.max(0, options.length - 1));
        break;
      case 'Enter':
        e.preventDefault();
        choose(options[activeIdx]);
        break;
      case 'Escape':
        // First Escape clears the search; the next one (handled by the group) closes the picker.
        if (query) {
          e.preventDefault();
          e.stopPropagation();
          setQuery('');
        }
        break;
    }
  };

  return (
    <div
      className="tab-picker"
      role="group"
      aria-label="Add a T-account"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && !e.defaultPrevented) {
          e.preventDefault();
          onCancel();
        }
      }}
    >
      <fieldset className="tab-picker-types" ref={typesRef}>
        <legend>1. What type of account is it?</legend>
        <div className="tab-picker-type-grid">
          {typeChoices.map((t) => (
            <label key={t.type} className={type === t.type ? 'is-selected' : undefined}>
              <input
                type="radio"
                name={`${uid}-type`}
                value={t.type}
                checked={type === t.type}
                onChange={() => {
                  setType(t.type);
                  setAdded(null);
                  // Move straight on to step 2 for keyboard users.
                  queueMicrotask(() => inputRef.current?.focus());
                }}
              />
              {t.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="tab-picker-name">
        <label htmlFor={`${uid}-input`}>2. Which account?</label>
        <input
          ref={inputRef}
          id={`${uid}-input`}
          type="text"
          role="combobox"
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={type !== null}
          aria-controls={listId}
          aria-activedescendant={type && options.length ? optId(activeIdx) : undefined}
          aria-describedby={type ? undefined : `${uid}-needtype`}
          disabled={type === null}
          placeholder={
            type
              ? allowCreate
                ? 'Search or type a new name…'
                : 'Search accounts…'
              : 'Choose a type first'
          }
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
        />
        {type === null && (
          <p id={`${uid}-needtype`} className="tab-picker-note">
            Commit to a type first — then pick the name.
          </p>
        )}
        {type !== null && (
          <ul id={listId} role="listbox" aria-label="Accounts" className="tab-picker-list">
            {options.length === 0 && (
              <li className="tab-picker-empty" role="presentation">
                No matching accounts.
              </li>
            )}
            {options.map((opt, i) => (
              <li
                key={opt.kind === 'account' ? opt.account.id : '__create'}
                id={optId(i)}
                role="option"
                aria-selected={i === activeIdx}
                className={i === activeIdx ? 'is-active' : undefined}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(opt)}
              >
                {opt.kind === 'account' ? (
                  <>
                    {opt.account.name}
                    {existing.has(opt.account.id) && (
                      <span className="tab-picker-tag"> (already added — sets its type)</span>
                    )}
                  </>
                ) : (
                  <>
                    <span aria-hidden="true">＋ </span>Create account “{opt.name}”
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="tab-picker-actions">
        <span role="status" className="tab-picker-added">
          {added && (
            <>
              <span aria-hidden="true">✓ </span>
              {added} Add another, or Done.
            </>
          )}
        </span>
        <button type="button" onClick={onCancel}>
          Done
        </button>
      </div>
    </div>
  );
}
