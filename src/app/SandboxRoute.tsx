import { useEffect, useMemo, useRef, useState } from 'react';
import { entities } from '@content';
import { engine } from '@engine';
import { EXAMPLES } from '../../content/sandbox-examples';
import {
  Sandbox,
  emptyState,
  persistable,
  type SandboxState,
  type SandboxTemplate,
  type SandboxView,
} from '../sandbox';
import { href, parseHash, replaceHash } from './router';

/** Debounce for writing state into the URL. */
export const URL_DEBOUNCE_MS = 300;
/** Warn (non-blocking) once the shareable URL gets longer than this. */
export const URL_WARN_LENGTH = 6000;

/** The course's charts of accounts as Sandbox templates: "You" first, then by name. */
const TEMPLATES: SandboxTemplate[] = Object.values(entities).sort((a, b) =>
  a.id === 'you' ? -1 : b.id === 'you' ? 1 : a.name.localeCompare(b.name),
);

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
const clamp = (i: number, s: SandboxState) => Math.max(0, Math.min(i, s.entities.length - 1));
/** What goes in a link: the state without half-written journal lines. */
const encode = (s: SandboxState) => engine.encodeState(persistable(s));

/**
 * The course's Sandbox route (#/sandbox, #/taccounts, #/sheet): hosts the standalone Sandbox with the state in
 * the URL — shareable links, back/forward, a debounced write as you type — plus the course's templates and
 * example scenarios. Everything URL-specific lives here, not in the Sandbox.
 */
export default function SandboxRoute({
  view,
  data,
  entity,
  at,
}: {
  view: SandboxView;
  data?: string;
  entity: number;
  at?: string;
}) {
  const [board, setBoard] = useState<Board>(() => load(data, 0));
  const { state } = board;
  const [party, setParty] = useState(() => clamp(entity, board.state));
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
      if (r.view !== 'taccounts') setParty(r.entity);
      if (r.data === written.current) return;
      written.current = r.data;
      setBoard((b) => {
        const next = load(r.data, b.key + 1);
        loaded.current = next.state;
        setParty(clamp(r.entity, next.state));
        return next;
      });
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const writeUrl = (s: SandboxState, p: number): string => {
    const enc = encode(s);
    written.current = enc;
    const h = href.sandboxView(view, enc, view === 'taccounts' ? 0 : p);
    replaceHash(h);
    setUrlLength(h.length);
    return h;
  };

  // Debounced write of the state into the URL (skipped until something changes).
  useEffect(() => {
    if (state === loaded.current) return;
    const t = window.setTimeout(() => writeUrl(state, party), URL_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
    // writeUrl is recreated every render; re-running the debounce on each render would never let it fire.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, party]);

  const enc = useMemo(() => encode(state), [state]);

  const copyLink = async () => {
    const h = writeUrl(state, party);
    try {
      await navigator.clipboard.writeText(`${window.location.href.split('#')[0]}${h}`);
      setCopyStatus('Link copied — it opens in any of the three views.');
    } catch {
      setCopyStatus('Couldn’t access the clipboard — copy the address bar instead.');
    }
  };

  return (
    <Sandbox
      key={board.key}
      state={state}
      onChange={(s) => setBoard((b) => ({ ...b, state: s }))}
      view={view}
      party={clamp(party, state)}
      onPartyChange={(p) => {
        setParty(p);
        writeUrl(state, p);
      }}
      at={at}
      linkTo={(t) =>
        href.sandboxView(t.view, enc, t.view === 'taccounts' ? 0 : (t.party ?? party), t.at)
      }
      templates={TEMPLATES}
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
              That sandbox link couldn’t be read (it may be truncated or from a newer version).
              Starting with an empty board instead.
            </p>
          )}
          {urlLength > URL_WARN_LENGTH && (
            <p className="sbx-notice sbx-notice-warn">
              This link is getting long ({urlLength.toLocaleString('en-US')} characters). Some chat
              tools truncate long URLs — consider trimming unused accounts or splitting the
              scenario.
            </p>
          )}
        </>
      }
    />
  );
}
