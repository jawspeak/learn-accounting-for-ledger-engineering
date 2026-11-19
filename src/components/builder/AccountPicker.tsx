import { useId, useRef, useState, type KeyboardEvent } from 'react';
import type { Account, AccountId, AccountType } from '@contracts';
import { PICKER_TYPES, rankAccounts, typeLabel } from './model';

export interface AccountPickerProps {
  /** All choices, already in deterministic (alphabetical) order. */
  accounts: Account[];
  /**
   * Sandbox: list only accounts of the type chosen in step 1. Problems leave this off — there the list is the
   * full, unfiltered CoA, so picking a name of the wrong type stays a diagnosable choice.
   */
  filterByType?: boolean;
  /** Accounts that already have a column (picking one again just changes its type). */
  existing: Set<AccountId>;
  /** Types offered in step 1 (defaults to every picker type). */
  types?: AccountType[];
  /** Sandbox: allow creating a new account from the search text. */
  allowCreate?: boolean;
  onPick(accountId: AccountId, type: AccountType): void;
  onCreate?(name: string, type: AccountType): void;
  /** Close the picker (Escape / Cancel). */
  onCancel(): void;
  /** "Enter amounts" after adding: close and move on to typing the new account's amount. */
  onFinish?(): void;
}

type Option = { kind: 'account'; account: Account } | { kind: 'create'; name: string };

const withArticle = (label: string) => `${/^[aeiou]/i.test(label) ? 'an' : 'a'} ${label}`;

/**
 * Two-step picker (VISION-2 §5): commit to a type first, then pick from the full, unfiltered account list.
 * The list shows names only — no type labels — so a type/name mismatch stays a diagnosable choice.
 *
 * Three clear states, so it never shows an empty field that looks like "type a name here":
 * 1. choose a type → 2. pick the account from the list → ✓ added (Enter amounts | Add another account).
 * The type resets for every account on purpose: each account's type is its own decision.
 */
export function AccountPicker({
  accounts,
  filterByType,
  existing,
  types,
  allowCreate,
  onPick,
  onCreate,
  onCancel,
  onFinish,
}: AccountPickerProps) {
  const uid = useId();
  const [type, setType] = useState<AccountType | null>(null);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [added, setAdded] = useState<{ name: string; type: AccountType } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const typesRef = useRef<HTMLFieldSetElement>(null);
  const finishRef = useRef<HTMLButtonElement>(null);

  const typeChoices = types
    ? types.map((t) => PICKER_TYPES.find((p) => p.type === t) ?? { type: t, label: typeLabel(t) })
    : PICKER_TYPES;

  const q = query.trim().toLowerCase();
  const pool = filterByType && type ? accounts.filter((a) => a.type === type) : accounts;
  const options: Option[] = rankAccounts(pool, query).map((account) => ({
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
    setAdded({ name, type });
    setType(null);
    setQuery('');
    setActive(0);
    queueMicrotask(() => finishRef.current?.focus());
  };

  const addAnother = () => {
    setAdded(null);
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
        // First Escape clears the filter; the next one (handled by the group) closes the picker.
        if (query) {
          e.preventDefault();
          e.stopPropagation();
          setQuery('');
        }
        break;
    }
  };

  const groupKeys = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape' && !e.defaultPrevented) {
      e.preventDefault();
      onCancel();
    }
  };

  if (added)
    return (
      <div
        className="tab-picker tab-picker-done"
        role="group"
        aria-label="Add a T-account"
        onKeyDown={groupKeys}
      >
        <p className="tab-picker-added" role="status">
          <span aria-hidden="true">✓ </span>
          Added <strong>{added.name}</strong> as {withArticle(typeLabel(added.type))}.{' '}
          <span className="tab-picker-next">Next: type its amount on the Dr or Cr side.</span>
        </p>
        <div className="tab-picker-actions">
          <button
            type="button"
            ref={finishRef}
            className="tab-picker-primary"
            onClick={() => (onFinish ?? onCancel)()}
          >
            Enter amounts
          </button>
          <button type="button" onClick={addAnother}>
            <span aria-hidden="true">＋ </span>Add another account
          </button>
        </div>
      </div>
    );

  return (
    <div className="tab-picker" role="group" aria-label="Add a T-account" onKeyDown={groupKeys}>
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
        {type === null ? (
          <>
            <p className="tab-picker-step2-title">2. Pick the account from the list</p>
            <p className="tab-picker-note">
              Choose a type first — then the list of accounts appears here.
            </p>
          </>
        ) : (
          <>
            <label htmlFor={`${uid}-input`}>2. Pick the account from the list</label>
            <input
              ref={inputRef}
              id={`${uid}-input`}
              type="text"
              role="combobox"
              autoComplete="off"
              aria-autocomplete="list"
              aria-expanded
              aria-controls={listId}
              aria-activedescendant={options.length ? optId(activeIdx) : undefined}
              placeholder={allowCreate ? 'Filter, or type a new account name…' : 'Filter the list…'}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={onKeyDown}
            />
            <ul id={listId} role="listbox" aria-label="Accounts" className="tab-picker-list">
              {options.length === 0 && (
                <li className="tab-picker-empty" role="presentation">
                  {filterByType && type && pool.length === 0
                    ? `No ${typeChoices.find((t) => t.type === type)?.label.toLowerCase() ?? type} accounts yet${allowCreate ? ' — type a name to create one.' : '.'}`
                    : 'No matching accounts.'}
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
                        <span className="tab-picker-tag">
                          {filterByType ? ' (already a column)' : ' (already added — sets its type)'}
                        </span>
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
          </>
        )}
      </div>
      <div className="tab-picker-actions">
        <span />
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
