import { sections } from '@content';
import { href } from '../router';

export function HomePage() {
  return (
    <>
      <h1>Learn Accounting for Ledger Engineering</h1>
      <p>Jump anywhere. Nothing is gated or tracked. Every problem has a shareable link.</p>
      <ul>
        {sections.map((s) => (
          <li key={s.id}>
            <a href={href.section(s.id)}>{s.title}</a> — {s.summary}
          </li>
        ))}
      </ul>
    </>
  );
}
