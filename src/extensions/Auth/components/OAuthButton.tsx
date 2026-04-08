import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface OAuthButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  label: string;
}

// OAuth provider button (Google, GitHub etc.)
// Rendered but gated externally by feature flags — see LoginPage for usage.
// TODO: wire feature-flag check once flag system is in place
export default function OAuthButton({ icon, label, ...props }: OAuthButtonProps) {
  return (
    <button
      type="button"
      className="w-full flex items-center gap-3 bg-bg-overlay hover:bg-bg-sunken border border-border text-base rounded-lg px-4 py-2.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      {...props}
    >
      <span className="shrink-0">{icon}</span>
      <span className="flex-1 text-center text-sm font-medium">{label}</span>
    </button>
  );
}
