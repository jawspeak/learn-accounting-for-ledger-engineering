import { useEffect, useRef } from 'react';
import { CheatSheetBody } from './CheatSheet';
import { href } from './router';

const FOCUSABLE =
  'a[href], button:not(:disabled), input, select, textarea, [tabindex]:not([tabindex="-1"])';

/** Modal side drawer: Esc closes, Tab is trapped, focus returns to the opener. */
export function CheatSheetDrawer({ onClose }: { onClose(): void }) {
  const ref = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !ref.current) return;
      const els = Array.from(ref.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (els.length === 0) return;
      const first = els[0]!;
      const last = els[els.length - 1]!;
      const active = document.activeElement;
      if (!ref.current.contains(active)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      opener?.focus?.();
    };
  }, [onClose]);

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <aside ref={ref} className="drawer" role="dialog" aria-modal="true" aria-label="Cheat sheet">
        <div className="drawer-head">
          <a href={href.cheatsheet()} onClick={onClose}>
            Open as full page
          </a>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close cheat sheet (Esc)"
          >
            Close ✕
          </button>
        </div>
        <CheatSheetBody heading="h2" />
      </aside>
    </>
  );
}
