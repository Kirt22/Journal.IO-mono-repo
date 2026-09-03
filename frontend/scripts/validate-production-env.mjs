#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ENV_FILE = path.resolve('.env.production');
const REQUIRED_KEYS = [
  'API_BASE_URL',
  'GOOGLE_IOS_CLIENT_ID',
  'GOOGLE_WEB_CLIENT_ID',
  'IOS_APP_STORE_ID',
  'REVENUECAT_IOS_API_KEY',
];

const parseEnv = source => {
  const values = new Map();

  for (const line of source.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separator = trimmed.indexOf('=');
    if (separator < 1) {
      continue;
    }

    const key = trimmed.slice(0, separator).trim();
    const value = trimmed
      .slice(separator + 1)
      .trim()
      .replace(/^(["'])(.*)\1$/, '$2');
    values.set(key, value);
  }

  return values;
};

const main = async () => {
  const values = parseEnv(await readFile(ENV_FILE, 'utf8'));
  const missing = REQUIRED_KEYS.filter(key => !values.get(key));

  if (missing.length) {
    throw new Error(
      `Production iOS environment is missing: ${missing.join(', ')}`,
    );
  }

  const apiBaseUrl = values.get('API_BASE_URL');
  if (!apiBaseUrl?.startsWith('https://')) {
    throw new Error('API_BASE_URL must use HTTPS for production iOS builds.');
  }

  if (/\b(localhost|127\.0\.0\.1|10\.\d|192\.168\.)\b/i.test(apiBaseUrl)) {
    throw new Error('API_BASE_URL must not point to a private or local host.');
  }

  if (!/^\d+$/.test(values.get('IOS_APP_STORE_ID') ?? '')) {
    throw new Error('IOS_APP_STORE_ID must contain only digits.');
  }

  console.info(
    `Production iOS environment: ${REQUIRED_KEYS.length} required values present`,
  );
};

main().catch(error => {
  console.error(
    error instanceof Error
      ? error.message
      : 'Production environment validation failed.',
  );
  process.exitCode = 1;
});
