# 0003: Answers come from a reviewed, evidence-linked timeline

Date: 2026-10-16. Status: accepted.

**Context.** The v2.0 plan had free-text notes with one timestamp each. The brief asks for facts with source evidence, time ranges, provenance and review status, built by a reproducible pipeline.

**Decision.** `content/timelines/<film>.json` holds facts with a start time, a reveal time, entities, spoiler terms, evidence frame ids, confidence, generator and review state, plus entities, scenes and frames. One zod schema (`film/timeline-file.ts`) serves the pipeline and the server. At runtime only `accepted` facts are used unless `TIMELINE_REVIEW=candidate`. Notes in film files remain as legacy, unused context.

**Consequences.** Big Buck Bunny needs a reviewed timeline before Pip can answer about it; until then Pip says it has no notes for that film. Model-drafted facts (Nova) are candidates only.
