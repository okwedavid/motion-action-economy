import 'dotenv/config';

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    // Only fail hard when not running tests and not in a demo bootstrap.
    if (process.env.NODE_ENV === 'test') return '';
    if (name === 'SESSION_SECRET' && process.env.NODE_ENV === 'development' && process.env.DEMO_MODE === 'true') {
      return 'dev-demo-secret-not-for-production';
    }
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name: string, fallback = ''): string {
  return process.env[name] ?? fallback;
}

function boolean(name: string, fallback = false): boolean {
  const v = process.env[name];
  if (v === undefined) return fallback;
  return v === 'true' || v === '1';
}

export const config = {
  env: optional('NODE_ENV', 'development'),
  port: Number(optional('PORT', '4000')),
  appUrl: optional('APP_URL', 'http://localhost:4000'),
  databaseUrl: process.env.DATABASE_URL || '',
  sessionSecret: required('SESSION_SECRET'),
  sessionTtl: optional('SESSION_TTL', '7d'),
  corsOrigins: optional('CORS_ORIGINS', 'http://localhost:3000')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  demoMode: boolean('DEMO_MODE', true),
  bmoni: {
    baseUrl: optional('BMONI_BASE_URL', 'https://embedded-dev.bmoni.com'),
    apiKey: optional('BMONI_API_KEY'),
    webhookSecret: optional('BMONI_WEBHOOK_SECRET'),
    partnerId: optional('BMONI_PARTNER_ID'),
  },
};
