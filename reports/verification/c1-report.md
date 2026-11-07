# VER-2 / C1 verification — sections 00–06

**Method.** `reports/verification/c1-blind-dump.ts` (run with `npx tsx`) prints every problem with no solutions, answers, hints or explanations, and with account types hidden. I solved all 68 problems from that dump (`c1-blind-answers.md`) before opening any section source. I then compared my answers with the authored solutions, read every primer, callout and lens, and checked the coverage that VISION-2 §4 requires.

## Summary

| Category | Count |
|---|---|
| Problems checked | 68 (§0 4, §1 10, §2 11, §3 11, §4 11, §5 11, §6 10) |
| ✅ agree, no issue | 55 |
| ❌ authored answer wrong | **0** |
| ⚠️ prompt ambiguous | 2 |
| 📝 teaching issue (problem-level) | 11 |
| 📝 primer/callout precision (section-level) | 3 |

Every authored solution, answer key, equation blank and multiple-choice key matched my blind answer. The only differences came from presentation choices (findings 1 and 2).

**VISION-2 coverage.**
- §3: the required (BS) problems show balance sheets (03-cash-to-checking, 03-checking-to-savings). 03-salary is present.
- §4: the required (BS) problems show balance sheets (04-bank-cash-deposit, 04-bank-checking-to-savings). Rewrite exercises are present.
- §6: all four required loan problems show balance sheets.
- The Fed reserve callout is accurate: 0% since March 2020, no 1:1 mapping, fungible money.
- The "loan created a deposit" callout is accurate.

## Findings (most severe first)

