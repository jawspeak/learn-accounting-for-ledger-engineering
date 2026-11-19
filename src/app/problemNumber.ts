import { problems, sections } from '@content';

/**
 * One short, stable label for a problem, used everywhere it appears (section lists, problem header, pager):
 * "<section number>.<position>" — e.g. 5.7 = the 7th problem of §5; Mixed Review uses "R" (R.3).
 */
export function problemNumber(problemId: string): string | undefined {
  const p = problems[problemId];
  const s = p && sections.find((x) => x.id === p.sectionId);
  if (!s) return undefined;
  const i = s.problemIds.indexOf(problemId);
  if (i < 0) return undefined;
  return `${s.id === 'review' ? 'R' : s.number}.${i + 1}`;
}
