// Random ids for commands and input events, so the server can ignore a repeated delivery.

/** A prefix and 24 random hex characters (fits the protocol's 16 to 64 character rule). */
export function newId(prefix: string): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return `${prefix}${[...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')}`;
}
