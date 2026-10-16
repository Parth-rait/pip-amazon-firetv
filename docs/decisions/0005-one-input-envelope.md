# 0005: All devices send the same semantic input; the server decides what is allowed

Date: 2026-10-16. Status: accepted; amended 2026-10-17 at the merge of the cloud branch.

**Context.** The brief wants pads, remotes, capacitive buttons and touchwheels to share one semantic contract, and simulation before hardware.

**Decision.** Every adapter turns its raw readings into a `PipInput { id, source, at, event }` and sends it over `pad:input`. `event` is semantic (`media.pause`, `media.seekRelative`, `pip.invoke`, `ambient.set`, ...); `source` names the adapter, never the person (`pad_touch`, `pad_voice`, `touchwheel_proto`, `capacitive_button_proto`, `simulator`, `tv_remote`). The server (`actions.ts`) refuses stale and repeated ids and lets only the host control the film. Text sent to Ask Pip that is really a command goes through the same executor (`ask-commands.ts`).

**Amendment.** The cloud branch first sent raw inputs (`InputEnvelope` with key, button gesture or wheel detents over `pad:input` or `tv:input`) and interpreted them on the server. The merge kept the Mac design: interpretation happens in the adapter (`server/src/core/touch.ts` for the button and wheel, `pad/src/lib/commands.ts` for voice and typing), so the server sees one kind of message.

**Consequences.** A physical board needs an adapter that emits `PipInput`s (for example over USB serial through the pad). `npm run sim:touch` replays recorded readings today. The TV remote is not an input adapter yet.
