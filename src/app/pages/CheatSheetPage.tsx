import { CheatSheetBody } from '../CheatSheet';
import { useScrollToAt } from '../../lib/useScrollToAt';

export function CheatSheetPage({ at }: { at?: string }) {
  useScrollToAt(at);
  return (
    <article>
      <CheatSheetBody heading="h1" />
    </article>
  );
}
