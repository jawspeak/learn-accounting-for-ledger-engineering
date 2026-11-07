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

## ENG
## UI
## SHELL
## C1
## C2
## ANIM
