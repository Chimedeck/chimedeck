// Central config for the plugin extension.
// All plugin-related environment variables are accessed here — never via Bun.env directly.
import { env } from '../../../config/env';

export const pluginsConfig = {
  // Base URL used to build absolute SDK/API URLs when constructing SDK payloads.
  appUrl: env.APP_URL,

  // Origin that plugin connector iframes are allowed to post messages from.
  // Defaults to APP_URL; override via PLUGIN_SDK_ORIGIN in .env.
  sdkOrigin: Bun.env['PLUGIN_SDK_ORIGIN'] ?? env.APP_URL,

  // Path where the built SDK bundle is served.
  sdkServePath: '/sdk/jh-instance.js',

  // Filesystem path to the built SDK bundle (relative to server root).
  sdkBundlePath: `${import.meta.dir}/../../../../public/sdk/jh-instance.js`,
} as const;
