export const TURSO_ENV = [
  'TURSO_DATABASE_URL',
  'TURSO_AUTH_TOKEN',
  'TURSO_LEDGER_URL',
  'TURSO_LEDGER_AUTH_TOKEN',
];

export function storeConfigFromEnv(env = process.env) {
  const turso = TURSO_ENV.filter((name) => env[name]);
  if (turso.length === 0) return { driver: 'sqlite' };
  const missing = TURSO_ENV.filter((name) => !env[name]);
  if (missing.length) {
    throw new Error(`Turso is partial. Set all of: ${missing.join(', ')}.`);
  }
  return {
    driver: 'turso',
    databaseUrl: env.TURSO_DATABASE_URL,
    authToken: env.TURSO_AUTH_TOKEN,
    ledgerUrl: env.TURSO_LEDGER_URL,
    ledgerAuthToken: env.TURSO_LEDGER_AUTH_TOKEN,
  };
}

export function vercelBlockReason(env = process.env) {
  if (!env.VERCEL) return null;
  try {
    const config = storeConfigFromEnv(env);
    if (config.driver !== 'turso') {
      return 'This pilot on Vercel needs two Turso databases. No database has been created.';
    }
    return null;
  } catch (error) {
    return error.message;
  }
}
