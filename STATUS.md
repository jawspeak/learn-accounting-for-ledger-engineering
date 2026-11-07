# STATUS

Each workstream appends to its own section: **Done / In progress / Stubbed / Questions for manager**.

## Phase 0 — Foundation (manager) — ✅ done 2026-11-06

**Done**
- Vite 8 + React 19 + TypeScript 5.9 scaffold; ESLint, Prettier, Vitest, Playwright; GitHub Pages workflow (manual trigger only).
- Frozen contracts in `src/contracts/`: `accounting.ts`, `diagnostics.ts`, `problem.ts`, `state.ts`, `engine.ts` (EngineApi), `ui.ts` (builder/feedback props), `schemas.ts` (zod).
- Path aliases: `@contracts`, `@engine`, `@content`.
- Content registry auto-discovers `content/entities/*.ts` and `content/sections/*/index.ts` (+ `content/review/index.ts`) — **no shared registry file to edit**.
- Section skeletons for 00–12 + review. Starter entity `you`. Reference problem `03-cash-to-checking` (shows trap account, opening BS, hints, perspective pair).
- `content/content.test.ts` CI gate: schema validation, id resolution, every booking solution passes the checker with zero diagnostics, opening/closing A = L + E.
- Engine baseline (real): normalSide, rowTotals, computeBalances, checkEquation, trialBalance, orderColumns, pickerAccounts, URL codec (lz-string + zod). Hash router with tests.

**Stubbed (for Phase 1 owners)**
- `src/engine/checker.ts` — basic per-row net compare only (ENG: SPLIT_ENTRY, WRONG_ROW, BS_MISMATCH, EQUATION_BROKEN, non-booking kinds, better messages).
- `src/components/builder/TAccountBuilder.tsx` — plain table (UI: real T-account grid, BS panels, journal view, highlights).
- `src/components/feedback/FeedbackPanel.tsx` — minimal (UI: progressive reveal per VISION-2 §6).
- `src/app/**` pages — minimal (SHELL: section template, cheat sheet, question kinds, layout/theming).

**Notes**
- Commands: `npm run typecheck`, `npm test`, `npm run build`, `npm run e2e`, `npm run lint`.
- Money is integer cents; content uses whole dollars (×100).
- System `git` is broken by an Xcode install issue; use `DEVELOPER_DIR=/Library/Developer/CommandLineTools git …` until fixed.

## Phase 1 — launched 2026-11-06 (ENG, UI, SHELL, C1, C2 + ANIM started early)

Also added in Phase 0: `src/contracts/items.ts` (non-booking answer shapes) and `content/entities/bank.ts` (fixed bank account ids shared by C1/C2).

## ENG — ✅ merged
- Full booking checker (`booking.ts`): all diagnostic codes, row alignment (skips/extra rows), SPLIT_ENTRY near-miss, WRONG_ROW, traps/counterparty, BS_MISMATCH/EQUATION_BROKEN, stable ordering; generic explanations in `explanations.ts`.
- Non-booking checkers (`items.ts`) per `contracts/items.ts` and SHELL's itemIndex conventions.
- Notes: MISSING_ACCOUNT for an unbooked event has no rowId; BS-line correct parts are `{accountId}` without rowId.
- Deferred (optional contract ideas): `MISSING_ROW` code; flag distinguishing BS-line correct parts.
## UI
## SHELL — ✅ merged (f572249)
- Design tokens + light/dark/manual theme; sticky header (Sandbox, Cheat sheet drawer, theme toggle); collapsible sidebar; skip link.
- Home, section template (primer, callouts, lens, problems grouped by role, prev/next, "Coming soon"), problem page for all kinds (copy link with attempt, Open in Sandbox, perspective pair link, prev/next, reference panel, worked/faded handling).
- Question components: Classify (drag + click), DrCrPredict, EquationFill, StatementFill, MultipleChoice, CoaDesign, with fixtures/tests.
- Cheat sheet SVG page + focus-trapped drawer.
- Conventions: statement-fill itemIndex = index in answer lines; MC itemIndex = option index; blank inputs omitted.
- Manager fixes at merge: dropped out-of-scope formatting changes; keyed problem views by id.
## C1
## C2
## ANIM — ✅ merged
- `StepAnimation` (Prev/Next/Restart, keys, reduced motion) + `LedgerAnimation`; 5 animations: cash-to-checking, bank-view-deposit, loan-creates-deposit, daily-accrual, fbo-gross-up. Data test asserts balanced rows + A = L + E on every step.
- Manager: mounted on section pages 03/04/06/08/11 (`SECTION_ANIMATIONS` in SectionPage) + review gallery at `#/animations`.
- Follow-up (INT): align Coffee Co./Zap account ids in `animations/accounts.ts` with C2's entities once merged.
