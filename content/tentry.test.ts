import { describe, expect, it } from 'vitest';
import { problems, sections } from '@content';
import { parseTEntry, totals } from '../src/app/tentry';

/** Every ```tentry block anywhere in authored content (primers, callouts, lenses, problems, explanations…). */
function blocks(): { where: string; src: string }[] {
  const out: { where: string; src: string }[] = [];
  const walk = (v: unknown, where: string) => {
    if (typeof v === 'string') {
      for (const m of v.matchAll(/```tentry\n([\s\S]*?)```/g)) out.push({ where, src: m[1]! });
    } else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${where}[${i}]`));
    else if (v && typeof v === 'object')
      for (const [k, x] of Object.entries(v)) walk(x, `${where}.${k}`);
  };
  sections.forEach((s) => walk(s, `section ${s.id}`));
  Object.values(problems).forEach((p) => walk(p, `problem ${p.id}`));
  return out;
}

describe('T-account entry figures in content', () => {
  const found = blocks();
  it('there is at least one (the §6 repayment)', () => {
    expect(found.some((b) => b.where.startsWith('section 06-loans'))).toBe(true);
  });
  it.each(found.map((b) => [b.where, b.src] as const))(
    '%s parses and every event balances',
    (_where, src) => {
      const events = parseTEntry(src);
      expect(events.length).toBeGreaterThan(0);
      for (const e of events) expect(totals(e).dr).toBe(totals(e).cr);
    },
  );
});
