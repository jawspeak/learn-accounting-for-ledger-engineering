import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Markdown } from './Markdown';
import { termById } from './glossary';
import { href } from './router';

const PHONE = '(max-width: 640px)';
const GAP = 6;

/**
 * One definition popover for the whole app. Any `[[term]]` in authored markdown renders a
 * `<button class="gloss-term" data-gloss="id">`; tapping/clicking it (or Enter/Space) opens the definition:
 * anchored under the term on wider screens, as a bottom sheet on phones. Never hover-only.
 * Esc, the close button, or a tap outside closes it and returns focus to the term.
 */
export function GlossaryPopover() {
  const [open, setOpen] = useState<{ id: string; anchor: HTMLElement } | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [phone, setPhone] = useState(
    () => typeof window.matchMedia === 'function' && window.matchMedia(PHONE).matches,
  );
  const panelRef = useRef<HTMLDivElement>(null);

  const close = useCallback((refocus = true) => {
    setOpen((o) => {
      if (o) {
        o.anchor.setAttribute('aria-expanded', 'false');
        if (refocus && o.anchor.isConnected) o.anchor.focus();
      }
      return null;
    });
  }, []);

  // Open on any marked term, anywhere (including terms inside an open definition).
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest?.<HTMLElement>('.gloss-term');
      if (el) {
        e.preventDefault();
        const id = el.dataset.gloss!;
        setOpen((o) => {
          if (o && o.id === id && o.anchor === el) {
            el.setAttribute('aria-expanded', 'false');
            return null; // tapping the same term again toggles it closed
          }
          o?.anchor.setAttribute('aria-expanded', 'false');
          el.setAttribute('aria-expanded', 'true');
          // A term inside the popover keeps the original anchor's position (the popover just shows the new term).
          const anchor = o && panelRef.current?.contains(el) ? o.anchor : el;
          return { id, anchor };
        });
        return;
      }
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) close(false);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [close]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
    };
    const onHash = () => close(false);
    document.addEventListener('keydown', onKey);
    window.addEventListener('hashchange', onHash);
    return () => {
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('hashchange', onHash);
    };
  }, [open, close]);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(PHONE);
    const on = () => setPhone(mq.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);

  // Desktop: keep the popover under its term (clamped to the viewport), following scroll and resize.
  useLayoutEffect(() => {
    if (!open || phone) return;
    const place = () => {
      const r = open.anchor.getBoundingClientRect();
      const w = panelRef.current?.offsetWidth ?? 320;
      const h = panelRef.current?.offsetHeight ?? 0;
      const left = Math.min(Math.max(8, r.left), window.innerWidth - w - 8);
      const below = r.bottom + GAP;
      const top =
        below + h > window.innerHeight - 8 && r.top - GAP - h > 8 ? r.top - GAP - h : below;
      setPos({ top, left });
    };
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open, phone]);

  useEffect(() => {
    if (open) panelRef.current?.focus({ preventScroll: true });
  }, [open]);

  const term = open ? termById(open.id) : undefined;
  if (!open || !term) return null;
  return (
    <>
      {phone && <div className="gloss-backdrop" aria-hidden="true" onClick={() => close(false)} />}
      <div
        ref={panelRef}
        className={`gloss-pop${phone ? ' is-sheet' : ''}`}
        role="dialog"
        aria-label={`Definition: ${term.term}`}
        tabIndex={-1}
        style={!phone && pos ? { top: pos.top, left: pos.left } : undefined}
      >
        <div className="gloss-pop-head">
          <h2 className="gloss-pop-term">{term.term}</h2>
          <button
            type="button"
            className="gloss-pop-close"
            aria-label="Close definition"
            onClick={() => close()}
          >
            ×
          </button>
        </div>
        <Markdown text={term.definition} />
        <a className="gloss-pop-more" href={href.definitions(term.id)}>
          All definitions <span aria-hidden="true">→</span>
        </a>
      </div>
    </>
  );
}
