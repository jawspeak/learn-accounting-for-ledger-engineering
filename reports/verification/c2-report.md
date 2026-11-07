# VER-1 / C2 verification — sections 07–12 + Mixed Review

**Method.** `reports/verification/c2-blind-dump.ts` (run with `npx tsx`) prints every problem with no solutions, answers, hints, explanations, trap explanations or account types. For statement-fill problems it prints only the account ids the UI lists, without amounts. I solved all 74 problems from that dump (`c2-blind-answers.md`) and tie-checked every opening balance sheet before opening any section source. I then compared my answers with the authored solutions. I also read every primer, callout, lens, hint, explanation, diagnostic override and trap explanation, plus `coffee.ts` and `zap.ts`.

## Summary

| Category | Count |
|---|---|
| Problems checked | 74 (§7 11, §8 10, §9 9, §10 9, §11 13, §12 9, Review 13) |
| ✅ agree, no issue | 65 |
| ❌ authored answer wrong | **0** |
| ⚠️ prompt ambiguous | 2 |
| 📝 teaching issue (problem-level) | 7 |
| 📝 primer/callout/lens/entity precision (section-level) | 6 |

Every authored answer matched my blind answer: all booking solutions, the statement-fill answers (IS 9,000/1,800/1,500/2,000/90; contra BS; TB 35,100 = 35,100; Zap IS 3/8,000/45), classify keys, Dr/Cr keys, MC keys (A; ABE; ABC; A; ABC; A; AB) and the CoA-design include/exclude/type set. All opening balance sheets balance. Every number quoted in explanations ties out (e.g. FBO 149 = 79 + 70; 1,299 = 700 + 400 + 199; 350 = 100 + 100 + 149 + 1; RE 2,610 / 1,530; net loss 1,010 / 8,042; drafts +400 − 90 = 310).

**VISION-2 coverage.**
- §7: all listed problems present.
- §8: all four required problems present. The bank side uses Business Deposits rather than "Savings Deposits", which is consistent because Bean There is a business customer.
- §9: the net-BS display problem is present.
- §10: accumulating month, TB and find-the-error are present.
- §11: FBO uses the gross-up model, with the off-BS model mentioned in a callout. FBO (BS), bank side, P2P, fee + sweep, ACH clearing and the reversal + correction are all present.
- §12: design, book-from-table and what's-missing are present.

## Findings (most severe first)

