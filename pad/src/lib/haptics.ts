// A short vibration where the device supports it (section 3.4: a right answer).
const RIGHT_ANSWER_MS = 60;
const TAP_MS = 12;

export function vibrateRight(): void {
  try {
    navigator.vibrate?.(RIGHT_ANSWER_MS);
  } catch {
    // Some browsers throw when vibration is blocked; it is only a nicety.
  }
}

/** A tiny tick for a reaction tap. */
export function vibrateTap(): void {
  try {
    navigator.vibrate?.(TAP_MS);
  } catch {
    // Only a nicety, as above.
  }
}
