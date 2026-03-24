// HealthCheckEmptyState — shown when no health check services have been added.
import { HeartIcon, PlusIcon } from '@heroicons/react/24/outline';

interface Props {
  onAddService: () => void;
}

/** Empty-state panel prompting the user to add their first service. */
export function HealthCheckEmptyState({ onAddService }: Props) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 px-6 text-center">
      <div className="rounded-full bg-slate-800 p-5">
        <HeartIcon className="h-9 w-9 text-slate-500" aria-hidden="true" />
      </div>
      <div>
        <p className="text-slate-200 font-medium">No services monitored yet</p>
        <p className="mt-1 text-sm text-slate-400">
          Add a service URL to start tracking its availability at a glance.
        </p>
      </div>
      <button
        type="button"
        onClick={onAddService}
        className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900"
      >
        <PlusIcon className="h-4 w-4" aria-hidden="true" />
        Add your first service
      </button>
    </div>
  );
}
