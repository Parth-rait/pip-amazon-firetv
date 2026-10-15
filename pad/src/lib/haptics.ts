// A short vibration where the device supports it (section 3.4: a right answer).
const RIGHT_ANSWER_MS = 60;

export function vibrateRight(): void {
  try {
    navigator.vibrate?.(RIGHT_ANSWER_MS);
  } catch {
    // Some browsers throw when vibration is blocked; it is only a nicety.
  }
}
