import type { ComponentType } from 'react';
import { href } from '../router';
import './viewSwitch.css';

/**
 * The Sandbox is one tool with two views of the same scenario (the same URL state, so switching keeps
 * everything):
 *  - T-accounts: every party's books on one page, as T-accounts, with balance sheets and a journal view.
 *  - Spreadsheet: one party at a time (tabs), as a wide grid with keyboard navigation — desktop-first.
 * Names live here only, so renaming them is a one-line change.
 */
export type SandboxView = 'taccounts' | 'sheet';

export const VIEW_NAME: Record<SandboxView, string> = {
  taccounts: 'T-accounts',
  sheet: 'Spreadsheet',
};

const VIEW_HINT: Record<SandboxView, string> = {
  taccounts: 'Every party’s books on one page, as T-accounts',
  sheet: 'One party at a time, as a wide grid (desktop)',
};

/** A T: the shape of every account in the T-accounts view. */
export function TAccountIcon() {
  return (
    <svg className="vs-icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <path
        d="M2 3.5h12M8 3.5V14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** A grid: rows and columns. */
export function SheetIcon() {
  return (
    <svg className="vs-icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <rect
        x="1.75"
        y="2.25"
        width="12.5"
        height="11.5"
        rx="1.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M1.75 6.25h12.5M1.75 10h12.5M6 2.25v11.5M10 2.25v11.5"
        stroke="currentColor"
        strokeWidth="1.25"
      />
    </svg>
  );
}

/** "Sandbox · [T-accounts | Spreadsheet]": the same header on both views. `data` = the encoded current state. */
export function ViewSwitch({
  current,
  data,
  entity = 0,
}: {
  current: SandboxView;
  data?: string;
  entity?: number;
}) {
  const views: [SandboxView, string, ComponentType][] = [
    ['taccounts', href.sandbox(data), TAccountIcon],
    ['sheet', href.sheet(data, entity), SheetIcon],
  ];
  return (
    <div className="vs">
      <span className="vs-tool">Sandbox</span>
      <nav className="vs-switch" aria-label="Sandbox view">
        {views.map(([v, h, Icon]) => (
          <a
            key={v}
            href={h}
            className={`vs-opt${v === current ? ' is-current' : ''}`}
            aria-current={v === current ? 'page' : undefined}
            title={VIEW_HINT[v]}
          >
            <Icon />
            {VIEW_NAME[v]}
          </a>
        ))}
      </nav>
      <span className="vs-note">Ungraded · same scenario in both views</span>
    </div>
  );
}
