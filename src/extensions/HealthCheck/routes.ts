// Route configuration for the Health Check extension.
// The Health Check UI is surfaced as the fifth board tab (?tab=health-check)
// rather than a standalone page — so no top-level RouteConfig entries are
// needed here. This file exists to document the tab query-param contract
// and to export the tab identifier so BoardPage and HealthCheckTab can stay
// in sync without magic strings.

/** Query-param value used to activate the Health Check tab. */
export const HEALTH_CHECK_TAB_ID = 'health-check' as const;

/** The URL query-param key used for board tab selection. */
export const BOARD_TAB_PARAM = 'tab' as const;

/**
 * Returns true when the current URL selects the Health Check tab.
 * Useful for components that need to react to URL-driven tab changes.
 */
export function isHealthCheckTabActive(search: string): boolean {
  const params = new URLSearchParams(search);
  return params.get(BOARD_TAB_PARAM) === HEALTH_CHECK_TAB_ID;
}
