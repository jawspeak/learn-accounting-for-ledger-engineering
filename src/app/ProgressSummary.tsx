import { resetProgress, sectionProgress, useProgress } from './progress';

/** Bottom of the left nav: how far you are, and a small way to start over. Stored in this browser only. */
export function ProgressSummary() {
  const store = useProgress();
  const secs = sectionProgress(store);
  const total = secs.reduce((n, s) => n + s.total, 0);
  const solved = secs.reduce((n, s) => n + s.solved, 0);
  const tried = secs.reduce((n, s) => n + s.tried, 0);
  return (
    <section className="progress-summary" aria-label="Your progress">
      <p className="progress-summary__count">
        <strong>Your progress:</strong> {solved} of {total} solved
        {tried > 0 && <>, {tried} tried</>}
      </p>
      <p className="progress-summary__note">
        Saved only in this browser.
        {solved + tried > 0 && (
          <>
            {' '}
            <button
              type="button"
              className="link-btn"
              onClick={() => {
                if (window.confirm('Reset all your progress? This clears it from this browser.'))
                  resetProgress();
              }}
            >
              Reset
            </button>
          </>
        )}
      </p>
    </section>
  );
}
