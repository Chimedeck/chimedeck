// Central config for all client-side environment variables.
// Access via import config from '~/config'; never use import.meta.env directly.
const config = {
  /** Maximum upload size in bytes. Mirrors MAX_ATTACHMENT_SIZE_MB on the server. Default: 250 MB. */
  maxAttachmentSizeBytes:
    parseInt(import.meta.env['VITE_MAX_ATTACHMENT_SIZE_MB'] ?? '250', 10) * 1024 * 1024,
};

export default config;
