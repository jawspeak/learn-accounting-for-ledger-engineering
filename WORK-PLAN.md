# WORK-PLAN — how we build VISION-2 with parallel agents

## Roles

- **Manager (main Claude Code session):** owns the contracts, spawns workstream agents, reviews and merges their branches, runs integration, resolves cross-stream questions, reports to the owner.
- **Workstream agents:** background subagents launched by the manager via the Agent tool, each in its **own git worktree** (`isolation: "worktree"`) on its own branch. They don't talk to each other; questions go to the manager in their final report (or via the `QUESTIONS` section of `STATUS.md`).
- **Owner (you):** approves VISION-2 and this plan, answers escalations, does the final human review.

## Ground rules

1. **Contracts first, frozen.** Phase 0 produces `src/contracts/` (TypeScript types + zod schemas). Workstreams code against them. Only the manager changes contracts; a needed change is requested in the agent's report, not made locally.
2. **Directory ownership.** Each workstream writes only in the paths it owns (table below). Anything else → ask the manager. This makes merges conflict-free.
3. **Definition of done per task:** `npm run typecheck && npm test && npm run build` pass; new code has tests; a short entry appended to `STATUS.md` (what's done, what's stubbed, open questions).
4. **Small branches, frequent merges.** Each agent run = one task (or a small set) → branch `ws/<id>-<task>` → manager reviews diff and merges into `main`. Next tasks start from updated `main`.
5. **Accounting correctness is verified twice.** Content authors write solutions; a different agent **blind-solves** each problem (sees only the prompt + CoA, not the solution), then the manager diffs results. Disagreements → manager adjudicates or escalates to owner.
6. **No pushing/deploying** without owner approval.

## Phases & workstreams

### Phase 0 — Foundation (manager or 1 agent, serial, ~1 run)
- `git init`, Vite + React + TS scaffold, ESLint/Prettier, Vitest, Playwright, GitHub Actions Pages workflow (not yet enabled).
- `src/contracts/`: `AccountType`, `Account`, `EntityCoA`, `Posting`, `TransactionRow`, `BalanceSheet`, `Problem` (all question kinds), `Hint`, `Diagnostic` (codes from VISION-2 §6), `SandboxState`, URL state version.
- Stub implementations + one end-to-end example problem (§3 cash → checking) so every stream has a working sample.
- Routing skeleton, empty section pages.

### Phase 1 — Parallel build (5 agents)

| ID | Workstream | Owns | Notes / suggested model |
|---|---|---|---|
| **ENG** | Engine: balances, BS computation, trial balance, **diagnostic checker** (all codes, split-entry detection, counterparty/trap detection), URL codec (versioned + compressed) | `src/engine/**` | Pure TS, heavy unit tests. **Opus** — correctness critical. |
| **UI** | T-Account Builder: grid, account picker (type → name), per-row check, BS panels, journal view, progressive-reveal feedback panel, hints UI | `src/components/builder/**`, `src/components/feedback/**` | Codes against contracts + engine stubs. **Opus or Sonnet**. |
| **SHELL** | App shell: nav (jump anywhere), section page template (primer / worked / faded / problems / review), cheat-sheet SVG drawer, non-booking question components (classify drag-drop, Dr/Cr predict, equation fill, BS fill, find-the-error, CoA table), copy-link, theming, a11y | `src/app/**`, `src/components/questions/**`, `src/styles/**` | **Sonnet**. |
| **C1** | Content: entities You + Bank + their CoAs; sections 0–6 (incl. Fed reserves callout, loans) | `content/entities/{you,bank}.*`, `content/sections/0[0-6]*/**` | **Opus** — accounting accuracy. |
| **C2** | Content: Coffee Co. + Zap CoAs; sections 7–12 + Mixed Review; Ledger-engineer's-lens callouts for all sections | `content/entities/{coffee,zap}.*`, `content/sections/0[7-9]*/**`, `content/sections/1*/**`, `content/review/**`, `content/lens/**` | **Opus**. |

(Five concurrent agents matches the default workflow-size guideline. If you want more parallelism, split C2 into C2a (7–10) and C2b (11–12 + review).)

### Phase 2 — Integration & verification (3–4 agents)

| ID | Task | Owns |
|---|---|---|
| **INT** (manager) | Wire real engine into UI, replace stubs, fix seams | — |
| **SBX** | Sandbox page: multi-entity, custom accounts, scenario text, URL share, "open problem in sandbox" | `src/app/sandbox/**` |
| **ANIM** | 4–6 step-through SVG animations (VISION-2 §9) | `src/components/animations/**` |
| **VER-1 / VER-2** | Blind-solve: VER-1 solves C2's problems, VER-2 solves C1's; produce diff reports. Also review explanations/hints for accuracy and tone | `reports/verification/**` (read-only on content) |
| **E2E** | Playwright smoke tests: each question type, a problem from each section, sandbox round-trip, GitHub Pages base path | `e2e/**` |

### Phase 3 — Polish & release
- Manager fixes verification findings (or dispatches content agents to fix their own).
- Owner human review pass (I'll publish a preview build link/checklist).
- Enable Pages workflow and push — owner approval required.

## Dependency graph

```
Phase 0 (contracts + scaffold)
   ├── ENG ──┐
   ├── UI  ──┼── INT ── SBX, ANIM, E2E ──┐
   ├── SHELL ┘                            ├── Phase 3 → owner review → deploy
   ├── C1 ── VER-2 ───────────────────────┤
   └── C2 ── VER-1 ───────────────────────┘
```

## How agents are launched (mechanics)

- **Recommended: Agent tool, background, `isolation: "worktree"`** — the manager writes each agent a self-contained brief: link to VISION-2 section(s), contract files, owned paths, task list, DoD, "report questions, don't change contracts". Manager is notified on completion, reviews the diff, merges.
- **Alternative: Workflow tool** — runs the whole phase as one deterministic script (pipeline of build → verify). More hands-off but less steerable; requires your explicit opt-in ("use a workflow").
- Agent brief template:
  ```
  You are workstream <ID> for learn-accounting-for-ledger-engineering.
  Read: VISION-2.md §<n>, WORK-PLAN.md (ground rules), src/contracts/**.
  You may only modify: <paths>.
  Tasks: <numbered list>.
  Done when: typecheck + tests + build pass; STATUS.md entry appended.
  Do not modify contracts; list needed contract changes and questions in your final report.
  ```

## Status tracking

`STATUS.md` at repo root: one section per workstream — Done / In progress / Stubbed / Questions for manager. Manager summarizes to the owner after each phase.

## Escalate to owner when
- An accounting treatment has more than one defensible answer (beyond what VISION-2 already decides, e.g. FBO gross-up).
- Scope change, contract change affecting >1 stream, or anything that publishes/deploys.
