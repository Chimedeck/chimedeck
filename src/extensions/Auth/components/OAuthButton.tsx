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
      className="w-full flex items-center gap-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-lg px-4 py-2.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      {...props}
    >
      <span className="shrink-0">{icon}</span>
      <span className="flex-1 text-center text-sm font-medium">{label}</span>
    </button>
  );
}
