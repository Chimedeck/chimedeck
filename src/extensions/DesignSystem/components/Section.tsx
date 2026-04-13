// Section — reusable wrapper for each design-system section, providing an
// anchor-linkable heading and consistent vertical spacing.
import type { ReactNode } from 'react';

interface SectionProps {
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
}

export default function Section({ id, title, description, children }: SectionProps) {
  return (
    <section id={id} className="py-10 border-b border-border-subtle last:border-b-0 scroll-mt-20">
      <h2 className="text-xl font-semibold text-text-primary mb-1">{title}</h2>
      {description && (
        <p className="text-sm text-text-secondary mb-6">{description}</p>
      )}
      <div className="mt-4">{children}</div>
    </section>
  );
}
