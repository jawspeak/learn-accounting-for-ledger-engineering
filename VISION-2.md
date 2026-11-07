# VISION-2 — `learn-accounting-for-ledger-engineering`

> Supersedes `VISION.md`. This is the build prompt + scope for the agents. Work breakdown and agent protocol live in `WORK-PLAN.md`.

## 1. Purpose

Engineers building financial ledgers need enough accounting to (a) design a Chart of Accounts (CoA) from business activities, (b) correctly read a CoA handed to them by accountants (often a table), and (c) book business events as balanced transactions. This site teaches that **by doing**: problem sets first, short primers second, rich explanations after every attempt.

It is a **static, ungated, untracked interactive explainer + practice tool**. Anyone can jump to any lesson, problem, the cheat sheet, or the sandbox at any time. No accounts, no progress tracking, no localStorage requirements. Every problem and every sandbox state is **linkable** so teammates can share a URL and discuss.

## 2. Teaching principles (apply everywhere)

1. **Problems over lectures.** Each section = a primer that fits on one screen → one worked example → one faded example (partly filled in) → a problem set (5–10 problems) → mixed review problems from earlier sections.
2. **Productive struggle, not guessing.** Don't make it easy to pattern-match. Learners commit to an account *type* before choosing an account *name*; name lists include realistic traps (see §5).
3. **Diagnostic feedback, not right/wrong.** The checker finds each specific error in an answer and reveals feedback progressively (§6). Correct parts are acknowledged; mistakes are explained by category.
4. **Hints before answers.** Each problem has 2–4 authored Socratic hints ("Whose books are we in?", "Which account are you *sure* changes, and does it go up or down?"). Revealing the solution is always possible but is the last step.
5. **Reason from the known account.** Teach the move: pick the account you're confident about → decide increase/decrease → use its normal balance to get Dr/Cr → the other side must balance → what account makes sense there?
6. **Contrasting cases.** Same event from two perspectives (you vs. bank; fintech vs. bank) placed side by side; learners rewrite one into the other.
7. **Self-explanation.** After a correct answer, an optional "Why does this work?" prompt reveals the explanation — same content as the mistake drill-down (per original vision).
8. **Interleaving.** Every section ends with a few problems from earlier sections; a standalone "Mixed Review" set pulls from everything.
9. **Round numbers.** Integer dollars only. No fractional interest math in v1 (e.g. $3,650 at 10% simple = exactly $1.00/day).

## 3. Audience & running examples

Software engineers; no accounting background assumed. Narrative arc of entities (each has its own fixed CoA):

1. **You** (a person) — personal banking. Cash-basis.
2. **First Example Bank** — the bank's view of the same events.
3. **Bean There Coffee Co.** — revenue, expenses, payables, accruals, deferrals, contra-accounts.
4. **P2P payments fintech ("Zap")** — FBO accounts, P2P transfers, fees, clearing accounts, reversals. Shown alongside the bank that holds its FBO account.

(All names fictional.)

## 4. Curriculum (sections, in order — all freely jumpable)

Each bullet under "Problems" is a required problem; agents add more of the same shape to reach 5–10 per section. Every booking problem asks for T-accounts **and**, where marked (BS), before/after balance sheets.

### 0. Start here + Cheat Sheet
- How to use the site and the builder (interactive mini-tutorial).
- **Cheat sheet** (own SVG, inspired by the classic diagram): `A = L + E` with a T for each; Dr/Cr increase sides; Equity breaks into Paid-in Capital + Retained Earnings; Retained Earnings is fed by Revenue (Cr↑), Expenses (Dr↑), Dividends/Draws (Dr↑). Mnemonic **DEALER** (Dividends, Expenses, Assets = Dr-normal; Liabilities, Equity, Revenue = Cr-normal). Pinned/one-click from everywhere, opens as a side drawer.

### 1. The Accounting Equation & Five Account Types
Primer: Asset, Liability, Equity, Revenue, Expense (+ Dividends/Draws). Expanded equation `A = L + PIC + Rev − Exp − Div`. Why expenses are Dr-normal.
Problems: classify accounts (drag into type buckets, including perspective-dependent ones like "Customer Deposits"); fill the missing number in an equation; "which statements can't be true?".

### 2. Debits, Credits, Normal Balances
Primer: Dr = left, Cr = right; nothing to do with "good/bad" or a bank statement's wording (explain why your bank statement says "credit" when your balance goes up — it's the bank's books).
Problems: given account + increase/decrease → Dr or Cr; reverse direction.

