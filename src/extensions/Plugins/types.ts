// Shared types for the Plugins extension.
// BoardPluginConfig holds per-board plugin configuration (set by board admins).
export interface BoardPluginConfig {
  allowedDomains?: string[] | null;
}
