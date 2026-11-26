# Evidence platform tests

Command: `npm test` in `platform-app` (Node.js 22.23.4).

Result: 18 passed, 0 failed.

- server-side access boundaries hide other schools, drafts, and metadata
- an expired or revoked auditor grant cannot read the assigned school
- 24/24 versus 36/18 coach-hours is 1 versus 2 per hour and 2×
- the multiplier is suppressed when scope, rubric, baseline, or coverage does not match
- a learning guardrail holds an efficiency gain
- a zero baseline per hour does not produce a multiplier
- missing rates stay blank instead of becoming zero
- snapshot JSON is stable and order-independent
- the committed redacted pack matches a fresh export
- the digest ledger is a separate database and stays append-only
- Vercel stays blocked until both Turso databases are named
- each role home is a short visual page with one next step
- coach submit, organiser approval, correction, and auditor export
- the practice sorter cannot complete a season project, and the SDG 12 record is separate
- season comparison, guardrail hold, and the U.S. copy stay on the organiser screen
- approved rows, events, and snapshots cannot be rewritten in place
- legal hold blocks removal and retention labels are available
- integrity, provenance, and search stay inside the caller scope
