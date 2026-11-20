import { useEffect, useMemo, useRef, useState } from 'react';
import { engine } from '@engine';
import { EXAMPLES } from '../../content/sandbox-examples';
import { Sandbox, emptyState, persistable, type SandboxState, type SandboxView } from '../sandbox';
import { href, parseHash, replaceHash } from './router';

/** Debounce for writing state into the URL. */
export const URL_DEBOUNCE_MS = 300;
/**
 * Warn (non-blocking) once the shareable URL gets longer than this. Browsers take far longer URLs (the state
 * is in the #fragment, which never reaches a server); the limit that bites first is chat and email tools that
 * truncate or refuse long links. Past it, Export (a .json file) is the safer way to share.
 */
export const URL_WARN_LENGTH = 8000;

interface Board {
  state: SandboxState;
  /** Bumped whenever a different board arrives by link (pasted, back/forward), so the Sandbox remounts. */
  key: number;
  invalidLink: boolean;
}

function load(data: string | undefined, key: number): Board {
  if (!data) return { state: emptyState(), key, invalidLink: false };
  const state = engine.decodeSandbox(data);
  return state
    ? { state, key, invalidLink: false }
    : { state: emptyState(), key, invalidLink: true };
}
const clamp = (i: number, n: number) => Math.max(0, Math.min(i, n - 1));
/** What goes in a link: the state without half-written journal lines. */
const encode = (s: SandboxState) => engine.encodeState(persistable(s));

/**
 * The course's Sandbox route (#/sandbox, #/taccounts, #/sheet): hosts the standalone Sandbox with the state in
 * the URL — shareable links, back/forward, a debounced write as you type — plus the course's example scenarios.
 * Everything URL-specific lives here, not in the Sandbox.
 */
export default function SandboxRoute({
  view,
  data,
  scenario: scenarioParam,
  entity: entityParam,
  at,
}: {
  view: SandboxView;
  data?: string;
  scenario: number;
  entity: number;
  at?: string;
}) {
  const [board, setBoard] = useState<Board>(() => load(data, 0));
  const { state } = board;
  const [scenario, setScenario] = useState(() => clamp(scenarioParam, state.scenarios.length));
  const [entity, setEntity] = useState(() => clamp(entityParam, state.entities.length));
  /** The encoded state we last wrote (so our own writes aren't mistaken for navigation). */
  const written = useRef<string | undefined>(data);
  /** State as loaded — not written back until something changes. */
  const loaded = useRef<SandboxState>(board.state);
  const [urlLength, setUrlLength] = useState(0);
  const [copyStatus, setCopyStatus] = useState('');

  // Another sandbox link (back/forward, pasted, or a view switch before our debounced write) reloads the board.
  useEffect(() => {
    const onHash = () => {
      const r = parseHash(window.location.hash);
      if (r.name !== 'sandbox') return;
      setScenario(r.scenario);
      if (r.view !== 'taccounts') setEntity(r.entity);
      if (r.data === written.current) return;
      written.current = r.data;
      setBoard((b) => {
        const next = load(r.data, b.key + 1);
        loaded.current = next.state;
        setScenario(clamp(r.scenario, next.state.scenarios.length));
        setEntity(clamp(r.entity, next.state.entities.length));
        return next;
      });
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const writeUrl = (s: SandboxState, sc: number, en: number): string => {
    const enc = encode(s);
    written.current = enc;
    const h = href.sandboxView(view, enc, en, undefined, sc);
    replaceHash(h);
    setUrlLength(h.length);
    return h;
  };

  // Debounced write of the state into the URL (skipped until something changes).
  useEffect(() => {
    if (state === loaded.current) return;
    const t = window.setTimeout(() => writeUrl(state, scenario, entity), URL_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
    // writeUrl is recreated every render; re-running the debounce on each render would never let it fire.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, scenario, entity]);

  const enc = useMemo(() => encode(state), [state]);

  const copyLink = async () => {
    const h = writeUrl(state, scenario, entity);
    try {
      await navigator.clipboard.writeText(`${window.location.href.split('#')[0]}${h}`);
      setCopyStatus('Link copied — every scenario and entity, in any of the three views.');
    } catch {
      setCopyStatus('Couldn’t access the clipboard — copy the address bar instead.');
    }
  };

  const sc = clamp(scenario, state.scenarios.length);
  const en = clamp(entity, state.entities.length);
  return (
    <Sandbox
      key={board.key}
      state={state}
      onChange={(s) => setBoard((b) => ({ ...b, state: s }))}
      view={view}
      scenario={sc}
      onScenarioSelect={(i) => {
        setScenario(i);
        writeUrl(state, i, en);
      }}
      entity={en}
      onEntitySelect={(i) => {
        setEntity(i);
        writeUrl(state, sc, i);
      }}
      at={at}
      linkTo={(t) =>
        href.sandboxView(
          t.view,
          enc,
          t.view === 'taccounts' ? 0 : (t.entity ?? en),
          t.at,
          t.scenario ?? sc,
        )
      }
      examples={EXAMPLES}
      toolbar={
        <>
          <button type="button" className="btn primary" onClick={copyLink}>
            Copy link
          </button>
          {copyStatus && (
            <span className="note" role="status" aria-live="polite">
              {copyStatus}
            </span>
          )}
        </>
      }
      notice={
        <>
          {board.invalidLink && (
            <p className="sbx-notice sbx-notice-warn" role="alert">
              That sandbox link couldn’t be read (it may be truncated, or from an older version of
              the Sandbox). Starting with an empty Sandbox instead.
            </p>
          )}
          {urlLength > URL_WARN_LENGTH && (
            <p className="sbx-notice sbx-notice-warn">
              This link is getting long ({urlLength.toLocaleString('en-US')} characters). Browsers
              handle it, but some chat and email tools cut long links short — use Export to share a
              .json file instead.
            </p>
          )}
        </>
      }
    />
  );
}