### 3. T-Accounts & Double Entry — personal banking
Problems:
- **(BS)** You deposit $100 of cash into your checking account. *(Asset swap: Checking ↑ Dr, Cash ↓ Cr; total assets unchanged.)*
- **(BS)** You transfer $500 from checking to savings.
- You get paid $2,000 salary into checking (introduces Revenue/Income → Equity for a person).

### 4. Perspectives — the bank's books
Primer + **callout "Where is the bank's money?"**: a bank's cash is mostly its reserve balance at the Federal Reserve (plus vault cash). Deposits are the bank's *liabilities*; the money itself is fungible and moves around the bank's CoA (into loans, securities, reserves). There is **no 1:1 mapping** from a customer's deposit to a slice of the Fed balance — and there won't be. Banks only hold a fraction of deposits as reserves (note for accuracy: the US statutory reserve requirement has been 0% since March 2020; banks hold reserves for liquidity/regulatory reasons rather than a fixed ratio).
Problems:
- **(BS)** Bank's view of your $100 cash deposit. *(Cash/Vault ↑ Dr; Customer Deposits – Checking ↑ Cr.)*
- **(BS)** Bank's view of your checking → savings transfer. *(Liability swap: Checking Deposits ↓ Dr, Savings Deposits ↑ Cr.)*
- **Rewrite** exercises: given one side's entry, write the counterparty's.

### 5. Journal Entries (shorthand)
Primer: the same info as T-accounts in dense form (`Dr Checking 100 / Cr Cash 100`) — this is what ledgers actually store.
Problems: convert T-accounts ↔ journal entries; book directly in journal form.

### 6. Loans — both sides
Problems (all with BS for both parties):
- **Bank lends you $1,000**, deposited into your checking. Bank: Loans Receivable ↑ Dr / Customer Deposits ↑ Cr (note: the loan *created* a deposit). You: Checking ↑ Dr / Loan Payable ↑ Cr.
- **You repay $1,000 + $50 interest** from checking. Bank: Customer Deposits ↓ Dr 1,050 / Loans Receivable ↓ Cr 1,000 / Interest Income ↑ Cr 50 (compound entry). You: Loan Payable ↓ Dr 1,000 / Interest Expense ↑ Dr 50 / Checking ↓ Cr 1,050.

### 7. Revenue, Expenses, Income Statement & Closing — Coffee Co.
Problems: owner invests cash (PIC); buy beans on credit (AP); sell coffee for cash and card; pay rent; pay AP; **(BS)** month-end income statement; closing Revenue/Expenses into Retained Earnings; owner draw/dividend.

### 8. Accruals & Deferrals (cash vs. accrual basis)
Primer: why individuals use cash basis and companies/banks must accrue.
Problems:
- **Daily interest accrual (company):** Coffee Co. holds $3,650 in a savings account at 10% simple → $1/day. Coffee Co.: daily Dr Interest Receivable / Cr Interest Income; month-end posting Dr Savings 30 / Cr Interest Receivable 30. **Bank:** daily Dr Interest Expense / Cr Accrued Interest Payable; month-end Dr Accrued Interest Payable 30 / Cr Savings Deposits 30.
- Gift cards sold (unearned revenue) then redeemed.
- Prepaid 3 months rent, expensed monthly.
- Wages earned but unpaid at month-end.

### 9. Contra Accounts
Problems: espresso machine + Accumulated Depreciation; Allowance for Doubtful Accounts; Sales Returns & Allowances; how contras display on the BS (net).

### 10. Business Processes & Trial Balance
Problems: a multi-step month at Coffee Co. booked as a problem set (rows accumulate); produce a trial balance; find the error in an unbalanced trial balance.

