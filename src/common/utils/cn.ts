import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Utility to merge Tailwind classes without conflicts — used by all components
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
