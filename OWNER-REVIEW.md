# OWNER-REVIEW — things for you to revisit

Maintained by the manager agent. Newest at the bottom of each list. Check off or reply inline.

## Decisions I made on your behalf (please sanity-check)
- [ ] Bank CoA fixed account ids (`content/entities/bank.ts`) — e.g. separate "Cash – Vault" and "Reserves at the Federal Reserve" assets; deposits split into Checking / Savings / Business / FBO liabilities.
- [ ] Non-booking answer shapes (`src/contracts/items.ts`) — e.g. CoA-design = include/exclude + type per candidate account.
- [ ] Ledger-engineer's-lens callouts are written by each content agent for its own sections (instead of C2 writing all of them, as WORK-PLAN originally said).

- [ ] Sandbox: journal view on/off isn't saved in shared links (`SandboxEntity` has no field). Easy to add if you want it.

### Accounting judgment calls — sections 0–6 (C1)
- [ ] §06 / §05: the bank books loan/savings interest directly to Interest Income/Expense when paid (no accrual); prompts flag it as a simplification and point to §08.
- [ ] Groceries on a credit card are expensed at swipe (cash basis treats a card charge as paid); paying the card bill only reduces the liability.
- [ ] Payment to someone at another bank: bank books Dr Customer Deposits / Cr Reserves at the Fed, same-day settlement, no in-transit step.
- [ ] Payroll and rent rewrite problems assume the employer/landlord also bank at First Example Bank (so they're liability swaps); prompts say so.
- [ ] Bank opening BS: assets $2.0M, liabilities $1.8M, equity $0.2M; vault cash + reserves ≈ 11.8% of deposits.
- [ ] A person's car is an asset with no depreciation; "Gifts Received" is treated as income.
- [ ] Faded examples in §01/§02 (non-T-account questions) can't be partly pre-filled (contract only supports prefill for bookings), so their walkthrough solves item 1 instead. Could add prefill for other kinds later.

## Stuck / blocked

## Needs your review later
