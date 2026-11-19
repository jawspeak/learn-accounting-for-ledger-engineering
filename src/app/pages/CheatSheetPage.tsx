import { CheatSheetBody } from '../CheatSheet';
import { useScrollToAt } from '../useScrollToAt';

export function CheatSheetPage({ at }: { at?: string }) {
  useScrollToAt(at);
  return (
    <article>
      <CheatSheetBody heading="h1" />
    </article>
  );
}
