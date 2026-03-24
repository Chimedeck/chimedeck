import { cn } from '../utils/cn';
import translations from '~/common/translations/en.json';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeMap = { sm: 'h-4 w-4', md: 'h-8 w-8', lg: 'h-12 w-12' };

export default function Spinner({ size = 'md', className }: SpinnerProps) {
  return (
    <div
      role="status"
      aria-label={translations['Common.loadingLabel']}
      className={cn(
        'animate-spin rounded-full border-2 border-current border-t-transparent',
        sizeMap[size],
        className
      )}
    />
  );
}
