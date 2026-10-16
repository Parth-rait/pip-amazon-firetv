# 0005: All devices send one input envelope; the server decides meaning

Date: 2026-10-16. Status: accepted.

**Context.** The brief wants pads, remotes, capacitive buttons and touchwheels to share one semantic contract, and simulation before hardware.

**Decision.** `InputEnvelope { v, eventId, source, sentAt, input }` with raw inputs (`key`, `button` gesture, `wheel` detents) goes over `pad:input` or `tv:input`. Adapters on the server (`core/input/adapters.ts`) turn them into intents; toggles become absolute play or pause from the current state; repeats of an `eventId` are ignored; pads may change playback only as the host. The existing `pad:host` buttons stay and share the same executor.

**Consequences.** A physical board only needs to emit the envelope (for example over USB serial through the pad). The pad's `?lab=1` panel and the TV simulator's keys exercise the path today.
