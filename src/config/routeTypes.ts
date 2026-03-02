import type { ComponentType, LazyExoticComponent } from 'react';

export interface RouteConfig {
  path: string;
  // Lazy-loaded component factory
  component: () => Promise<ComponentType<unknown>> | LazyExoticComponent<ComponentType<unknown>>;
  name: string;
  /** true = requires authentication; false = accessible without token */
  auth: boolean;
}
