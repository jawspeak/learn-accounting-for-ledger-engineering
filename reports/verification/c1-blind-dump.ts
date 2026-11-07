/* Blind dump for VER-2: prints problems in sections 00–06 WITHOUT answers.
 * Run: npx tsx reports/verification/c1-blind-dump.ts */
import you from '../../content/entities/you.ts';
import bank from '../../content/entities/bank.ts';
import s0 from '../../content/sections/00-start/index.ts';
import s1 from '../../content/sections/01-equation/index.ts';
import s2 from '../../content/sections/02-debits-credits/index.ts';
import s3 from '../../content/sections/03-t-accounts/index.ts';
import s4 from '../../content/sections/04-perspectives/index.ts';
import s5 from '../../content/sections/05-journal-entries/index.ts';
import s6 from '../../content/sections/06-loans/index.ts';

/* eslint-disable @typescript-eslint/no-explicit-any */
const ents: Record<string, any> = { you, bank };
const out: string[] = [];
const p = (s: string) => out.push(s);
for (const e of [you, bank]) {
  p(`## ENTITY ${e.id} (${e.kind}, ${e.basis})`);
  for (const a of e.accounts) p(`- ${a.id}: ${a.name}`); // types hidden
}
const rows = (rs: any[]) =>
  rs
    .map(
      (r) =>
        `  [${r.label ?? r.id}] ` +
        r.postings.map((x: any) => `${x.side.toUpperCase()} ${x.accountId} ${x.amount / 100}`).join(' | '),
    )
    .join('\n');
const bs = (b: any) => (b ? b.lines.map((l: any) => `${l.accountId}=${l.amount / 100}`).join(', ') : '(none)');
for (const m of [s0, s1, s2, s3, s4, s5, s6]) {
  const byId = Object.fromEntries(m.problems.map((q: any) => [q.id, q]));
  p(`\n# SECTION ${m.section.id} — ${m.section.title}`);
  for (const id of m.section.problemIds) {
    const q: any = byId[id];
    if (!q) {
      p(`\n### ${id} MISSING`);
      continue;
    }
    p(`\n### ${q.id} [${q.kind}/${q.role}/d${q.difficulty}] ${q.title}`);
    if (q.entityId) p(`entity: ${q.entityId}`);
    p(`PROMPT: ${q.prompt}`);
    if (q.kind === 'booking') {
      p(
        `opening: ${bs(q.opening)}; showBS=${q.showBalanceSheets} askAfterBS=${!!q.askAfterBalanceSheet} journal=${!!q.journalView} solutionRows=${q.solution.length}`,
      );
      if (q.prefill) p(`prefill (locked=${q.prefill.locked}):\n${rows(q.prefill.rows)}`);
      if (q.reference) p(`reference (${q.reference.entityId}) ${q.reference.caption}:\n${rows(q.reference.rows)}`);
      const coa = ents[q.entityId].accounts
        .filter((a: any) => !q.accountChoiceIds || q.accountChoiceIds.includes(a.id))
        .map((a: any) => a.name);
      const traps = (q.trapAccounts ?? []).map((t: any) => t.name);
      p(`picker: ${[...coa, ...traps].sort().join('; ')}`);
    } else if (q.kind === 'classify') {
      p(`buckets: ${q.buckets.join(', ')}`);
      q.items.forEach((it: any, i: number) => p(`  ${i + 1}. ${it.label}${it.entityId ? ` (books of ${it.entityId})` : ''}`));
    } else if (q.kind === 'dr-cr-predict') {
      q.items.forEach((it: any, i: number) => p(`  ${i + 1}. ${it.accountName} (${it.accountType}) ${it.change}`));
    } else if (q.kind === 'equation-fill') {
      q.items.forEach((it: any, i: number) => p(`  ${i + 1}. A=${it.assets ?? '?'} L=${it.liabilities ?? '?'} E=${it.equity ?? '?'}`));
    } else if (q.kind === 'statement-fill') {
      p(`statement: ${q.statement}; opening: ${bs(q.opening)}\n${rows(q.rows)}`);
    } else if (q.kind === 'multiple-choice') {
      p(`multi=${q.multi}`);
      q.options.forEach((o: any, i: number) => p(`  ${String.fromCharCode(65 + i)}. ${o.text}`));
    } else if (q.kind === 'coa-design') {
      q.candidates.forEach((c: any, i: number) => p(`  ${i + 1}. ${c.name}`));
    }
  }
}
console.log(out.join('\n'));
