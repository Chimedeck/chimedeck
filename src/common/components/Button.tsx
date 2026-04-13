import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { buttonVariants, type ButtonVariant, type ButtonSize } from '../../config/theme';
import { cn } from '../../common/utils/cn';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', className = '', ...props }, ref) => {
    const base = 'inline-flex items-center justify-center font-medium transition-colors focus:outline-none';
    return (
      <button
        ref={ref}
        className={cn(base, buttonVariants[variant], buttonVariants[size], className)}
        {...props}
      />
    );
  },
);

Button.displayName = 'Button';

export default Button;
