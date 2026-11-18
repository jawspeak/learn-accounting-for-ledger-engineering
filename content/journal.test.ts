import { describe, expect, it } from 'vitest';
import { problems, sections } from '@content';
import { journalTotals, parseJournal } from '../src/app/journal';

/** Every fenced block in authored content, with its language tag. */
function blocks(): { where: string; lang: string; src: string }[] {
  const out: { where: string; lang: string; src: string }[] = [];
  const walk = (v: unknown, where: string) => {
    if (typeof v === 'string') {
      for (const m of v.matchAll(/```([a-z]*)\n([\s\S]*?)```/g))
        out.push({ where, lang: m[1]!, src: m[2]! });
    } else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${where}[${i}]`));
    else if (v && typeof v === 'object')
      for (const [k, x] of Object.entries(v)) walk(x, `${where}.${k}`);
  };
  sections.forEach((s) => walk(s, `section ${s.id}`));
  Object.values(problems).forEach((p) => walk(p, `problem ${p.id}`));
  return out;
}

const DR_CR_LINE = /^\s*(\(\d+\)\s*)?(Dr|Cr)\.?\s+\S.*\d\s*$/m;

describe('journal-entry sheets in content', () => {
  const all = blocks();
  const journals = all.filter((b) => b.lang === 'journal');

  it.each(journals.map((b) => [b.where, b.src] as const))(
    '%s parses and every entry balances',
    (_w, src) => {
      for (const e of parseJournal(src)) expect(journalTotals(e).dr).toBe(journalTotals(e).cr);
    },
  );

  it('no journal entry is left as a plain text block (use ```journal so it gets the standard look)', () => {
    const plain = all.filter((b) => b.lang === '' && DR_CR_LINE.test(b.src)).map((b) => b.where);
    expect(plain).toEqual([]);
  });
});
