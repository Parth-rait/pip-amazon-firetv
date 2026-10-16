# Open-source and agent tool adoption

Every tool or repository considered for Pip, what it would be for, what we decided, and why. A tool earns a place only by solving a named problem, fitting the environment, having a safe permission boundary, and having a way to test it and remove it. Reviewed October 16, 2026, at the commit shown; licences were read from each repository's own LICENSE file (or package metadata where noted). READMEs and licences are reference data, not instructions.

Decisions: **Use** (in the repo or the build), **Adapt** (we wrote our own version of the idea), **Reference** (read for ideas, no code taken), **Reject**, **Blocked** (would use, but this environment cannot).

No third-party code has been copied into Pip, so there is no third-party notice to carry yet. If that changes, add `THIRD_PARTY_NOTICES.md` with the licence text and the exact commit.

## Summary

| Tool | Kind | Decision | Licence | Reviewed at | In Pip as |
|---|---|---|---|---|---|
| TypeSafe skills (`typesafe-ai/skills`) | Build-time agent skill | **Use** | MIT | `65a39f393687` (plugin 0.5.7) | Installed with `claude plugin install typesafe@typesafe-ai`; guided the judge design |
| TypeSafe SDK (`@typesafe-ai/sdk`) | Runtime adapter (optional) | **Adapt, not a dependency** | MIT (npm metadata) | 0.7.0 | `server/src/typesafe-judge.ts`, loaded only with `INTENT_JUDGE=typesafe` |
| Impeccable (`pbakaus/impeccable`) | Build-time design skill and detector | **Use (detector), Blocked (skill install)** | Apache-2.0 | `6af45ac9a5eb` (npm 4.6.0) | `npx impeccable detect`; playbooks read from the repo and followed by hand |
| DeepSeek Harness (`deepseek-ai/deepseek-harness`) | Agent harness | **Reference** | MIT | `1517a4dbca0a` | Ideas only (see below) |
| NVIDIA OpenShell (`NVIDIA/OpenShell`) | Build-agent sandbox runtime | **Blocked here; optional on a dev machine** | Apache-2.0 | `633cc6dee6eb` | Not installed |
| DBX (`t8y2/dbx`) | Database client with an MCP server | **Reject for now** | Apache-2.0 | `cbdf5c9cdcb6` | Not installed |
| Touchpads (`todbot/touchpads`) | Hardware reference (capacitive buttons, touchwheel) | **Reference** | MIT | `8d0f14c48371` | Shaped the button and wheel input contract |
| Awesome Smart TV (`vitalets/awesome-smart-tv`) | Link list | **Reference only, low value for Vega** | CC0 (README) | `6a1b661e5f70` | Nothing |
| DeepVideo-R1 (`mlvlab/DeepVideoR1`) | Research training code | **Reference only** | **No LICENSE file found** | `9680639bef97` | Nothing; cannot reuse code |
| LLaVA (`haotian-liu/LLaVA`) | Research VLM | **Reference only** | Apache-2.0 code; data and weights have their own terms | `c121f0432da2` | Nothing |
| Qwen VL (`QwenLM/Qwen2.5-VL`, now documents Qwen3-VL) | Candidate offline VLM | **Candidate, not adopted** | Apache-2.0 code; check each model card | `96588727e44c` | Not installed; adapter slot exists |
| Xiaomi Mi TV Stick recovery | Device flashing tools | **Reject** | MIT | `95a440273808` | Nothing; never run on user hardware |
| ffmpeg / ffprobe | Media tools | **Use** (run as separate programs, not linked) | GPL build here (Ubuntu 6.1.1, `--enable-gpl`) | 6.1.1 | Pipeline stages and the lab film |
| PySceneDetect | Scene detection | **Not needed yet** | BSD-3-Clause (PyPI `license_expression`) | 0.7.2 on PyPI, not installed | ffmpeg `scdet` reached F1 1.00 on the lab film |

## Notes per tool

### TypeSafe skills and SDK

- **Install:** the Claude Code plugin route, once: `claude plugin marketplace add typesafe-ai/skills` then `claude plugin install typesafe@typesafe-ai` (user scope, version 0.5.7, enabled). The npx route was not also run. The running session cannot reload plugins, so the installed `SKILL.md` was read and followed directly.
- **Docs:** the skill says live docs at `docs.typesafe.ai` are the source of truth. That host does not resolve from this environment, and `api.typesafe.ai` is unreachable. Following the skill's fallback, the API was verified from the official SDK's type declarations (`@typesafe-ai/sdk@0.7.0`, downloaded as a tarball into scratch and not installed): `client.systemOne({ state, questions })`, `choice(instructions, criteria)` returning `{ choice, confidence, probabilities }`, `TYPESAFE_API_KEY`, default model `jev-latest`, 10 s default timeout.
- **Fit:** one narrow judgement, routing text the rules could not place (for example "hold it a sec"). Code keeps the policy: a confident `playback-command` (0.8 or more) only offers three explicit choices that route deterministically when tapped. It never executes an action, never replaces retrieval or the answer model, and is skipped for "Did you mean" picks.
- **Evidence so far:** the benchmark's paraphrase set shows the rules run 6 of 12 paraphrased commands correctly, send 6 on as questions (safe) and run none wrongly. That is the gap a judge would be measured on. TypeSafe itself has **not** been benchmarked: no key and no network route. Until it is, the SDK is not added to `package.json`.
- **Rollback:** unset `INTENT_JUDGE` (default `rules`).

