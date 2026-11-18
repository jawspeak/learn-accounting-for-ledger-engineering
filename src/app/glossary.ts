/** Glossary lookup + the `[[term]]` / `[[text|term-id]]` marker used in authored markdown. */
import { glossary, type GlossaryTerm } from '../../content/glossary';

const byKey = new Map<string, GlossaryTerm>();
for (const t of glossary) {
  for (const k of [t.id, t.term, ...(t.aliases ?? [])]) byKey.set(k.toLowerCase(), t);
}

/** Resolve a marker's text or explicit id (case-insensitive) to a term. */
export const findTerm = (key: string): GlossaryTerm | undefined =>
  byKey.get(key.trim().toLowerCase());
export const termById = (id: string): GlossaryTerm | undefined => glossary.find((t) => t.id === id);

/** `[[Retained Earnings]]` or `[[RE|retained-earnings]]` (display text | term id or name). */
export const MARKER_RE = /^\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/;
/** Every marker in a text, for tests and the Definitions page's "used in" index. */
export const ALL_MARKERS_RE = /\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/g;

const esc = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** HTML for a marker: a real button (tap/click/keyboard — never hover-only). Unknown terms render as plain text. */
export function termHtml(text: string, key?: string): string {
  const t = findTerm(key ?? text);
  if (!t) return esc(text);
  return `<button type="button" class="gloss-term" data-gloss="${t.id}" aria-haspopup="dialog" aria-expanded="false" title="Definition: ${esc(t.term)}">${esc(text)}</button>`;
}
