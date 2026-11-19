import { href } from './router';
import { problemNumber } from './problemNumber';
import { problems } from '@content';
import { sectionProgress, useProgress } from './progress';

/**
 * A thin bar across the top of every page: one segment per section (sized by its number of problems), each
 * split into one slot per problem — filled when solved, marked when tried. So you see what's left, not a %.
 * Each segment links to its section.
 */
export function ProgressBar({ currentSectionId }: { currentSectionId?: string }) {
  const store = useProgress();
  const secs = sectionProgress(store);
  const total = secs.reduce((n, s) => n + s.total, 0);
  const solved = secs.reduce((n, s) => n + s.solved, 0);
  return (
    <nav
      className="progress-bar"
      aria-label={`Your progress: ${solved} of ${total} problems solved`}
    >
      <ol>
        {secs.map((s) => (
          <li
            key={s.id}
            style={{ flexGrow: s.total }}
            className={s.id === currentSectionId ? 'is-current' : undefined}
          >
            <a
              href={href.section(s.id)}
              title={`${s.label}: ${s.solved} of ${s.total} solved${s.tried ? `, ${s.tried} tried` : ''}`}
              aria-label={`${s.label}: ${s.solved} of ${s.total} solved`}
            >
              {s.slots.map((x) => (
                <span
                  key={x.id}
                  className={`progress-slot${x.status ? ` is-${x.status}` : ''}`}
                  title={`${problemNumber(x.id)} ${problems[x.id]?.title ?? ''}${x.status === 'solved' ? ' ✓' : x.status === 'tried' ? ' (tried)' : ''}`}
                />
              ))}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
