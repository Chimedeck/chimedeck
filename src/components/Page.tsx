import type { ReactNode } from 'react';

interface PageProps {
  title?: string;
  children: ReactNode;
}

// Thin wrapper that sets the document title and provides a page-level container
export default function Page({ title, children }: PageProps) {
  if (title) document.title = `${title} — HoriFlow`;
  return <div className="min-h-screen bg-gray-900 text-white">{children}</div>;
}
