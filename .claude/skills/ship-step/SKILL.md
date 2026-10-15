---
name: ship-step
description: Use when finishing any build step in the Pip repo, before committing. Runs the definition-of-done checks from PROJECT.md section 10.10 and commits.
---

# Ship a step

1. From the repo root run `npm run check:shared`, `npm run typecheck`, `npm run lint` and `npm test`. Fix failures before going on.
2. If anything in tv/ changed, build and run the TV app on the Vega Virtual Device with the commands in tv/README.md.
3. Run the step's "Done when" checks from PROJECT.md section 13 and keep their real output.
4. Update package READMEs if commands or environment variables changed.
5. If an Amazon tool cost more than 15 minutes, add an entry to docs/friction-log.md.
6. Commit with the step's Conventional Commits message.
7. Report: files changed, checks run with output, anything unverified, anything for "Later".
