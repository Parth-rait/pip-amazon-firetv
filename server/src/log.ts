// Structured logging: one JSON line per event (PROJECT.md section 10.5). Never log names or secrets.
type Level = 'info' | 'warn' | 'error';
type Fields = Record<string, unknown>;

function write(level: Level, event: string, fields: Fields = {}): void {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, event, ...fields });
  if (level === 'error') console.error(line);
  else console.log(line);
}

export const log = {
  info: (event: string, fields?: Fields) => write('info', event, fields),
  warn: (event: string, fields?: Fields) => write('warn', event, fields),
  error: (event: string, fields?: Fields) => write('error', event, fields),
};

/** Error name and message only, safe to log (no stack, no request data). */
export function errorFields(error: unknown): { errorName: string; errorMessage: string } {
  if (error instanceof Error) return { errorName: error.name, errorMessage: error.message };
  return { errorName: 'Unknown', errorMessage: String(error) };
}
