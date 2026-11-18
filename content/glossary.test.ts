import { describe, expect, it } from 'vitest';
import { problems, sections } from '@content';
import { glossary } from './glossary';
import { ALL_MARKERS_RE, findTerm } from '../src/app/glossary';

/** Every string in authored content + the glossary's own definitions. */
function strings(): { where: string; text: string }[] {
  const out: { where: string; text: string }[] = [];
  const walk = (v: unknown, where: string) => {
    if (typeof v === 'string') out.push({ where, text: v });
    else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${where}[${i}]`));
    else if (v && typeof v === 'object')
      for (const [k, x] of Object.entries(v)) walk(x, `${where}.${k}`);
  };
  sections.forEach((s) => walk(s, `section ${s.id}`));
  Object.values(problems).forEach((p) => walk(p, `problem ${p.id}`));
  glossary.forEach((t) => walk(t.definition, `glossary ${t.id}`));
  return out;
}

describe('glossary', () => {
  it('ids are unique and kebab-case; no alias points at two terms', () => {
    const ids = glossary.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
    const owner = new Map<string, string>();
    for (const t of glossary)
      for (const k of [t.term, ...(t.aliases ?? [])].map((x) => x.toLowerCase())) {
        expect(owner.get(k) ?? t.id, `"${k}" is claimed by ${owner.get(k)} and ${t.id}`).toBe(t.id);
        owner.set(k, t.id);
      }
  });

  it('every [[marker]] in content and definitions resolves to a term', () => {
    const unresolved: string[] = [];
    for (const { where, text } of strings())
      for (const m of text.matchAll(ALL_MARKERS_RE))
        if (!findTerm(m[2] ?? m[1]!)) unresolved.push(`${where}: [[${m[0]}]]`);
    expect(unresolved).toEqual([]);
  });

  it('every term is used in the teaching text at least once, or linked from another definition', () => {
    const used = new Set<string>();
    for (const { text } of strings())
      for (const m of text.matchAll(ALL_MARKERS_RE)) used.add(findTerm(m[2] ?? m[1]!)!.id);
    expect(glossary.filter((t) => !used.has(t.id)).map((t) => t.id)).toEqual([]);
  });

  it('problem prompts and choices carry no markers (a definition there could give the answer away)', () => {
    const leaks = strings()
      .filter(
        (s) =>
          s.where.startsWith('problem ') &&
          /\.(prompt|options|items|candidates|buckets)/.test(s.where),
      )
      .filter((s) => s.text.includes('[['))
      .map((s) => s.where);
    expect(leaks).toEqual([]);
  });
});
