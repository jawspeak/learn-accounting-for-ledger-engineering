## Vision `learn-accounting-for-engineering` Teaches Software Engineers Enough Accounting To Effectively work in Ledgers

You are an engineer, working on a financial/accounting ledger system. 
Understanding the fundamentals of accounting are critical to effectively think about the features a ledger needs, as well as how to use a ledger to book transactions.

In this lesson you will understand:

- What is a Chart of Accounts
- Fundamental types of Accounts: Asset, Liability, Equity; and debit vs credit normal
- In Double Entry Accounting: debits must equal credits
- The Fundamental Accounting Equation invariant (Assets = Liabilities + Equity)
- Using T-Accounts to figure out accounts involved in a transaction
- Using T-Accounts to figure out the accounts involved in a business process
- Connecting transactions to the Balance Sheet impact
- Understandiing and rewriting transactions (in T-Accounts form) from different entity/party perspectives
- Contra-accounts special cases

There are quizes at the end of each section, you should have a perfect score or understand any mistakes.
This is best performed in a group to be able to discuss with others on the team learning this.

## LLM Prompt to build the Vision

I want you to create a static web and javascript site that introduces the above sections and has quizes after each.
You may create short videos or animations to explain the different concepts.
Quizes should be interactive and more than just multiple choice.
When a Quiz is answered correctly or incorrectly, have a way to drill more into a mistake (or optionally go deeper with the explanation if correct - same content).
Use best practices for teaching and retention. 
This is an optional learning system, so people should be able to jump around to anything without any gates or long click-through workflows. 
The bulk of the quizes need to go into T-Accounts, and we should come up with some creative and novel interactive ways for people to build their T-Account based solutions to questions.
- T-Accounts are a critical and visual way to understand and reason about how to book a business activity into a transaction
- T-Accounts visually have one row per transaction, and you can add as many accounts as needed to book the activity and use dr vs cr normal plus debits must equal credits to reason through what's needed.
- When working through a problem, given as a word based instruction, have a UI where the learner can add T-Accounts in and in a problem set the T-Accounts accumulate as multiple rows (transactions) are entered.
- There should be a per line check that sum of dr's == sum of cr's.
- This visual builder can be introduced incrementally to help the learner understand what T-Accounts are and how to book transactions
- It should be a standalone tool also that someone could jump to and use for general purpose problem solving, and save everything in the URL so it is sharable by a link
- Over time it is nice to progressively add in the 'before' balance sheet (on the left), the transaction in T-Accounts in the middle, and the 'after' balance sheet (on the right) to show how the transaction moves the BS from before to after.
- Introduce the cheat sheet of the A = L + E equation and T-Accounts diagram that shows how different accounts are debit or credit normal, and how under E various other accounts feed into it (paid-in-capital and retained earnings, of which breaks up into revenue and expenses, etc)
- Teach how people can start with an account they know needs to increase or decrease and thus reason the Dr vs Cr in the first T-Account, and then from there build on figuring out what else is needed.
- The point here is to teach people to understand and learn about accounting fundamentals, because the audience is engineers who are building a ledger and establishing the chart of accounts needed for various GL's (they either have to figure out based on business activities, or given to them by accountants e.g. in a tabular format)


