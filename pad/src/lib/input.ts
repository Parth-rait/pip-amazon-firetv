// Making a semantic input (docs/vnext/PLAN.md 4.2): every pad control and voice command becomes
// one of these, with an id so a resent input is applied once.
import type { InputSource, PipInput, PipInputEvent } from '../shared/protocol';

let counter = 0;

export function makeInput(event: PipInputEvent, source: InputSource): PipInput {
  counter += 1;
  const random = Math.random().toString(36).slice(2, 10);
  return {
    id: `pad-${Date.now().toString(36)}-${counter}-${random}`,
    source,
    at: Date.now(),
    event,
  };
}
