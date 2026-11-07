import { sections, sectionProblems } from '@content';
import { Markdown } from '../Markdown';
import { href } from '../router';
import { DifficultyBadge, KindBadge, ROLE_BLURB, ROLE_LABEL, ROLE_ORDER } from '../badges';

const isStub = (md: string) => /^\s*_?coming soon\.?_?\s*$/i.test(md);

export function SectionPage({ id }: { id: string }) {
  const idx = sections.findIndex((s) => s.id === id);
  const section = sections[idx];
  if (!section)
    return (
      <p>
        Unknown section. <a href={href.home()}>Go home</a>
      </p>
    );
  const prev = sections[idx - 1];
  const next = sections[idx + 1];
  const probs = sectionProblems(section);
  const noPrimer = isStub(section.primer);

  return (
    <article>
      <div className="breadcrumb">
        <a href={href.home()}>Home</a> /{' '}
        {section.id === 'review' ? 'Review' : `Section ${section.number}`}
      </div>
      <h1>{section.title}</h1>
      <p className="note" style={{ marginTop: 0 }}>
        {section.summary}
      </p>

      <div className="section-grid">
        <div>
          {noPrimer && probs.length === 0 ? (
            <p>
              <span className="badge coming">Coming soon</span> This section is still being written.
              Meanwhile, you can <a href={href.sandbox()}>experiment in the sandbox</a> or check the
              cheat sheet.
            </p>
          ) : (
            <>
              {!noPrimer && (
                <section className="primer" aria-label="Primer">
                  <Markdown text={section.primer} />
                </section>
              )}
              {(section.callouts ?? []).map((c, i) => (
                <aside key={i} className="callout" aria-label={c.title}>
                  <h3>{c.title}</h3>
                  <Markdown text={c.body} />
                </aside>
              ))}
            </>
          )}

          {ROLE_ORDER.map((role) => {
            const group = probs.filter((p) => p.role === role);
            if (group.length === 0) return null;
            return (
              <section key={role} className="problem-group" aria-labelledby={`g-${role}`}>
                <h2 id={`g-${role}`}>
                  {ROLE_LABEL[role]}
                  {group.length > 1 ? 's' : ''}
                </h2>
                <p className="note">{ROLE_BLURB[role]}</p>
                <ul className="problem-list">
                  {group.map((p) => (
                    <li key={p.id}>
                      <a className="row" href={href.problem(p.id)}>
                        <span className="title">{p.title}</span>
                        <KindBadge kind={p.kind} />
                        <DifficultyBadge level={p.difficulty} />
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
          {probs.length === 0 && !noPrimer && (
            <p className="note">
              <span className="badge coming">Coming soon</span> Problems for this section are on the
              way.
            </p>
          )}
        </div>

        {section.lens && (
          <aside className="callout lens" aria-label="Ledger engineer's lens">
            <h3>Ledger engineer’s lens</h3>
            <Markdown text={section.lens} />
          </aside>
        )}
      </div>

      <nav className="pager" aria-label="Section navigation">
        {prev ? (
          <a className="btn" href={href.section(prev.id)}>
            ← {prev.title}
          </a>
        ) : (
          <span />
        )}
        {next ? (
          <a className="btn" href={href.section(next.id)}>
            {next.title} →
          </a>
        ) : (
          <span />
        )}
      </nav>
    </article>
  );
}
