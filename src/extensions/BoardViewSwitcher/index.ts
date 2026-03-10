// Public entry point for the BoardViewSwitcher extension.
export { default as BoardViewSwitcher } from './BoardViewSwitcher';
export { default as viewPreferenceReducer } from './viewPreference.slice';
export {
  fetchViewPreference,
  saveViewPreference,
  setActiveView,
  selectActiveView,
  selectViewPreferenceStatus,
} from './viewPreference.slice';
export { useViewPreference } from './hooks';
export type { ViewType, ViewPreference, ViewPreferenceState } from './types';
export { VIEW_TYPES, DEFAULT_VIEW } from './constants';