### 11. Fintech: FBO, P2P, Clearing, Reversals — Zap + its bank
Primer **"What is an FBO account?"**: "For Benefit Of" — an account at a bank titled to the fintech *for the benefit of* its customers. History/purpose (fintechs aren't banks; lets them hold customer money without a charter), protection (funds are the customers' — segregated from the fintech's operating account, potentially eligible for pass-through deposit insurance if records are kept properly; some states' money-transmitter rules require segregation/permissible investments). Analogy: **a landlord holding a security deposit** — they control it, but it's legally yours, and some states require it in a separate account.
**Model to teach: gross-up (on balance sheet).** Callout: some companies instead keep customer funds off-balance-sheet and track them only in a sub-ledger; we don't use that here.
Problems:
- **(BS)** Customers send $100 into Zap's FBO account. Zap: Cash – FBO (restricted asset) ↑ Dr / Customer Balances Payable ↑ Cr. Bank: Cash/Reserves ↑ Dr / Deposits – Zap FBO ↑ Cr.
- P2P: Alice pays Bob $20 inside Zap (liability-to-liability; FBO cash doesn't move; nothing at the bank changes).
- Zap charges a $1 fee (moves from customer liability to Zap revenue → sweep from FBO to operating account).
- ACH cash-out pending → **clearing/in-transit account** → settled.
- A payment booked to the wrong customer → **reversal + correcting entry** (never edit).

### 12. Capstone: Chart of Accounts design
Problems: given a business description (Zap), design the CoA (name, type, normal balance, purpose); given an accountant's tabular CoA, book a set of described events; spot what accounts are missing from a CoA.

### Mixed Review
Interleaved problems from all sections.

### Ledger-engineer's lens (sidebar in every section)
Short callouts mapping the concept to the data model: entry = set of postings; balance = sum of postings; normal balance ↔ sign convention; Dr = Cr as a DB-enforced invariant; immutability & reversals; idempotency keys; integer minor units (never floats); one business event = one atomic transaction (why split entries are wrong); sub-ledger vs GL; clearing accounts as state for in-flight money.

## 5. The T-Account Builder (core component)

Used in tutorials, every booking problem, and the Sandbox.

```
  BEFORE BS            TRANSACTIONS (rows) × ACCOUNTS (columns)                 AFTER BS
 ┌──────────┐   ┌───────────────┬───────────────┬──────────────────┬────┐   ┌──────────┐
 │ Assets   │   │ Checking (A)  │ Cash (A)      │ [+ add account]  │ ✓? │   │ Assets   │
 │  Cash 100│   │  Dr  │  Cr    │  Dr  │  Cr    │                  │    │   │  Cash   0│
 │  Chk    0│   ├──────┼────────┼──────┼────────┤                  ├────┤   │  Chk  100│
 │ Liab     │ 1 │ 100  │        │      │ 100    │                  │ ✓  │   │ Liab     │
 │ Equity   │ 2 │      │        │      │        │ [+ add row]      │    │   │ Equity   │
 │  ...  100│   ├──────┼────────┼──────┼────────┤                  │    │   │  ...  100│
 └──────────┘   │ bal 100 Dr    │ bal 0         │                  │    │   └──────────┘
   A=L+E ✓      └───────────────┴───────────────┴──────────────────┴────┘     A=L+E ✓
```

- **Columns = accounts**, each a T with Dr | Cr. **Rows = transactions.** Footer = running balance per account (shown on its normal side).
- **Canonical column order (auto-sorted, mirrors `A = L + E`):** the learner adds accounts in any order; each column snaps into its slot with a brief highlight.
  ```
  ASSETS (+ contra right after its parent) ‖ = ‖ LIABILITIES │ EQUITY: PIC │ RE │ Revenue │ Expenses │ Dividends
  ```
  - Group order: Assets (contra-assets immediately after the asset they reduce) → visible `=` divider → Liabilities → Equity (Paid-in Capital, Retained Earnings, then Revenue, Expenses, Dividends as Equity sub-groups, matching the cheat sheet).
  - Within a group: the entity CoA's order (liquidity order for assets — cash leftmost).
  - Placement uses the **type the learner chose** (a wrong type lands in the wrong group — faithful to their answer, doesn't leak the solution).
  - Sandbox: same default, plus optional manual drag-reorder.
- **Live per-row check**: ΣDr = ΣCr indicator on every row (this is structural, always shown — not a hint).
- **Live A = L + E check** on before/after balance sheets.
- Before/after BS panels appear progressively by section (off in early sections, on from §3 BS problems). In problems that ask, the learner fills in the After BS themselves.
- Journal-entry view toggle (from §5 on): same data shown as journal lines.
- Compound entries (3+ accounts in one row) fully supported.
- Keyboard-friendly; works on desktop first, usable on tablet. Phone: read-only-friendly layout is acceptable.

### Account picker (designed for retention)
1. **Choose type first** (Asset / Liability / Equity / Revenue / Expense / Dividends; contra types available from §9). Required.
2. **Then choose the name** from the **entity's full Chart of Accounts** (typically 12–25 accounts) plus 2–4 problem-specific trap accounts. Shown as a searchable list, **alphabetical, with no type labels**, in a deterministic order (same for everyone, so shared links look identical).
   - The full list is *not* filtered by the chosen type — so a type/name mismatch is a diagnosable error, not a dead end.
   - Traps are common, realistic errors: the counterparty's account (e.g. "Customer Deposits" offered in *your* books), near-synonyms with different types (Interest Receivable vs. Interest Income vs. Accrued Interest Payable), cash vs. restricted cash, operating vs. FBO.
3. Choose side (Dr/Cr) by placing the amount in the column; enter amount.

## 6. Checking & feedback (diagnostic engine)

Problems have authored solutions per row. The checker compares the learner's answer **per row, net per account**, and emits a list of typed diagnostics:

| Code | Meaning |
|---|---|
| `UNBALANCED_ROW` | ΣDr ≠ ΣCr in a row |
| `WRONG_TYPE` | right account name, wrong type chosen |
| `WRONG_SIDE` | right account, Dr/Cr reversed |
| `WRONG_AMOUNT` | right account and side, wrong amount |
| `MISSING_ACCOUNT` | solution account not present in the row |
| `EXTRA_ACCOUNT` | account present that shouldn't be |
| `COUNTERPARTY_ACCOUNT` | used an account from the other party's books (perspective error) |
| `TRAP_ACCOUNT` | picked a specific authored trap (has its own explanation) |
| `SPLIT_ENTRY` | balances correct but one business event booked as multiple rows → near-miss, explain atomicity |
| `WRONG_ROW` | posting is in the wrong transaction row |
| `BS_MISMATCH` | after-BS line doesn't match the transactions |
| `EQUATION_BROKEN` | A ≠ L + E |

**Progressive reveal** (learner clicks "Check" and then "Tell me more" to escalate, any time):
1. Count only: "2 issues. Your Checking posting is correct." (correct elements get a ✓).
2. Location: highlight the cell(s) with an issue.
3. Category: "One account has the wrong type."
4. Explanation: the authored or generic explanation for that diagnostic + link to the relevant primer/cheat sheet.
5. Reveal full solution with walkthrough.

Hints (authored, Socratic) are separate from diagnostics and available before checking. On a correct answer: ✓ + optional "Why does this work?" walkthrough (same explanation content).

Non-booking question types (classification drag-and-drop, Dr/Cr prediction, equation fill-in, BS fill-in, find-the-error, rewrite-from-other-perspective, CoA design table) use the same diagnostic + progressive reveal pattern.

## 7. Sandbox ("Scenario Board")

Standalone page using the same builder, ungraded:
- Free-text scenario description (markdown).
- One or more entities (perspectives) shown side by side, each with custom accounts (name + type).
- Rows, optional before/after BS, journal view.
- Live structural checks only (row balance, A = L + E).
- **Entire state encoded in the URL** (versioned, compressed) → shareable in Slack, usable ad hoc to explain designs later.
- "Open this problem in Sandbox" button on every problem.

## 8. Linking

- Hash routing (GitHub Pages friendly): `#/s/<section>`, `#/p/<problem-id>`, `#/sandbox?d=<state>`, `#/cheatsheet`.
- A problem link may include the learner's current attempt (`#/p/<id>?a=<state>`) so people can share "here's what I got, why is it wrong?".
- Copy-link button on every problem.

## 9. Animations

No video. Short **step-through animations** in SVG/CSS/JS with Prev/Next controls (not autoplay): e.g. money moving from cash to checking with both T-accounts and both balance sheets updating; the same deposit shown from the bank's side; the loan creating a deposit; daily accruals stacking up then posting. Target 4–6 animations in v1.

## 10. Tech

- Vite + React + TypeScript; plain CSS with design tokens; static build; GitHub Pages via GitHub Actions.
- Content as data: entity CoAs and problems in JSON/TS files validated by a schema (zod) at build/test time. Primers/explanations in markdown.
- Amounts stored as integer minor units internally; displayed as whole dollars in v1.
- Tests: Vitest for engine/checker/URL codec; **every problem's authored solution must pass the checker with zero diagnostics** (CI-enforced); Playwright smoke tests for builder, a sample problem per type, sandbox URL round-trip.
- Accessibility: keyboard operable, sufficient contrast, not color-only signals (✓/✗ icons + text).
- Light/dark theme.

## 11. Out of scope (v1)

Progress tracking/accounts, facilitator/group features, multi-currency, fractional interest/rounding, textbook-sourced problems (originals only), game/Steam version, cash-flow statement.

## 12. Definition of done

- All sections 0–12 + Mixed Review present with primer, worked example, faded example, ≥5 problems each, hints and explanations.
- All authored solutions pass the checker; each problem blind-solved by a reviewer agent (see WORK-PLAN) and discrepancies resolved.
- Sandbox URL round-trips; all links work on GitHub Pages.
- Final human review pass by the owner.
