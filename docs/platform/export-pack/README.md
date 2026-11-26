# Example redacted export pack

This folder is a fictional export from the local evidence demo. It is the pack an assigned auditor receives for the Cameroon cohort's rubric claim after the dated correction from 6 finishers to 5.

The files were produced by `npm run write-example-pack` in `platform-app`. Digests in `manifest.json` are SHA-256 of the other files. The two snapshot digests are different. Version 1 remains the superseded authorised snapshot (6/8). Version 2 is the current approved snapshot (5/8).

Nothing here is a real school, learner, or AfroBot result. The pack has no roster, no other school's records, and no withdrawn private note. Re-check the snapshots with:

```
node scripts/validate-snapshot.mjs ../docs/platform/export-pack/snapshots.json
```

Run that from `platform-app`.
