import { describe, expect, it } from 'vitest';
import { problems, sections } from '@content';
import { parseTAccounts } from '../src/app/taccount';

/** Every ```taccount block in authored content must parse (a typo would otherwise render as an error box). */
function blocks(): { where: string; src: string }[] {
  const out: { where: string; src: string }[] = [];
  const walk = (v: unknown, where: string) => {
    if (typeof v === 'string') {
      for (const m of v.matchAll(/```taccount\n([\s\S]*?)```/g)) out.push({ where, src: m[1]! });
    } else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${where}[${i}]`));
    else if (v && typeof v === 'object')
      for (const [k, x] of Object.entries(v)) walk(x, `${where}.${k}`);
  };
  sections.forEach((s) => walk(s, `section ${s.id}`));
  Object.values(problems).forEach((p) => walk(p, `problem ${p.id}`));
  return out;
}

describe('T-account ledgers in content', () => {
  const found = blocks();
  it('includes the §3 primer example', () => {
    expect(found.some((b) => b.where === 'section 03-t-accounts.primer')).toBe(true);
  });
  it.each(found.map((b) => [b.where, b.src] as const))('%s parses', (_w, src) => {
    expect(parseTAccounts(src).length).toBeGreaterThan(0);
  });
});
