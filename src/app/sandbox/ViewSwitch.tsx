import type { ComponentType } from 'react';
import { href, type SandboxView } from '../router';
import './viewSwitch.css';

/**
 * The Sandbox is one tool with three views of the same books (the same URL state, so switching keeps everything):
 *  - Journal: by transaction, in order — what happened, and what each event posted. The editor.
 *  - T-accounts: by account — the general ledger: what's in each account and how it got there.
 *  - Grid: both at once — rows = entries, columns = accounts; one party at a time, desktop-first.
 * Names live here only, so renaming them is a one-line change.
 */
export const VIEW_NAME: Record<SandboxView, string> = {
  journal: 'Journal',
  taccounts: 'T-accounts',
  grid: 'Grid',
};

const VIEW_HINT: Record<SandboxView, string> = {
  journal: 'By transaction: write and read entries, debits then credits',
  taccounts: 'By account: every party’s ledger as T-accounts, with balance sheets',
  grid: 'Both: entries down, accounts across — one party as a wide spreadsheet (desktop)',
};

const icon = (children: React.ReactNode) => (
  <svg className="vs-icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
    {children}
  </svg>
);

/** Lines of an entry: two debit lines, one indented credit line. */
function JournalIcon() {
  return icon(
    <path
      d="M2 3.5h9M2 7.5h9M5 11.5h9"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
    />,
  );
}

/** A T: the shape of every account. */
function TAccountIcon() {
  return icon(
    <path
      d="M2 3.5h12M8 3.5V14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
    />,
  );
}

/** A grid: rows and columns. */
function GridIcon() {
  return icon(
    <>
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
    </>,
  );
}

const VIEWS: [SandboxView, ComponentType][] = [
  ['journal', JournalIcon],
  ['taccounts', TAccountIcon],
  ['grid', GridIcon],
];

/** "Sandbox · [Journal | T-accounts | Grid]" — the same header on every view. `data` = the encoded state. */
export function ViewSwitch({
  current,
  data,
  entity = 0,
}: {
  current: SandboxView;
  data?: string;
  entity?: number;
}) {
  return (
    <div className="vs">
      <span className="vs-tool">Sandbox</span>
      <nav className="vs-switch" aria-label="Sandbox view">
        {VIEWS.map(([v, Icon]) => (
          <a
            key={v}
            href={href.sandboxView(v, data, v === 'taccounts' ? 0 : entity)}
            className={`vs-opt${v === current ? ' is-current' : ''}`}
            aria-current={v === current ? 'page' : undefined}
            title={VIEW_HINT[v]}
          >
            <Icon />
            {VIEW_NAME[v]}
          </a>
        ))}
      </nav>
      <span className="vs-note">Ungraded · the same books in all three views</span>
    </div>
  );
}
