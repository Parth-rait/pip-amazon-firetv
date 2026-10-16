# 0006: Stay one process with in-memory state and JSON files

Date: 2026-10-16. Status: accepted.

**Context.** The brief suggests SQLite and JSONL as candidates for event and memory records but warns against architecture for its own sake. Sessions hold first names only and end with the session.

**Decision.** Keep one Node process. Session state and the event journal stay in memory, bounded, with a JSON Lines export function. Content, annotations, reviews, timelines and datasets are versioned JSON files in the repo. No database.

**What would change it.** Consented persistent preferences, replay of real sessions for evaluation, or a deployment with more than one server process. Then: SQLite behind a small repository interface, with retention and deletion defined first.
