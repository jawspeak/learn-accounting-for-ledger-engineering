import { Fragment, type ReactNode } from 'react';
import { CheatSheetSvg } from './CheatSheet';
import { Markdown } from './Markdown';
import { href } from './router';

/**
 * Figures authored markdown can place with a marker on its own line: `<!-- figure:cheat-sheet -->`.
 * Unknown names render nothing (the marker is an HTML comment, so plain <Markdown> shows nothing either).
 */
const FIGURES: Record<string, () => ReactNode> = {
  'cheat-sheet': () => (
    <figure className="primer-figure">
      <CheatSheetSvg />
      <figcaption>
        Each T shades the side that <strong>increases</strong> it: assets on the left (debit),
        liabilities and equity on the right (credit). Revenue feeds equity, so it’s credit-normal;
        expenses and dividends reduce it, so they’re debit-normal.{' '}
        <strong>You can open this any time</strong> with the <strong>Cheat sheet</strong> button at
        the top of every page, or see the <a href={href.cheatsheet()}>full cheat sheet</a>.
      </figcaption>
    </figure>
  ),
};
const FIGURE_MARKER = /^\s*<!--\s*figure:([a-z0-9-]+)\s*-->\s*$/m;

/** Markdown with any figure markers replaced by their React figures (primers, key concepts…). */
export function RichMarkdown({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  let rest = text;
  for (let m = FIGURE_MARKER.exec(rest); m; m = FIGURE_MARKER.exec(rest)) {
    const before = rest.slice(0, m.index);
    if (before.trim()) parts.push(<Markdown key={parts.length} text={before} />);
    const fig = FIGURES[m[1]!];
    if (fig) parts.push(<Fragment key={parts.length}>{fig()}</Fragment>);
    rest = rest.slice(m.index + m[0].length);
  }
  if (rest.trim()) parts.push(<Markdown key={parts.length} text={rest} />);
  return <>{parts}</>;
}
