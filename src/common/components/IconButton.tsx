import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { buttonVariants, type ButtonVariant } from '../../config/theme';
import { cn } from '../../common/utils/cn';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Accessible label – required because the button has no visible text. */
  'aria-label': string;
  /** Icon element to render (e.g. an SVG component). */
  icon: ReactNode;
  variant?: ButtonVariant;
}

const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon, variant = 'ghost', className = '', ...props }, ref) => {
    const base =
      'inline-flex items-center justify-center transition-colors focus:outline-none';
    return (
      <button
        ref={ref}
        type="button"
        className={cn(base, buttonVariants[variant], buttonVariants.icon, className)}
        {...props}
      >
        {icon}
      </button>
    );
  },
);

IconButton.displayName = 'IconButton';

export default IconButton;
