// EmptyStateExample — shows empty-state layout variants.
// No API calls — purely visual stubs.
import { FolderOpenIcon, MagnifyingGlassIcon, BellSlashIcon } from '@heroicons/react/24/outline';
import Button from '~/common/components/Button';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}

function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center px-6 py-10 rounded-lg border border-dashed border-border bg-bg-subtle">
      <div className="h-12 w-12 rounded-full bg-bg-overlay flex items-center justify-center mb-4 text-text-secondary">
        {icon}
      </div>
      <h3 className="text-sm font-semibold text-text-primary mb-1">{title}</h3>
      <p className="text-xs text-text-secondary max-w-xs mb-4">{description}</p>
      {action}
    </div>
  );
}

export default function EmptyStateExample() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <EmptyState
        icon={<FolderOpenIcon className="h-6 w-6" aria-hidden="true" />}
        title="No cards yet"
        description="Add your first card to get started with this list."
        action={<Button variant="primary" size="sm">Add card</Button>}
      />
      <EmptyState
        icon={<MagnifyingGlassIcon className="h-6 w-6" aria-hidden="true" />}
        title="No results"
        description="Try adjusting your search or filter to find what you're looking for."
      />
      <EmptyState
        icon={<BellSlashIcon className="h-6 w-6" aria-hidden="true" />}
        title="No notifications"
        description="You're all caught up! Check back later for updates."
      />
    </div>
  );
}
