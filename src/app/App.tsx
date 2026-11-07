import { sections } from '@content';
import { href, useRoute } from './router';
import { HomePage } from './pages/HomePage';
import { SectionPage } from './pages/SectionPage';
import { ProblemPage } from './pages/ProblemPage';
import { SandboxPage } from './sandbox/SandboxPage';
import { CheatSheetPage } from './pages/CheatSheetPage';

export function App() {
  const route = useRoute();
  return (
    <div className="layout">
      <nav className="sidebar" aria-label="Sections">
        <a className="brand" href={href.home()}>Accounting for Ledger Engineers</a>
        <ol>
          {sections.map((s) => (
            <li key={s.id}>
              <a href={href.section(s.id)} aria-current={route.name === 'section' && route.id === s.id ? 'page' : undefined}>
                {s.number < 99 ? `${s.number}. ` : ''}
                {s.title}
              </a>
            </li>
          ))}
        </ol>
        <a href={href.sandbox()}>Sandbox</a> · <a href={href.cheatsheet()}>Cheat sheet</a>
      </nav>
      <main className="content">
        {route.name === 'home' && <HomePage />}
        {route.name === 'section' && <SectionPage id={route.id} />}
        {route.name === 'problem' && <ProblemPage id={route.id} attempt={route.attempt} />}
        {route.name === 'sandbox' && <SandboxPage data={route.data} />}
        {route.name === 'cheatsheet' && <CheatSheetPage />}
        {route.name === 'not-found' && <p>Page not found. <a href={href.home()}>Go home</a></p>}
      </main>
    </div>
  );
}
