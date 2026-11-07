import { animationDefs } from './definitions';
import { LedgerAnimation } from './LedgerStage';

/** Dev-only: renders every animation for review. Not linked from the app. */
export function AnimationGallery() {
  return (
    <div className="anim-gallery">
      <h1>Animation gallery</h1>
      <nav className="anim-gallery__nav" aria-label="Animations">
        {animationDefs.map((d) => (
          <a key={d.id} href={`#anim-${d.id}`}>
            {d.title} <code>{d.id}</code>
          </a>
        ))}
      </nav>
      {animationDefs.map((d) => (
        <section key={d.id} id={`anim-${d.id}`}>
          <h2>
            {d.title} <code>{d.id}</code>
          </h2>
          <LedgerAnimation def={d} />
        </section>
      ))}
    </div>
  );
}
