import { env } from './env';

export const appConfig = {
  port: env.APP_PORT,
  isDev: Bun.env['NODE_ENV'] !== 'production',
} as const;
