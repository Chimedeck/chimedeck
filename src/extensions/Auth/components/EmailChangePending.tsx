// EmailChangePending — dismissible banner shown after a change-email request.
// Remains visible until the user dismisses it or re-logs in after confirmation.
import { XMarkIcon } from '@heroicons/react/24/outline';
import IconButton from '~/common/components/IconButton';
import translations from '../translations/en.json';

interface EmailChangePendingProps {
  pendingEmail: string;
  onDismiss: () => void;
}

export default function EmailChangePending({ pendingEmail, onDismiss }: EmailChangePendingProps) {
  const message = translations.changeEmail.pending.replace('{email}', pendingEmail);

  return (
    <div className="rounded-lg bg-indigo-900/40 border border-indigo-700 p-4 flex items-start gap-3">
      <div className="flex-1">
        <p className="text-indigo-200 text-sm font-medium">{message}</p>
        <p className="text-indigo-300 text-sm mt-1">{translations.changeEmail.pendingDetail}</p>
      </div>
      <IconButton
        onClick={onDismiss}
        aria-label="Dismiss"
        icon={<XMarkIcon className="h-5 w-5" aria-hidden="true" />}
        variant="ghost"
        className="text-indigo-400 hover:text-indigo-200"
      />
    </div>
  );
}
