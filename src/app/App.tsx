import { useCallback, useState } from 'react';
import { sections } from '@content';
import { href, useRoute } from './router';
import { HomePage } from './pages/HomePage';
import { SectionPage } from './pages/SectionPage';
import { ProblemPage } from './pages/ProblemPage';
import { SandboxPage } from './sandbox/SandboxPage';
import { CheatSheetPage } from './pages/CheatSheetPage';
import { CheatSheetDrawer } from './CheatSheetDrawer';
import { problems } from '@content';
import { useTheme } from './theme';

export function App() {
  const route = useRoute();
  const [navOpen, setNavOpen] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [theme, toggleTheme] = useTheme();
  const closeDrawer = useCallback(() => setDrawer(false), []);

  const currentSectionId =
    route.name === 'section'
      ? route.id
      : route.name === 'problem'
        ? problems[route.id]?.sectionId
        : undefined;

  return (
    <>
      <a
        className="skip-link"
        href="#main"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById('main')?.focus();
        }}
      >
        Skip to content
      </a>
      <header className="app-header">
        <button
          type="button"
          className="menu-btn"
          aria-expanded={navOpen}
          aria-controls="site-nav"
          onClick={() => setNavOpen((o) => !o)}
        >
          ☰ Sections
        </button>
        <a className="brand" href={href.home()}>
          Accounting for Ledger Engineers
        </a>
        <a
          className="btn"
          href={href.sandbox()}
          aria-current={route.name === 'sandbox' ? 'page' : undefined}
        >
          Sandbox
        </a>
        <button type="button" onClick={() => setDrawer(true)} aria-haspopup="dialog">
          Cheat sheet
        </button>
        <button
          type="button"
          onClick={toggleTheme}
          aria-pressed={theme === 'dark'}
          aria-label="Dark theme"
          title="Toggle light / dark theme"
        >
          {theme === 'dark' ? '☾ Dark' : '☀ Light'}
        </button>
      </header>
      <div className="layout">
        <nav id="site-nav" className={`sidebar ${navOpen ? 'open' : ''}`} aria-label="Sections">
          <ol>
            <li>
              <a
                href={href.home()}
                aria-current={route.name === 'home' ? 'page' : undefined}
                onClick={() => setNavOpen(false)}
              >
                <span className="nav-num" aria-hidden="true">
                  ⌂
                </span>{' '}
                Home
              </a>
            </li>
            {sections.map((s) => (
              <li key={s.id}>
                <a
                  href={href.section(s.id)}
                  aria-current={currentSectionId === s.id ? 'page' : undefined}
                  onClick={() => setNavOpen(false)}
                >
                  <span className="nav-num">{s.id === 'review' ? '↻' : `${s.number}.`}</span>{' '}
                  {s.title}
                </a>
              </li>
            ))}
            <li>
              <a
                href={href.cheatsheet()}
                aria-current={route.name === 'cheatsheet' ? 'page' : undefined}
                onClick={() => setNavOpen(false)}
              >
                <span className="nav-num" aria-hidden="true">
                  ∑
                </span>{' '}
                Cheat sheet (page)
              </a>
            </li>
          </ol>
        </nav>
        <main className="content" id="main" tabIndex={-1}>
          {route.name === 'home' && <HomePage />}
          {route.name === 'section' && <SectionPage id={route.id} />}
          {route.name === 'problem' && (
            <ProblemPage key={route.id} id={route.id} attempt={route.attempt} />
          )}
          {route.name === 'sandbox' && <SandboxPage data={route.data} />}
          {route.name === 'cheatsheet' && <CheatSheetPage />}
          {route.name === 'not-found' && (
            <p>
              Page not found. <a href={href.home()}>Go home</a>
            </p>
          )}
        </main>
      </div>
      {drawer && <CheatSheetDrawer onClose={closeDrawer} />}
    </>
  );
}
