// Central config for all client-side environment variables.
// Access via import config from '~/config'; never use import.meta.env directly.
const config = {
  STRIPE_PUBLIC_KEY: import.meta.env.VITE_STRIPE_PUBLIC_KEY as string | undefined,
};

export default config;
