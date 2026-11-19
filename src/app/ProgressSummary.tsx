import { href } from './router';
import { resetProgress, sectionProgress, useProgress } from './progress';

/** Home page: how far you are, per section, and a way to start over. Stored in this browser only. */
export function ProgressSummary() {
  const store = useProgress();
  const secs = sectionProgress(store);
  const total = secs.reduce((n, s) => n + s.total, 0);
  const solved = secs.reduce((n, s) => n + s.solved, 0);
  const tried = secs.reduce((n, s) => n + s.tried, 0);
  const next = secs.find((s) => s.solved < s.total);
  return (
    <section className="progress-summary" aria-labelledby="your-progress">
      <h2 id="your-progress">Your progress</h2>
      <p>
        <strong>
          {solved} of {total}
        </strong>{' '}
        problems solved{tried > 0 && <>, {tried} tried and not solved yet</>}.
        {next && solved > 0 && (
          <>
            {' '}
            Next up: <a href={href.section(next.id)}>{next.label}</a>.
          </>
        )}
      </p>
      {solved + tried > 0 && (
        <div className="progress-summary__sections">
          {secs
            .filter((s) => s.solved + s.tried > 0)
            .map((s) => (
              <div key={s.id} style={{ display: 'contents' }}>
                <a href={href.section(s.id)}>{s.label}</a>
                <span className="num">
                  {s.solved}/{s.total}
                </span>
              </div>
            ))}
        </div>
      )}
      <p className="progress-summary__note">
        Saved only in this browser — nothing is sent anywhere.{' '}
        {solved + tried > 0 && (
          <button
            type="button"
            onClick={() => {
              if (window.confirm('Reset all your progress? This clears it from this browser.'))
                resetProgress();
            }}
          >
            Reset progress
          </button>
        )}
      </p>
    </section>
  );
}
