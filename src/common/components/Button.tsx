import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { buttonVariants, type ButtonVariant, type ButtonSize } from '../../config/theme';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', className = '', ...props }, ref) => {
    const base = 'inline-flex items-center justify-center font-medium transition-colors focus:outline-none';
    const variantClasses = buttonVariants[variant];
    const sizeClasses = buttonVariants[size];
    return (
      <button
        ref={ref}
        className={`${base} ${variantClasses} ${sizeClasses} ${className}`}
        {...props}
      />
    );
  },
);

Button.displayName = 'Button';

export default Button;