| # | Id | Sev | Problem | Suggested fix |
|---|---|---|---|---|
| 1 | 08-mc-cash-vs-accrual | ⚠️ | "delivered **$400** of catering, invoiced and paid in December" can be read as *delivered* in December too, which gives $150 (not an option). It also contradicts 08-catering-invoice, where the invoice is sent Nov 29. The key ($550) assumes November delivery. | Bullet → "- delivered **$400** of catering on Nov 29 (invoiced that day, paid in December)," |
| 2 | 10-rv-grinder-contribution | ⚠️ | The grinder must go to **Equipment – Espresso Machine**. Nothing in the prompt says grinders belong there; only the CoA *description* says "Espresso machine and grinders", and the picker shows names only. A careful learner may hesitate or look for another asset. rv-grinder-depreciation handles this with "(it's recorded in the Equipment account)". | Append to the prompt: "(Bean There records all its equipment, grinders included, in **Equipment – Espresso Machine**.)" Better (entity-wide): rename the account to "Equipment – Espresso Machine & Grinders" or simply "Equipment". |
| 3 | 07-card-sales | 📝 | (a) The note says booking the fee at settlement "doesn't change the month's totals". That's false when a sale settles after month-end: the fee then lands in the next month. (b) Hint 2 names the exact account, which takes away the struggle on a d2 practice problem. | (a) → "(Strictly the fee is incurred at the moment of sale; booking it at settlement is a common simplification. It's harmless within a month, but sales that settle after month-end need the fee accrued.)" (b) Hint 2 → "Card money in flight is owed to Bean There by the processor. Which asset in Bean There's chart is for that?" |
| 4 | 07-rv-bank-till-deposit | 📝 | The explanation says that in Bean There's books the deposit "is just an asset-to-asset move (both are in Bean There's Cash)". Bean There keeps till and bank in **one** Cash account, so it books **nothing**. Calling it a "swap" muddles the contrast. | → "Compare with Bean There's books: its Cash account covers both the till and the bank account, so moving till cash into the bank needs **no entry at all** (with separate accounts it would be an asset-to-asset swap). For the bank, the same event is a *new asset + new liability*." |
| 5 | 08-interest-month-end | 📝 | The prompt says "10% simple interest" and then the footnote says "that's compounding". The two read as contradictory. | Footnote → "_(Because the posted $30 joins the balance, next month's interest is calculated on $3,680, so monthly posting effectively compounds the 10% simple rate. We stop here.)_" |
| 6 | 09-allowance-estimate | 📝 | "The expense lands in the month the revenue was earned (matching)" is imprecise. The $3,000 balance may include earlier months' invoices. The point is to recognise the expected loss *before* a specific default. | → "The expected loss is recognised now, while the receivables are on the books, rather than later when a specific client defaults (matching)." |
| 7 | 10-december-adjustments | 📝 | The December story has Savings 3,650 earning $1/day (established in §8), but the "month-end adjustments" include no interest accrual. A learner who absorbed §8 will look for a fifth adjustment. The TB/narrative is also silent on this. (Dec 1 Savings 3,650 also ignores §8's Nov 30 posting to 3,680.) | Append to the prompt: "(To keep December short, we ignore interest on the savings account this month.)" Add the same to the §10 primer's December table caption. |
| 8 | 12-table-card-topup | 📝 | After row 1, Carol's wallet is credited before the money arrives: Cash – FBO 1,000 < customer balances 1,300. That breaks the §11 FBO invariant as stated (see S1), and the explanation is silent. This is a real-world issue: fintechs prefund the FBO account or treat settlement receivables as part of the reconciliation. | Append to the explanation: "Between rows 1 and 2, Cash – FBO (1,000) is $300 short of customer balances (1,300); the gap is the Settlement Receivable. Reconciliations include in-flight receivables, and many fintechs pre-fund the FBO account from operating cash so that customer balances are always fully backed." |
| 9 | rv-zap-income-statement | 📝 | Hint 3 says "Accrued costs…", but the only cost row is an **invoice received** (AP), not an accrual. | Hint 3 → "Costs incurred this month are expenses even if they haven't been paid yet." |
| S1 | §11 primer invariant; §12 lens | 📝 | `Cash – FBO = Σ Customer Balances + Pending Cash-outs + Zap fees not yet swept` is incomplete. It fails in 11-suspense (FBO 275 = customers 200 + **Suspense 75**) and in 12-table-card-topup (customers credited before the processor settles). This is presented as "the invariant Zap's engineers check every day", so it should be exact. | §11 primer code block → `Cash – FBO + in-flight receipts (Settlement Receivable, Cash in Transit)  =  Σ Customer Balances + Pending Cash-outs + Suspense + Zap fees not yet swept`. §12 lens last bullet → "*Cash – FBO (+ in-flight receipts) = customer balances + pending cash-outs + suspense + unswept fees*." |
| S2 | §11 callout "What is an FBO account?" | 📝 | The example title "First Example Bank, custodian for the benefit of Zap customers" makes the **bank** the custodian. In practice the fintech (or its agent) is the custodian or account holder, and the bank holds the deposit. The pass-through rules need the bank's records to disclose that custodial relationship. | → "(something like "**Zap Inc., as custodian, FBO its customers**" or "Zap Inc. FBO Zap Customers")". Optionally add to the pass-through bullet: "(When records were incomplete — as in the 2024 Synapse collapse — customers waited months to get their money.)" |
| S3 | §8 primer, line 1 | 📝 | "records them when they are *earned* or *incurred* — whenever the cash moves" reads as "at the time the cash moves", the opposite of the intended meaning. | → "— **regardless of when** the cash moves." |
| S4 | §7 lens, last bullet | 📝 | `Card Receivables` is described as the state "between 'authorized' and 'settled'". Revenue and the receivable arise at sale/capture, not authorization. | → "between 'captured' (sale complete) and 'settled'." |
| S5 | §7 primer, conventions | 📝 | "(In a sole proprietorship the same accounts are called Owner's Capital and Owner's Draws — identical mechanics.)" overstates it. A sole proprietorship has no Retained Earnings: net income and draws close into Owner's Capital. | → "(In a sole proprietorship they're Owner's Capital and Owner's Draws, and there's no separate Retained Earnings: profit and draws close straight into Owner's Capital.)" |
| S6 | §12 CoA table (12-table-hosting, -card-topup, -month; primer) | 📝 | Rows 2010–2012 say "Sub-ledger of 2000 control", but the table has no 2000 row. Learners are told the notes mean detailed accounts roll up into a control account they can't see. | Add a row: `| 2000 | Customer Balances Payable (control) | Liability | Cr | Total of 2010–2012; the one line on the balance sheet |` (not postable). Or change the notes to "Rolls up to Customer Balances Payable". |

