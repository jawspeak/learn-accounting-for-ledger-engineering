import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * A small popover: a button that opens a panel below it; Escape or a click outside closes it. Used for the "⋯"
 * menus (occasional actions) and the Journal's linked-event list.
 */
export function Menu({
  label,
  align = 'start',
  button = <span aria-hidden="true">⋯</span>,
  buttonClass = 'btn sbx-menu-button',
  title,
  children,
}: {
  /** The button's accessible name, and the panel's. */
  label: string;
  align?: 'start' | 'end';
  /** What the button shows (default "⋯"). */
  button?: ReactNode;
  buttonClass?: string;
  /** The button's tooltip (default: the label). */
  title?: string;
  children(close: () => void): ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <span className="sbx-menu" ref={ref}>
      <button
        type="button"
        className={buttonClass}
        aria-label={label}
        aria-expanded={open}
        title={title ?? label}
        onClick={() => setOpen((o) => !o)}
      >
        {button}
      </button>
      {open && (
        <div className={`sbx-menu-panel is-${align}`} role="group" aria-label={label}>
          {children(() => setOpen(false))}
        </div>
      )}
    </span>
  );
}
