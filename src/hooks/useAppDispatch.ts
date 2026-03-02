import { useDispatch } from 'react-redux';
import type { AppDispatch } from '../store';

// Typed dispatch hook — ensures thunk types are inferred correctly
export const useAppDispatch = () => useDispatch<AppDispatch>();
