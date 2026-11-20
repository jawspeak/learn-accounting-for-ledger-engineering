/**
 * The Sandbox — a self-contained double-entry workbench: entities (each with its own chart of accounts), scenarios
 * (each with its own story, entries and opening balances), and three views of a scenario's books (Journal,
 * T-accounts, Grid). This file is its public API; nothing outside `src/sandbox/` should import from deeper
 * paths, and nothing inside depends on the course app (both are enforced by lint — see eslint.config.js).
 *
 *   <Sandbox state={s} onChange={setS} view="journal" scenario={0} entity={0} onScenarioSelect={…}
 *            onEntitySelect={…} linkTo={…} />
 *
 * The state (`SandboxState`, versioned `v: 2`) is plain JSON: entities with their accounts, and scenarios with
 * each entity's entries. The host decides where it lives (a URL, storage, a backend); `persistable` drops
 * half-written journal lines first. Export / Import move it as a .json file.
 */
export { Sandbox } from './Sandbox';
export type { SandboxExample, SandboxProps } from './Sandbox';
export type { SandboxNav, SandboxTarget, SandboxView } from './nav';
export { emptyState, persistable, stateFromBooks } from './model';
export type { EntityBooks, SandboxEntity, SandboxScenario, SandboxState } from '@contracts';
