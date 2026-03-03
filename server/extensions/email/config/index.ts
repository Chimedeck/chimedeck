// server/extensions/email/config/index.ts
// Centralises all SES-related environment variable access.
import { env } from '../../../config/env';

export const emailConfig = {
  sesRegion: env.SES_REGION,
  sesFromAddress: env.SES_FROM_ADDRESS,
} as const;