## Author's judgment calls — checked

| Call | Verdict |
|---|---|
| Per-customer liability accounts at Zap | ✅ Sound for teaching (P2P becomes visible). Both the `zap.ts` header and the §11/§12 lenses say production uses a sub-ledger rolling up to one control account. Only S6 (missing 2000 row) needs fixing. |
| Suspense as a liability | ✅ Correct for unidentified *receipts* into customer funds (owed to an unknown party). The unclaimed-property note is accurate. |
| Inventory by month-end count (periodic) | ✅ Acceptable small-business practice. It's stated in the primer and in 09-sales-returns / rv-card-return. Putting milk/cups in Inventory (not Supplies Expense) is a stated policy, so the trap is fair. |
| Card fee booked at settlement | ✅ Common simplification, and it's disclosed. Needs the month-end caveat (finding 3a). Treating the fee as an expense rather than a revenue reduction is correct (the processor is not the customer). |
| Closing directly to RE; Income Summary as trap | ✅ The prompt says "directly into Retained Earnings", the explanation mentions the Income Summary route, and the trap explanation is fair, not "wrong accounting". |
| ACH return modelling | ✅ Pending → settled via clearing; the return is booked as a new event Dr FBO / Cr customer. Realistic (an R03/R04 return comes back within ~2 banking days). The note about a returns-clearing alternative is accurate. |
| 3-row wrong-customer correction | ✅ Correct. Reversal = exact mirror, then the correct entry. The explanation of why a netted Carol→Bob row misleads is accurate. |
| Trial balance omitting zero lines | ✅ The prompt says "every account with a non-zero balance", and hint 3 confirms Card Receivables is omitted. |
| Review loan repayment clears previously accrued Interest Receivable | ✅ Correct (Dr Business Deposits 5,100 / Cr Loans Receivable 5,000 / Cr Interest Receivable 100). Crediting Interest Income would double-count. The cross-reference to the §6 cash-style version is accurate. |

## Facts checked and confirmed accurate
- **FBO callout.**
  - Segregation is accurate and suitably hedged ("meant to belong to the customers").
  - The pass-through conditions (titling plus records showing each beneficiary's share) are correct, and the callout correctly says it protects against the **bank** failing, not the fintech.
  - The money-transmitter claim ("segregated or backed by permissible investments") is accurate.
  - The landlord/security-deposit analogy is apt.
- **Gross-up vs off-balance-sheet callout.** Accurate and appropriately non-committal.
- **§8 accrual callout.** Accurate on all points: US GAAP requires accrual, the small-business tax cash method is separate, and bank regulatory reports are on an accrual basis.
- **§9 contra content.** Accurate: NBV, net receivables, allowance-method write-off with no expense at write-off, contra-revenue for returns/allowances, and "depreciation is not a savings account".
- **§10 content.** Accurate: TB limits, the divisible-by-9 and twice-the-amount heuristics, and reverse-don't-edit (with the draft-row exception stated).
- **Bank-side entries.** All consistent with §4–§6 conventions: same-bank moves are liability swaps; other-bank moves change reserves; physical cash goes through the vault.
