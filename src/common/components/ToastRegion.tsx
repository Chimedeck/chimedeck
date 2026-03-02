// ToastRegion — fixed bottom-right container for toast notifications.
// Renders the active toast stack and forwards dismiss callbacks to each item.
import Toast from './Toast';
import type { ToastItem } from './Toast';

interface Props {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

const ToastRegion = ({ toasts, onDismiss }: Props) => {
  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-6 right-6 z-50 flex w-80 flex-col gap-2"
      aria-live="polite"
      aria-label="Notifications"
    >
      {toasts.map((t) => (
        <Toast key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
};

export default ToastRegion;
export type { ToastItem };
