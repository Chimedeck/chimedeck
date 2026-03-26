// HealthCheckEmptyState — shown when no health check services have been added.
import { HeartIcon, PlusIcon } from '@heroicons/react/24/outline';
import Button from '../../../common/components/Button';

interface Props {
  onAddService: () => void;
}

/** Empty-state panel prompting the user to add their first service. */
export function HealthCheckEmptyState({ onAddService }: Props) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 px-6 text-center">
      <div className="rounded-full bg-bg-surface p-5">
        <HeartIcon className="h-9 w-9 text-muted" aria-hidden="true" />
      </div>
      <div>
        <p className="text-subtle font-medium">No services monitored yet</p>
        <p className="mt-1 text-sm text-muted">
          Add a service URL to start tracking its availability at a glance.
        </p>
      </div>
      <Button
        type="button"
        variant="primary"
        size="md"
        onClick={onAddService}
        className="flex items-center gap-2 focus:ring-offset-2 focus:ring-offset-bg-base"
      >
        <PlusIcon className="h-4 w-4" aria-hidden="true" />
        Add your first service
      </Button>
    </div>
  );
}
