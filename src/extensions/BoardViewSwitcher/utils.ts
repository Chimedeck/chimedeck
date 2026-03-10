// Utility helpers for the BoardViewSwitcher extension.
import type { ViewType } from './types';
import { VIEW_TYPES, DEFAULT_VIEW } from './constants';

/** Coerce an unknown server response to a known ViewType, falling back to default. */
export function normaliseViewType(raw: unknown): ViewType {
  if (typeof raw === 'string' && (VIEW_TYPES as string[]).includes(raw)) {
    return raw as ViewType;
  }
  return DEFAULT_VIEW;
}
