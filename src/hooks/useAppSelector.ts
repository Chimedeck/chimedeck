import { useSelector, type TypedUseSelectorHook } from 'react-redux';
import type { RootState } from '../store';

// Typed selector hook — avoids repeating RootState in every component
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
