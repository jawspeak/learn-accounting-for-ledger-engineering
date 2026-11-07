import { sections, sectionProblems } from '@content';
import { Markdown } from '../Markdown';
import { href } from '../router';

/** Phase-0 skeleton. SHELL builds the full template (primer / worked / faded / problems / review / lens). */
export function SectionPage({ id }: { id: string }) {
  const section = sections.find((s) => s.id === id);
  if (!section) return <p>Unknown section.</p>;
  return (
    <article>
      <h1>{section.title}</h1>
      <Markdown text={section.primer} />
      <h2>Problems</h2>
      <ol>
        {sectionProblems(section).map((p) => (
          <li key={p.id}>
            <a href={href.problem(p.id)}>{p.title}</a>
          </li>
        ))}
      </ol>
    </article>
  );
}
