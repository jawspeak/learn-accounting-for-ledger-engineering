import { useCallback, useState, useSyncExternalStore, type KeyboardEvent, type ReactNode } from 'react';
import { Markdown } from '../../app/Markdown';
import './animations.css';

const REDUCED_QUERY = '(prefers-reduced-motion: reduce)';

function subscribeReduced(cb: () => void) {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {};
  const mql = window.matchMedia(REDUCED_QUERY);
  mql.addEventListener?.('change', cb);
  return () => mql.removeEventListener?.('change', cb);
}
function getReduced() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(REDUCED_QUERY).matches;
}

/** True when the user asked the OS/browser for reduced motion. */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribeReduced, getReduced, () => false);
}

export interface StageContext {
  index: number;
  /** True when we arrived at this step by moving one step forward (→ play the transition). */
  forward: boolean;
  reducedMotion: boolean;
}

export interface StepAnimationProps {
  title: string;
  /** One caption (markdown) per step. The number of captions is the number of steps. */
  captions: string[];
  renderStage: (ctx: StageContext) => ReactNode;
  className?: string;
}

/**
 * Reusable step-through shell: Prev / Next / Restart, step counter, ←/→/Home keys
 * (when the figure has focus), a live caption, and reduced-motion handling.
 * Never autoplays.
 */
export function StepAnimation({ title, captions, renderStage, className }: StepAnimationProps) {
  const [nav, setNav] = useState({ index: 0, forward: false });
  const reducedMotion = usePrefersReducedMotion();
  const last = Math.max(0, captions.length - 1);
  const { index, forward } = nav;

  const go = useCallback(
    (to: number) => {
      const next = Math.min(last, Math.max(0, to));
      setNav((cur) => (cur.index === next ? cur : { index: next, forward: next === cur.index + 1 }));
    },
    [last],
  );

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.target instanceof HTMLButtonElement && (e.key === 'Enter' || e.key === ' ')) return;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      go(index + 1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      go(index - 1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      go(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      go(last);
    }
  };

  return (
    <figure
      className={['step-anim', reducedMotion ? 'step-anim--reduced' : '', className ?? ''].filter(Boolean).join(' ')}
      tabIndex={0}
      aria-roledescription="step-through animation"
      aria-label={`${title}. Use the left and right arrow keys to step.`}
      onKeyDown={onKeyDown}
      data-step={index}
    >
      <div className="step-anim__header">
        <span className="step-anim__title">{title}</span>
        <span className="step-anim__counter" aria-live="off">
          Step {index + 1} of {captions.length}
        </span>
      </div>
      <div className="step-anim__stage">{renderStage({ index, forward, reducedMotion })}</div>
      <figcaption className="step-anim__caption" aria-live="polite">
        <Markdown text={captions[index] ?? ''} />
      </figcaption>
      <div className="step-anim__controls">
        <button type="button" onClick={() => go(0)} disabled={index === 0} aria-label="Restart">
          ⟲ Restart
        </button>
        <button type="button" onClick={() => go(index - 1)} disabled={index === 0} aria-label="Previous step">
          ← Prev
        </button>
        <ol className="step-anim__dots" aria-hidden="true">
          {captions.map((_, i) => (
            <li key={i} className={i === index ? 'is-current' : i < index ? 'is-done' : ''} />
          ))}
        </ol>
        <button
          type="button"
          className="step-anim__next"
          onClick={() => go(index + 1)}
          disabled={index === last}
          aria-label="Next step"
        >
          Next →
        </button>
      </div>
    </figure>
  );
}
