const LEVELS = ['debug', 'info', 'warn', 'error'] as const;
type Level = (typeof LEVELS)[number];

type Fields = Record<string, unknown> & {
  requestId?: string;
  userId?: string;
  operation?: string;
  durationMs?: number;
  result?: string;
  errorCode?: string;
};

const configuredLevel: Level = (process.env.LOG_LEVEL as Level) || 'info';

function redact(value: unknown): unknown {
  if (typeof value === 'string') {
    const SENSITIVE =
      /(password|passwd|secret|token|api[_-]?key|authorization|signature|private[_-]?key|cvv|pan|pin)\b/i;
    if (SENSITIVE.test(value)) return '[REDACTED]';
  }
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (/(password|secret|token|api[_-]?key|authorization|signature|private|pin|pan|cvv)/i.test(k)) {
        out[k] = '[REDACTED]';
      } else {
        out[k] = redact(v);
      }
    }
    return out;
  }
  return value;
}

function write(level: Level, message: string, fields: Fields = {}): void {
  const idx = LEVELS.indexOf(level);
  if (idx < LEVELS.indexOf(configuredLevel)) return;
  const entry = {
    level,
    time: new Date().toISOString(),
    msg: message,
    ...(redact(fields) as Record<string, unknown>),
  };
  if (level === 'error') {
    console.error(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}

export const logger = {
  debug: (m: string, f?: Fields) => write('debug', m, f),
  info: (m: string, f?: Fields) => write('info', m, f),
  warn: (m: string, f?: Fields) => write('warn', m, f),
  error: (m: string, f?: Fields) => write('error', m, f),
};
