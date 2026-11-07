/* Blind dump for VER-1 / C2: prints problems in sections 07–12 + Mixed Review WITHOUT answers.
 * Run: npx tsx reports/verification/c2-blind-dump.ts */
import you from '../../content/entities/you.ts';
import bank from '../../content/entities/bank.ts';
import coffee from '../../content/entities/coffee.ts';
import zap from '../../content/entities/zap.ts';
import s7 from '../../content/sections/07-revenue-expenses/index.ts';
import s8 from '../../content/sections/08-accruals/index.ts';
import s9 from '../../content/sections/09-contra/index.ts';
import s10 from '../../content/sections/10-processes/index.ts';
import s11 from '../../content/sections/11-fintech/index.ts';
import s12 from '../../content/sections/12-capstone/index.ts';
import rv from '../../content/review/index.ts';

/* eslint-disable @typescript-eslint/no-explicit-any */
const ents: Record<string, any> = { you, bank, coffee, zap };
const out: string[] = [];
const p = (s: string) => out.push(s);
for (const e of [you, bank, coffee, zap] as any[]) {
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
for (const m of [s7, s8, s9, s10, s11, s12, rv] as any[]) {
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
      q.items.forEach((it: any, i: number) =>
        p(`  ${i + 1}. ${it.label}${it.entityId ? ` (books of ${it.entityId})` : ''}`),
      );
    } else if (q.kind === 'dr-cr-predict') {
      q.items.forEach((it: any, i: number) => p(`  ${i + 1}. ${it.accountName} (${it.accountType}) ${it.change}`));
    } else if (q.kind === 'equation-fill') {
      q.items.forEach((it: any, i: number) =>
        p(`  ${i + 1}. A=${it.assets ?? '?'} L=${it.liabilities ?? '?'} E=${it.equity ?? '?'}`),
      );
    } else if (q.kind === 'statement-fill') {
      // The UI lists the expected answer's account ids (no amounts/sides), so print ids only.
      const ids =
        q.statement === 'trial-balance'
          ? (q.answer.trialBalance ?? []).map((l: any) => l.accountId)
          : (q.answer.balanceSheet?.lines ?? []).map((l: any) => l.accountId);
      p(`statement: ${q.statement}; opening: ${bs(q.opening)}\n${rows(q.rows)}\nlines to fill: ${ids.join(', ')}`);
    } else if (q.kind === 'multiple-choice') {
      p(`multi=${q.multi}`);
      q.options.forEach((o: any, i: number) => p(`  ${String.fromCharCode(65 + i)}. ${o.text}`));
    } else if (q.kind === 'coa-design') {
      q.candidates.forEach((c: any, i: number) => p(`  ${i + 1}. ${c.name}`));
    }
  }
}
console.log(out.join('\n'));
