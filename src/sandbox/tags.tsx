import { useState } from 'react';

/** Tags are short labels for discussion ("GL Acct", "review"…), any number per account, used as people see fit. */
const MAX = 10;
/** A tag as shown: its first 10 characters, then "…" when longer (the whole tag is the tooltip). */
export const shortTag = (t: string) => (t.length > MAX ? `${t.slice(0, MAX)}…` : t);

/** An account's tags as small chips, beside its name in every view. */
export function TagChips({ tags }: { tags?: string[] }) {
  if (!tags?.length) return null;
  return (
    <span className="sbx-tags" aria-label={`Tags: ${tags.join(', ')}`}>
      {tags.map((t) => (
        <span key={t} className="sbx-tag" title={t} aria-hidden="true">
          {shortTag(t)}
        </span>
      ))}
    </span>
  );
}

/** Edit tags as comma-separated text: "GL Acct, review". Saved as you type; tidied (trimmed, no repeats) on save. */
export function TagsInput({
  tags,
  onTags,
  label,
  className,
  placeholder = 'tags, comma-separated',
}: {
  tags?: string[];
  onTags(tags: string[]): void;
  label: string;
  className?: string;
  placeholder?: string;
}) {
  // Keep the text being typed (a trailing ", " included) until the field loses focus.
  const [draft, setDraft] = useState<string | null>(null);
  const text = (tags ?? []).join(', ');
  return (
    <input
      className={className}
      aria-label={label}
      placeholder={placeholder}
      value={draft ?? text}
      onFocus={() => setDraft(text)}
      onBlur={() => setDraft(null)}
      onChange={(e) => {
        setDraft(e.target.value);
        onTags(e.target.value.split(','));
      }}
    />
  );
}
