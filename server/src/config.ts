const defaultBratislavaPageUrl =
  'https://bratislava.sk/vzdelavanie-a-volny-cas/starz/prevadzky-sportoviska/mestska-plavaren-pasienky-50m';

export interface Config {
  databaseUrl: string;
  parseTriggerToken: string;
  port: number;
  bratislavaPageUrl: string;
}

type Environment = Record<string, string | undefined>;

export function loadConfig(environment: Environment = process.env): Config {
  const databaseUrl = environment.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  const parseTriggerToken = environment.PARSE_TRIGGER_TOKEN;
  if (!parseTriggerToken) {
    throw new Error('PARSE_TRIGGER_TOKEN is required');
  }

  return {
    databaseUrl,
    parseTriggerToken,
    port: Number(environment.PORT ?? '3000'),
    bratislavaPageUrl: environment.BRATISLAVA_PAGE_URL ?? defaultBratislavaPageUrl
  };
}
