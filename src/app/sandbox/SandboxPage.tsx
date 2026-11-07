import { useEffect, useId, useRef, useState } from 'react';
import type { SandboxEntity, SandboxState } from '@contracts';
import { engine } from '@engine';
import { href, parseHash, replaceHash } from '../router';
import { EntityCard } from './EntityCard';
import { EXAMPLES } from './examples';
import { duplicateEntity, emptyState, newEntity, URL_WARN_LENGTH } from './model';
import { SafeMarkdown } from './safeMarkdown';
import './sandbox.css';

/** Debounce for writing state into the URL. */
export const URL_DEBOUNCE_MS = 300;

interface Board {
  state: SandboxState;
  /** Bumped whenever a whole board is loaded (link, example, clear) so builders remount. */
  epoch: number;
  invalidLink: boolean;
}

function load(data: string | undefined, epoch: number): Board {
  if (!data) return { state: emptyState(), epoch, invalidLink: false };
  const state = engine.decodeSandbox(data);
  return state ? { state, epoch, invalidLink: false } : { state: emptyState(), epoch, invalidLink: true };
}

export function SandboxPage({ data }: { data?: string }) {
  const uid = useId();
  const [board, setBoard] = useState<Board>(() => load(data, 0));
  const { state, epoch } = board;
  /** The encoded state we last wrote to the URL (so our own writes aren't mistaken for navigation). */
  const written = useRef<string | undefined>(data);
  /** State object as loaded — not written back until the learner changes something. */
  const loaded = useRef<SandboxState>(board.state);
  const [encodedLength, setEncodedLength] = useState(() => (data ? href.sandbox(data).length : 0));
  const [preview, setPreview] = useState(() => !!board.state.scenario);
  const [confirmClear, setConfirmClear] = useState(false);
  const [status, setStatus] = useState('');

  const replaceBoard = (b: Board) => {
    loaded.current = b.state;
    setBoard(b);
    setConfirmClear(false);
    setPreview(!!b.state.scenario);
  };

  // Navigation to a different sandbox link (back/forward, pasted link) reloads the board.
  useEffect(() => {
    const onHash = () => {
      const r = parseHash(window.location.hash);
      if (r.name !== 'sandbox' || r.data === written.current) return;
      written.current = r.data;
      setBoard((b) => {
        const next = load(r.data, b.epoch + 1);
        loaded.current = next.state;
        return next;
      });
      setEncodedLength(r.data ? href.sandbox(r.data).length : 0);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // Debounced write of the state into the URL.
  useEffect(() => {
    if (state === loaded.current) return;
    const t = window.setTimeout(() => writeUrl(state), URL_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [state]);

  function writeUrl(s: SandboxState): string {
    const enc = engine.encodeState(s);
    written.current = enc;
    const h = href.sandbox(enc);
    replaceHash(h);
    setEncodedLength(h.length);
    return h;
  }

  const update = (fn: (s: SandboxState) => SandboxState) => setBoard((b) => ({ ...b, state: fn(b.state) }));
  const setEntity = (i: number, e: SandboxEntity) =>
    update((s) => ({ ...s, entities: s.entities.map((x, j) => (j === i ? e : x)) }));

  const copyLink = async () => {
    const h = writeUrl(state);
    const url = `${window.location.href.split('#')[0]}${h}`;
    try {
      await navigator.clipboard.writeText(url);
      setStatus('Link copied to clipboard.');
    } catch {
      setStatus('Couldn’t access the clipboard — copy the link from the address bar instead.');
    }
  };

  const clear = () => {
    written.current = undefined;
    replaceHash(href.sandbox());
    setEncodedLength(0);
    replaceBoard({ state: emptyState(), epoch: epoch + 1, invalidLink: false });
    setStatus('Started a new, empty board.');
  };

  const loadExample = (id: string) => {
    const ex = EXAMPLES.find((x) => x.id === id);
    if (!ex) return;
    const s = ex.build();
    replaceBoard({ state: s, epoch: epoch + 1, invalidLink: false });
    writeUrl(s);
    setStatus(`Loaded example: ${ex.label}.`);
  };

  return (
    <article className="sbx">
      <p className="note sbx-kicker">Sandbox · Scenario Board — ungraded; only structural checks.</p>
      <label htmlFor={`${uid}-title`} className="sr-only">
        Board title
      </label>
      <input
        id={`${uid}-title`}
        className="sbx-title"
        value={state.title ?? ''}
        placeholder="Untitled scenario"
        onChange={(e) => update((s) => ({ ...s, title: e.target.value }))}
      />

      {board.invalidLink && (
        <p className="sbx-notice sbx-notice-warn" role="alert">
          That sandbox link couldn’t be read (it may be truncated or from a newer version). Starting with an empty
          board instead.
        </p>
      )}

      <div className="toolbar sbx-toolbar">
        <button type="button" className="btn primary" onClick={copyLink}>
          Copy link
        </button>
        {confirmClear ? (
          <span className="sbx-confirm" role="group" aria-label="Confirm new board">
            Discard this board?
            <button type="button" className="btn" onClick={clear}>
              Yes, start over
            </button>
            <button type="button" className="btn" onClick={() => setConfirmClear(false)}>
              Cancel
            </button>
          </span>
        ) : (
          <button type="button" className="btn" onClick={() => setConfirmClear(true)}>
            New / Clear
          </button>
        )}
        <label className="sbx-inline">
          Example scenarios:
          <select value="" onChange={(e) => loadExample(e.target.value)}>
            <option value="">Load an example…</option>
            {EXAMPLES.map((x) => (
              <option key={x.id} value={x.id}>
                {x.label}
              </option>
            ))}
          </select>
        </label>
        <span className="note" role="status" aria-live="polite">
          {status}
        </span>
      </div>

      {encodedLength > URL_WARN_LENGTH && (
        <p className="sbx-notice sbx-notice-warn">
          This link is getting long ({encodedLength.toLocaleString('en-US')} characters). Some chat tools truncate
          long URLs — consider trimming unused accounts or splitting the scenario.
        </p>
      )}

      <section className="sbx-scenario" aria-label="Scenario">
        <div className="sbx-scenario-head">
          <h2>Scenario</h2>
          <div role="group" aria-label="Scenario view">
            <button type="button" className="btn" aria-pressed={!preview} onClick={() => setPreview(false)}>
              Edit
            </button>
            <button type="button" className="btn" aria-pressed={preview} onClick={() => setPreview(true)}>
              Preview
            </button>
          </div>
        </div>
        {preview ? (
          state.scenario.trim() ? (
            <div className="sbx-scenario-preview">
              <SafeMarkdown text={state.scenario} />
            </div>
          ) : (
            <p className="note">No scenario text yet.</p>
          )
        ) : (
          <>
            <label htmlFor={`${uid}-scenario`} className="sr-only">
              Scenario (markdown)
            </label>
            <textarea
              id={`${uid}-scenario`}
              className="sbx-scenario-text"
              rows={5}
              value={state.scenario}
              placeholder="Describe what happens, in markdown. E.g. “You deposit **$100** cash into checking.”"
              onChange={(e) => update((s) => ({ ...s, scenario: e.target.value }))}
            />
          </>
        )}
      </section>

      <div className="sbx-entities">
        {state.entities.map((e, i) => (
          <EntityCard
            key={`${epoch}:${e.id}`}
            builderKey={`${epoch}:${e.id}`}
            entity={e}
            onChange={(next) => setEntity(i, next)}
            onDuplicate={() =>
              update((s) => {
                const copy = duplicateEntity(s.entities, e);
                return { ...s, entities: [...s.entities.slice(0, i + 1), copy, ...s.entities.slice(i + 1)] };
              })
            }
            onRemove={() => update((s) => ({ ...s, entities: s.entities.filter((_, j) => j !== i) }))}
          />
        ))}
      </div>

      <div className="toolbar">
        <button
          type="button"
          className="btn"
          onClick={() =>
            update((s) => ({
              ...s,
              entities: [...s.entities, newEntity(s.entities, s.entities.length ? 'Other party' : 'You')],
            }))
          }
        >
          {state.entities.length ? '+ Add the other party’s perspective' : '+ Add an entity'}
        </button>
      </div>
    </article>
  );
}
