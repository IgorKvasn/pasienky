import { describe, expect, test } from 'vitest';

import { loadConfig } from '../src/config.js';

describe('loadConfig', () => {
  test('loads required environment variables and PORT 4321', () => {
    const config = loadConfig({
      DATABASE_URL: 'postgres://user:password@localhost:5432/pasienky',
      PARSE_TRIGGER_TOKEN: 'secret-token',
      PORT: '4321'
    });

    expect(config).toEqual({
      databaseUrl: 'postgres://user:password@localhost:5432/pasienky',
      parseTriggerToken: 'secret-token',
      port: 4321,
      bratislavaPageUrl:
        'https://bratislava.sk/vzdelavanie-a-volny-cas/starz/prevadzky-sportoviska/mestska-plavaren-pasienky-50m'
    });
  });

  test('throws DATABASE_URL is required for empty environment', () => {
    expect(() => loadConfig({})).toThrow('DATABASE_URL is required');
  });
});