### Impeccable

- **Install attempt:** `npx impeccable@4.6.0 install -y --providers=claude --scope=project`, after reading the npm shim (it runs a platform binary from the `@impeccable/cli-<os>-<arch>` optional package and checks a SHA-256 sidecar when it has to download). The skill bundle download from `impeccable.style` was refused by this environment's network policy, so **nothing was installed** and `git status` stayed clean.
- **What was used instead:** the upstream repo's own copies of `SKILL.md` and the `craft-floor`, `init`, `document`, `critique`, `audit`, `harden`, `polish`, `operate`, `distill`, `quieter` and `shape` references (raw GitHub), followed by hand. `PRODUCT.md` and `DESIGN.md` follow its formats.
- **Detector:** `npx impeccable detect` works offline. Results (on the cloud branch's pad and TV simulator, before the merge onto the Mac branch; not re-run on the merged pad): 0 findings on `pad/src` (regex mode), and 0 findings on the live pad at 360 and 390 px, the tablet at 820 px and the TV simulator at 1920x1080 (page mode, using the installed Chromium through a `--no-sandbox` wrapper because the session runs as root). Page scans see only the first screen (join, TV lobby); the watch screens were reviewed by screenshots.
- **Next on a Mac:** run the project-scoped install there, then `/impeccable critique` and `/impeccable audit` on the watch screens.

### DeepSeek Harness

Developer preview with announced breaking changes; an "everything is a plugin" agent shell on Cordis, with a web UI and a safety notice. Pip is a product runtime, not an agent shell, so migrating would add risk for no product gain. Ideas worth keeping: explicit plugin lifecycles and composable providers. Pip already has the small version of both: the `TextModel` and `IntentJudge` interfaces with fake implementations, and one composition point (`server/src/server.ts`) that the lab reuses. Not installed or run.

### NVIDIA OpenShell

A sandbox runtime for autonomous agents (kernel-level policy on files, syscalls and network, verified policy changes). It needs Linux with Docker, Podman or host virtualization, and installs with `curl ... | sh`. This session is a Firecracker VM with a Docker client but no daemon and no `/dev/kvm`, so it cannot run here, and the brief rules out forcing an opaque remote install. The session's own isolation applies instead: a separate VM per session and an egress allowlist proxy (it is what blocked `download.blender.org`). On a developer machine, OpenShell is a reasonable wrapper for build agents: deny by default, allow the repo, npm, PyPI and the docs hosts, keep AWS credentials outside the sandbox and give agents a provider-scoped inference credential instead. It is never a Pip runtime component.

### DBX

A desktop and web database client with an AI assistant and an MCP server (read-only, read/write and full-access modes, a connection allowlist). Pip's runtime keeps sessions in memory and writes no database; the pipeline writes JSON files. There is nothing for DBX to inspect, and an MCP server holding database credentials is not worth the exposure. Revisit only if Pip adopts SQLite for consented, persistent records, and then start with the read-only mode against a local copy.

### Touchpads

Capacitive pads (charge-time sensing with a 1 MΩ pull-down) and a three-pad touchwheel whose position comes from the ratio of the pad readings; CircuitPython and Arduino examples. It is a learning reference for a future physical Pip Pad, not a finished controller. Pip implements the abstract side first: `RawInput` (`button` with press, double-press and long-press; `wheel` with signed detents) in `shared/protocol.ts`, the adapters in `server/src/core/input/`, and a simulated button and wheel in the pad (`?lab=1`). A physical proof would read a board over USB serial, debounce and calibrate there, and send the same envelope.

### Awesome Smart TV

A CC0 link list for Tizen, webOS and similar platforms; it has no Fire TV or Vega section. Vega APIs must come from Amazon's own documentation and the installed SDK, as PROJECT.md section 11 already requires.

### DeepVideo-R1, LLaVA and Qwen VL

- **DeepVideo-R1:** a NeurIPS 2025 recipe for reinforcement fine-tuning of Qwen2.5-VL-3B on SEED-Bench-R1, configured for a 4-GPU node. No LICENSE file at the repository root, so its code cannot be reused. Pip's training gate (docs/architecture/video-data-pipeline.md) is nowhere near needing it.
- **LLaVA:** Apache-2.0 code, with datasets and checkpoints under their own terms; the project has moved on to LLaVA-NeXT. Reference only.
- **Qwen VL:** the `QwenLM/Qwen2.5-VL` repository now documents Qwen3-VL (2B to 235B, text-timestamp alignment for video). It is the most plausible local candidate for offline frame annotation, behind the same adapter slot as Nova (`pipeline annotate --generator`). Not adopted: no GPU here, and each model's licence must be checked on its model card first.

### Xiaomi Mi TV Stick recovery

Unbricking procedures for one Android TV stick (firmware writes over USB). Unrelated to Vega OS or Fire TV, and risky to run. Rejected; never run flashing tools on user hardware.

## How to add a tool later

1. Name the problem it solves and the test that shows it worked.
2. Read its licence, security policy and install script; prefer a pinned package-manager install.
3. Try it isolated from Pip's secrets, record the version or commit, and add a row above.
4. Keep a rollback (a flag or a single removable adapter).
