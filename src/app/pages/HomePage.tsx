import { sections, sectionProblems } from '@content';
import { href } from '../router';

export function HomePage() {
  return (
    <>
      <h1>Learn Accounting for Ledger Engineering</h1>
      <p style={{ fontFamily: 'var(--font-serif)', fontSize: 'var(--text-lg)', maxWidth: '40rem' }}>
        Double-entry bookkeeping, taught by <em>doing it</em>. You build T-accounts and journal
        entries for a person, a bank, a coffee shop and a fintech, and the site tells you exactly
        what is off and why. Made for engineers who build ledgers and want the accounting underneath
        to click.
      </p>
      <div className="toolbar">
        <a className="btn primary" href={href.section('00-start')}>
          Start at the beginning
        </a>
        <a className="btn" href={href.cheatsheet()}>
          Cheat sheet
        </a>
        <a className="btn" href={href.sandbox()}>
          Open the sandbox
        </a>
      </div>

      <section aria-labelledby="how">
        <h2 id="how">How to use this</h2>
        <ul className="steps">
          <li>
            <strong>Jump anywhere.</strong> Nothing is locked and nothing is tracked. Pick any
            section from the menu.
          </li>
          <li>
            <strong>Stuck? Ask for a hint.</strong> Hints are Socratic: they nudge, they don’t give
            the answer away.
          </li>
          <li>
            <strong>Check, then reveal as little as you need.</strong> Feedback unfolds in levels:
            how many parts are right, where the problem is, what kind of mistake, an explanation,
            and finally the full solution.
          </li>
          <li>
            <strong>Share your attempt.</strong> “Copy link” saves your current answer in the URL so
            anyone can open exactly what you see.
          </li>
          <li>
            <strong>Experiment in the sandbox.</strong> Any booking problem can be opened there to
            try variations.
          </li>
        </ul>
      </section>

      <section aria-labelledby="secs">
        <h2 id="secs">Sections</h2>
        <ul className="card-grid">
          {sections.map((s) => {
            const n = sectionProblems(s).length;
            return (
              <li key={s.id}>
                <a className="card" href={href.section(s.id)}>
                  <span className="num">
                    {s.id === 'review' ? 'Review' : `Section ${s.number}`}
                  </span>
                  <h3>{s.title}</h3>
                  <p>{s.summary}</p>
                  <p style={{ marginTop: 'var(--space-2)' }}>
                    {n > 0 ? (
                      `${n} problem${n === 1 ? '' : 's'}`
                    ) : (
                      <span className="badge coming">Coming soon</span>
                    )}
                  </p>
                </a>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