| # | Id | Sev | Problem | Suggested fix |
|---|---|---|---|---|
| 1 | 01-expanded-equation | ⚠️ | "Revenue (so far this year)" implies earlier years may exist. If so, beginning retained earnings are missing and the assets can't be computed. The primer's `A = L + PIC + Rev − Exp − Div` has the same gap: it only holds in an entity's first period. | Prompt, first line → "A small company **in its first year of business** (so no retained earnings carried over yet) shows:". Primer: after the expanded equation, add "*(This is for an entity's first period. Later periods add the Retained Earnings carried over: `A = L + PIC + RE + Rev − Exp − Div`.)*" |
| 2 | 03-pay-utilities | ⚠️ | The checker expects the after BS to show **Net Worth 2,300** and **Utilities Expense 90** as separate lines (no closing). Nothing in the prompt or primer says so. Hint 3 ("an expense reduces the equity side") invites the learner to put Net Worth = 2,210, which is then marked BS_MISMATCH. 06-car-payment has the same trap, but its hint 3 helps more. | Append to the prompt: "(In the after balance sheet, Net Worth keeps its opening balance until period-end; the expense appears as its own line on the equity side.)" Add the same sentence to the §3 primer after "The **balance sheets** before and after…". In 06-car-payment, change hint 3 to "…Interest Expense appears as its own line on the equity side; Net Worth itself doesn't change until period-end." |
| 3 | 02-predict-faded | 📝 | Title and prompt say "decreases", but items 2 (Net Worth ↑) and 4 (Groceries ↑) are increases. A careless learner will flip them. | Title → "Dr or Cr? (increases and decreases, partly worked)". Prompt → "Now a mix of **increases and decreases** — read each arrow. The walkthrough does the first one; you do the rest." |
| 4 | 03-pay-rent | 📝 | The explanation says "A = L + E still holds: 5,100 → 3,900". The BS shown keeps Net Worth at 5,100 and adds a Rent Expense line, so "3,900" doesn't appear anywhere. | → "…so A = L + E still holds: assets 5,100 → 3,900; equity = Net Worth 5,100 − Rent Expense 1,200 = 3,900." |
| 5 | 06-car-payment | 📝 | Same BS presentation issue as #2. | See #2 (hint 3 rewording). |
| 6 | 00-tour-savings-to-cash | 📝 | Only two hints, and hint 2 states both directions ("Savings went down; Cash went up…"). This removes the struggle in the first practice problem. | Hint 2 → "Did your cash go up or down? And savings? Both are assets — which side increases an asset?" |
| 7 | 01-review-checking-to-cash | 📝 | Hint 2 states both directions (same pattern as #6). | Hint 2 → "One asset went up and one went down. Which is which, and which side increases an asset?" |
| 8 | 06-review-rent-compound | 📝 | Hint 2 ("Two assets went down; one expense went up by the total") is the whole answer. | Hint 2 → "Which accounts did the money come out of, and what did it pay for?" Optional hint 3: "Two credits, one debit." |
| 9 | 01-classify-perspective | 📝 | The hints answer items directly. Hint 1 settles item 2 ("Your deposit is something the bank **owes** you"). Hint 2 settles items 3–6. | Hint 1 → "In *this* entity's books, is it owned, owed, or a flow?" Hint 2 → "Every claim has two holders: who is owed, and who owes?" |
| 10 | 05-t-to-journal | 📝 | The prompt asks "What happened in each?", but nothing grades it and the prompt doesn't say so. | → "…in the **journal view**. Then say to yourself what happened in each (the explanation tells you)." |
| 11 | 05-journal-to-t | 📝 | "What is the net change in Checking?" is likewise ungraded. | → "…Then work out the net change in Checking (check it against the explanation)." |
| 12 | 05-review-rewrite-interest | 📝 | EXTRA_ACCOUNT says "Interest Income is the bank's revenue from *loans*". The bank CoA describes it as loans **and securities**. | → "Interest Income is the bank's revenue from loans and securities." |
| 13 | 06-review-overdraft-fee | 📝 | The id says "overdraft" but the prompt describes a returned-payment fee. This is cosmetic, and changing the id would break URLs. | Keep the id. Optionally change the prompt to "…a **$35 overdraft fee**…" and the label to "Overdraft fee" so they match. |
| S1 | §1 primer | 📝 | The expanded equation omits retained earnings carried over from earlier periods. | See #1. |
| S2 | §4 callout "Where is the bank's money?" | 📝 | "A bank's cash is mostly its reserve balance at the Fed" is true for most large US banks. Many small banks instead hold most of their balances at a correspondent bank. | Append to that bullet: "(Some smaller banks hold much of it as balances at a larger *correspondent* bank instead — same idea, one more hop.)" Optional: "FDIC, up to the insured limit — currently $250,000 per depositor, per bank, per ownership category". |
| S3 | §6 callout "The loan created a deposit" | 📝 | "Reserves only come into it when you **spend** the money at another bank" leaves out cash withdrawal, which reduces vault cash. | → "Reserves (or vault cash) only come into it when you **spend** the money at another bank or withdraw it as cash: …" |

## Checked and confirmed correct (notable)

- **Perspective rewrites, all correct.**
  - Same-bank payments are liability swaps (payroll, rent).
  - Other-bank payments move reserves (utilities, 06-loan-spent-elsewhere).
  - Interest paid to savers is booked Dr Interest Expense / Cr Deposits – Savings.
  - The fee entries mirror each other.
- **Bank balance sheets balance.** The opening BS is A 2,000,000 = L 1,800,000 + E 200,000. `bankAfterLoan` and the 06-loan-spent-elsewhere answer (2,000,600 = 1,800,600 + 200,000) also balance.
- **Personal balance sheets balance.** Every opening BS and every authored after-figure ties out (e.g. 05-buy-car, 06-you-repay, 06-car-payment).
- **Traps are realistic and the explanations are accurate.** The ids don't collide with the entity CoA. Kinds are labelled correctly (counterparty vs near-synonym).
- **Cash-basis notes are correct.** The credit-card expense is recognised at swipe, and interest is recognised when received.
- **§2 lens and 02-signed-amounts are correct.** Under Dr = +, a liability shows a negative sum, and an overdraft is a positive sum.
- **The §5 lens and 05-one-event-one-entry correctly teach atomicity and immutability.**
