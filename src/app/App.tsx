import { AnimationGallery } from '../components/animations';
import { useCallback, useEffect, useRef, useState, lazy, Suspense } from 'react';
import { sections } from '@content';
import { href, useRoute } from './router';
import { HomePage } from './pages/HomePage';
import { SectionPage } from './pages/SectionPage';
import { ProblemPage } from './pages/ProblemPage';
import { CheatSheetPage } from './pages/CheatSheetPage';
import { DefinitionsPage } from './pages/DefinitionsPage';
import { GlossaryPopover } from './GlossaryPopover';
import { CheatSheetDrawer } from './CheatSheetDrawer';
import { SearchDialog } from './SearchDialog';
import { problems } from '@content';
import { useTheme } from './theme';
import { AskGemini, type AskContext } from './AskGemini';
import { problemNumber } from './problemNumber';
import { ProgressBar } from './ProgressBar';
import { ProgressSummary } from './ProgressSummary';
import { statusOf, useProgress } from './progress';

/** The Sandbox is its own module and chunk: loaded the first time someone opens it. */
const SandboxRoute = lazy(() => import('./SandboxRoute'));

/** Sandbox gets the full width; booking problems with balance sheets get room for Before | grid | After. */
function mainClass(route: ReturnType<typeof useRoute>): string {
  // All three Sandbox views share the Grid's layout: full width, tight padding.
  if (route.name === 'sandbox') return 'content sheet-full';
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

/** ✓ solved · ✗ tried, not correct yet · ○ not started (in the nav's open section). */
function StatusMark({ status }: { status: ReturnType<typeof statusOf> }) {
  const [mark, label] =
    status === 'solved'
      ? ['✓', 'solved']
      : status === 'tried'
        ? ['✗', 'tried, not solved yet']
        : ['○', 'not started'];
  return (
    <span className={`nav-status is-${status ?? 'todo'}`}>
      <span aria-hidden="true">{mark}</span>
      <span className="visually-hidden"> ({label})</span>
    </span>
  );
}

export function App() {
  const route = useRoute();
  const [navOpen, setNavOpen] = useState(false);
  const [navHidden, setNavHidden] = useNavHidden();
  const narrow = useNarrow();
  const [drawer, setDrawer] = useState(false);
  const [theme, toggleTheme] = useTheme();
  const closeDrawer = useCallback(() => setDrawer(false), []);
  const [searchOpen, setSearchOpen] = useState(false);
  const closeSearch = useCallback(() => setSearchOpen(false), []);

  // ⌘K / Ctrl-K anywhere toggles search; "/" opens it when you're not typing in a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((o) => !o);
        return;
      }
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      e.preventDefault();
      setSearchOpen(true);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // The section list: ☰ shows/hides it on every page. Phones open it over the page; on wider screens the
  // choice is remembered; the Sandbox (a workspace) always starts with it hidden.
  const workspace = route.name === 'sandbox';
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

  // The nav is a tree: each section can open to list its problems. The section you're in opens by itself;
  // any section's ▸ opens/closes it (your choice wins over the automatic one).
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const isOpen = (id: string) => openSections[id] ?? id === currentSectionId;
  const toggleSection = (id: string) => setOpenSections((o) => ({ ...o, [id]: !isOpen(id) }));
  const currentProblemId = route.name === 'problem' ? route.id : undefined;
  const progress = useProgress();

  // Keep where you are visible in the nav (e.g. arriving at problem 9.12 from a link).
  const navRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = navRef.current?.querySelector('.nav-problems [aria-current="page"]');
    if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'nearest' });
  }, [currentProblemId]);

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
        <button
          type="button"
          className="search-btn"
          onClick={() => setSearchOpen(true)}
          aria-haspopup="dialog"
          aria-label="Search"
          aria-keyshortcuts="Meta+K Control+K /"
          title="Search titles (⌘K or /)"
        >
          {/* Phones: just the magnifier (the header is full). */}
          <svg
            className="search-icon"
            viewBox="0 0 16 16"
            width="16"
            height="16"
            aria-hidden="true"
          >
            <circle
              cx="6.5"
              cy="6.5"
              r="4.75"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
            />
            <path
              d="M10 10l4.25 4.25"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
            />
          </svg>
          <span className="hide-narrow">Search</span>
          <kbd className="hide-narrow">⌘K</kbd>
        </button>
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
          {theme === 'dark' ? '☾' : '☀'}
          <span className="hide-narrow">{theme === 'dark' ? ' Dark' : ' Light'}</span>
        </button>
        <ProgressBar currentSectionId={currentSectionId} />
      </header>
      <div className={collapsed ? 'layout no-side' : 'layout'}>
        <nav
          id="site-nav"
          ref={navRef}
          className={`sidebar ${navOpen ? 'open' : ''}`}
          aria-label="Sections"
        >
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
            {sections.map((s) => {
              const open = isOpen(s.id);
              const listId = `nav-problems-${s.id}`;
              const here = currentSectionId === s.id;
              return (
                <li key={s.id} className="nav-section">
                  <div className="nav-section__row">
                    <a
                      href={href.section(s.id)}
                      // The top level is a heading for its leaves: it opens the section's Overview, and is bold
                      // while you are anywhere in the section; the leaf you are on is the current page.
                      className={here ? 'is-ancestor' : undefined}
                      onClick={() => setNavOpen(false)}
                    >
                      <span className="nav-num">{s.id === 'review' ? '↻' : `${s.number}.`}</span>{' '}
                      {s.title}
                      {s.problemIds.length > 0 && (
                        <span className="nav-count">
                          {' '}
                          {s.problemIds.filter((p) => statusOf(progress, p) === 'solved').length}/
                          {s.problemIds.length}
                          <span className="visually-hidden"> solved</span>
                        </span>
                      )}
                    </a>
                    {
                      <button
                        type="button"
                        className="nav-toggle"
                        aria-expanded={open}
                        aria-controls={listId}
                        aria-label={`${open ? 'Hide' : 'Show'} the overview and ${s.problemIds.length} problems in ${s.title}`}
                        title={`${open ? 'Hide' : 'Show'} the overview and problems`}
                        onClick={() => toggleSection(s.id)}
                      >
                        <span className="nav-chev" aria-hidden="true" />
                      </button>
                    }
                  </div>
                  {open && (
                    <ol className="nav-problems" id={listId} aria-label={`${s.title}: contents`}>
                      <li className="nav-overview">
                        <a
                          href={href.section(s.id)}
                          aria-current={route.name === 'section' && here ? 'page' : undefined}
                          onClick={() => setNavOpen(false)}
                        >
                          Overview
                        </a>
                      </li>
                      {s.problemIds.map((pid) => (
                        <li key={pid}>
                          <a
                            href={href.problem(pid)}
                            aria-current={currentProblemId === pid ? 'page' : undefined}
                            onClick={() => setNavOpen(false)}
                          >
                            <span className="nav-pnum">{problemNumber(pid)}</span>{' '}
                            {problems[pid]?.title ?? pid}
                            <StatusMark status={statusOf(progress, pid)} />
                          </a>
                        </li>
                      ))}
                    </ol>
                  )}
                </li>
              );
            })}
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
          <ProgressSummary />
        </nav>
        <main className={mainClass(route)} id="main" tabIndex={-1}>
          {route.name === 'home' && <HomePage />}
          {route.name === 'section' && <SectionPage id={route.id} at={route.at} />}
          {route.name === 'problem' && (
            <ProblemPage key={route.id} id={route.id} attempt={route.attempt} />
          )}
          {route.name === 'sandbox' && (
            <Suspense fallback={<p className="note">Loading the Sandbox…</p>}>
              <SandboxRoute
                view={route.view}
                data={route.data}
                scenario={route.scenario}
                entity={route.entity}
                at={route.at}
              />
            </Suspense>
          )}
          {route.name === 'cheatsheet' && <CheatSheetPage at={route.at} />}
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
      {searchOpen && <SearchDialog onClose={closeSearch} />}
      <GlossaryPopover />
      <AskGemini context={askContext} />
    </>
  );
}
