/**
 * The Sandbox — a self-contained double-entry workbench: parties, charts of accounts, journal entries, and
 * three views of the same books (Journal, T-accounts, Grid). This file is its public API; nothing outside
 * `src/sandbox/` should import from deeper paths, and nothing inside depends on the course app (both are
 * enforced by lint — see eslint.config.js).
 *
 *   <Sandbox state={s} onChange={setS} view="journal" party={0} onPartyChange={…} linkTo={…} />
 *
 * The state (`SandboxState`, versioned `v: 1`) is plain JSON: parties, accounts, entries, postings. The host
 * decides where it lives (a URL, storage, a backend); `persistable` drops half-written journal lines first.
 */
export { Sandbox } from './Sandbox';
export type { SandboxExample, SandboxProps } from './Sandbox';
export type { SandboxNav, SandboxTarget, SandboxView } from './nav';
export { emptyState, persistable } from './model';
export type { SandboxEntity, SandboxState } from '@contracts';
