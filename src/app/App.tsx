import { AnimationGallery } from '../components/animations';
import { useCallback, useEffect, useState } from 'react';
import { sections } from '@content';
import { href, useRoute } from './router';
import { HomePage } from './pages/HomePage';
import { SectionPage } from './pages/SectionPage';
import { ProblemPage } from './pages/ProblemPage';
import { SandboxPage } from './sandbox/SandboxPage';
import { SheetPage } from './sheet/SheetPage';
import { CheatSheetPage } from './pages/CheatSheetPage';
import { DefinitionsPage } from './pages/DefinitionsPage';
import { GlossaryPopover } from './GlossaryPopover';
import { CheatSheetDrawer } from './CheatSheetDrawer';
import { problems } from '@content';
import { useTheme } from './theme';
import { AskGemini, type AskContext } from './AskGemini';

/** Sandbox gets the full width; booking problems with balance sheets get room for Before | grid | After. */
function mainClass(route: ReturnType<typeof useRoute>): string {
  if (route.name === 'sandbox') return 'content wide';
  if (route.name === 'sheet') return 'content sheet-full';
  if (route.name === 'problem') {
    const p = problems[route.id];
    if (p?.kind === 'booking') return 'content wide-problem';
  }
  return 'content';
}

const NARROW = '(max-width: 860px)';
const NAV_KEY = 'nav:sections-hidden';

/** Whether the screen is phone/tablet narrow (the section list then opens over the page). */
function useNarrow(): boolean {
  const [narrow, setNarrow] = useState(
    () => typeof window.matchMedia === 'function' && window.matchMedia(NARROW).matches,
  );
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(NARROW);
    const on = () => setNarrow(mq.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);
  return narrow;
}

/** "Hide the section list" on wider screens, remembered per browser (a convenience; works without storage). */
function useNavHidden(): [boolean, (v: boolean) => void] {
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(NAV_KEY) === '1';
    } catch {
      return false;
    }
  });
  const set = (v: boolean) => {
    setHidden(v);
    try {
      localStorage.setItem(NAV_KEY, v ? '1' : '0');
    } catch {
      /* private mode etc.: still works for this visit */
    }
  };
  return [hidden, set];
}

export function App() {
  const route = useRoute();
  const [navOpen, setNavOpen] = useState(false);
  const [navHidden, setNavHidden] = useNavHidden();
  const narrow = useNarrow();
  const [drawer, setDrawer] = useState(false);
  const [theme, toggleTheme] = useTheme();
  const closeDrawer = useCallback(() => setDrawer(false), []);

  // The section list: ☰ shows/hides it on every page. Phones open it over the page; on wider screens the
  // choice is remembered; workspaces (sandbox, spreadsheet) always start with it hidden.
  const workspace = route.name === 'sheet' || route.name === 'sandbox';
  const collapsed = workspace || navHidden;
  const navShown = narrow || collapsed ? navOpen : true;
  const toggleNav = () => {
    if (narrow || workspace) setNavOpen((o) => !o);
    else setNavHidden(!navHidden);
  };

  const currentSectionId =
    route.name === 'section'
      ? route.id
      : route.name === 'problem'
        ? problems[route.id]?.sectionId
        : undefined;

  const problem = route.name === 'problem' ? problems[route.id] : undefined;
  const section = route.name === 'section' ? sections.find((s) => s.id === route.id) : undefined;
  const askContext: AskContext = problem
    ? { kind: 'problem', title: problem.title }
    : section
      ? { kind: 'section', title: section.title }
      : { kind: 'other' };

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
          aria-expanded={navShown}
          aria-controls="site-nav"
          title={navShown ? 'Hide the section list' : 'Show the section list'}
          onClick={toggleNav}
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
      <div className={collapsed ? 'layout no-side' : 'layout'}>
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
            <li>
              <a
                href={href.definitions()}
                aria-current={route.name === 'definitions' ? 'page' : undefined}
                onClick={() => setNavOpen(false)}
              >
                <span className="nav-num" aria-hidden="true">
                  Aa
                </span>{' '}
                Definitions
              </a>
            </li>
          </ol>
        </nav>
        <main className={mainClass(route)} id="main" tabIndex={-1}>
          {route.name === 'home' && <HomePage />}
          {route.name === 'section' && <SectionPage id={route.id} />}
          {route.name === 'problem' && (
            <ProblemPage key={route.id} id={route.id} attempt={route.attempt} />
          )}
          {route.name === 'sandbox' && <SandboxPage data={route.data} />}
          {route.name === 'sheet' && <SheetPage data={route.data} entity={route.entity} />}
          {route.name === 'cheatsheet' && <CheatSheetPage />}
          {route.name === 'definitions' && <DefinitionsPage id={route.id} />}
          {route.name === 'animations' && <AnimationGallery />}
          {route.name === 'not-found' && (
            <p>
              Page not found. <a href={href.home()}>Go home</a>
            </p>
          )}
        </main>
      </div>
      {drawer && <CheatSheetDrawer onClose={closeDrawer} />}
      <GlossaryPopover />
      <AskGemini context={askContext} />
    </>
  );
}
