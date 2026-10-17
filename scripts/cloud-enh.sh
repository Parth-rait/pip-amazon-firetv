#!/bin/sh
# Starts a Claude cloud session that builds PROJECT_enh.md from the current mac/film-and-tv.
# Commits PROJECT_enh.md, pushes the branch (the cloud starts from the pushed commit), then
# creates the session. Usage: sh scripts/cloud-enh.sh
set -e
cd "$(dirname "$0")/.."

if [ ! -s PROJECT_enh.md ]; then
  echo "PROJECT_enh.md is empty: write the enhancements into it and save it (Cmd+S) first."
  exit 1
fi
if [ "$(git rev-parse --abbrev-ref HEAD)" != "mac/film-and-tv" ]; then
  echo "Check out mac/film-and-tv first."
  exit 1
fi

git add PROJECT_enh.md
if ! git diff --cached --quiet; then
  git commit -q -m "docs: add the enhancement brief (PROJECT_enh.md)" \
    -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
fi
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "Note: uncommitted changes stay on this Mac; the cloud will not see them."
fi
git push -u origin mac/film-and-tv

PROMPT_FILE=$(mktemp)
cat >"$PROMPT_FILE" <<'EOF'
PROJECT_enh.md (repo root) is the controlling brief for this session: read it in full and follow it, starting at its Section 4.

First read CLAUDE.md, docs/vnext/PLAN.md, docs/vnext/AUDIT.md and docs/vnext/REPORT-phase-1-2.md. Much of PROJECT_enh.md is already partly built on this branch: quiet viewing and Pip on demand, semantic inputs through server/src/actions.ts with TV confirmation (tv:applied), the event journal, the touch adapter and sim:touch, contract v5, and the first offline annotation step (server/scripts/annotate.ts, server/src/film/annotation.ts). Refresh that audit against the code instead of redoing finished work. Reconcile PROJECT_enh.md with docs/vnext/PLAN.md so there is one current plan, and update CLAUDE.md's pointer and progress list to match.

This environment:
- No film (server/media is gitignored), no Ollama, no Fire TV or Vega Virtual Device, no AWS credentials, no GPU. Use the fakes (fake:tv, the fake model provider, sim:touch). Mark everything that needs the Mac, the device, Ollama or Nova as open, with the exact command Parth should run there.
- Zero spending: no paid APIs, no sign-ups, no AWS calls, no new API keys. If TypeSafe/Jev needs credentials, build the adapter with a deterministic mock and record the blocker.
- Do not download films or model weights here. Build and test the pipeline with small fixtures; the real run happens on the Mac.
- If tv/ dependencies cannot install here, record it as a baseline blocker; do not change tv/ build tooling to get around it.

Repo rules: edit shared/protocol.ts, never the generated copies, then run npm run sync:shared and update server/src/validate.ts in the same commit. server/src/core never imports from server/src/film. Run npm run typecheck, npm run lint and npm test before each commit (Conventional Commits). Never commit .env, keys, media, model weights or build output. Logs never contain player names or question text.

You have permission to push, but only to your own new branch (not main, not mac/film-and-tv), and never force-push. Commit and push at every phase gate so no work is lost if the session ends. Finish with the report in PROJECT_enh.md Section 15.9.
EOF
PROMPT=$(cat "$PROMPT_FILE")
rm -f "$PROMPT_FILE"
claude --cloud "$PROMPT"
