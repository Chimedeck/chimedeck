// NotificationExample — static notification feed items; no API calls.
import { BellIcon, CheckCircleIcon, ExclamationTriangleIcon, InformationCircleIcon } from '@heroicons/react/24/outline';

interface StubNotification {
  id: string;
  type: 'info' | 'success' | 'warning';
  title: string;
  body: string;
  time: string;
  read: boolean;
}

const STUB_NOTIFICATIONS: StubNotification[] = [
  {
    id: '1',
    type: 'info',
    title: 'Alice mentioned you',
    body: '@you Can you review the PR before EOD?',
    time: '5m ago',
    read: false,
  },
  {
    id: '2',
    type: 'success',
    title: 'Deploy succeeded',
    body: 'v1.4.2 was deployed to production without errors.',
    time: '1h ago',
    read: false,
  },
  {
    id: '3',
    type: 'warning',
    title: 'Card deadline approaching',
    body: '"Fix payment gateway timeout" is due in 2 hours.',
    time: '2h ago',
    read: true,
  },
];

const TYPE_META = {
  info: { Icon: InformationCircleIcon, color: 'text-info', dot: 'bg-info' },
  success: { Icon: CheckCircleIcon, color: 'text-success', dot: 'bg-success' },
  warning: { Icon: ExclamationTriangleIcon, color: 'text-warning', dot: 'bg-warning' },
};

export default function NotificationExample() {
  return (
    <div className="max-w-md rounded-lg border border-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-bg-surface">
        <BellIcon className="h-4 w-4 text-text-secondary" aria-hidden="true" />
        <span className="text-sm font-semibold text-text-primary">Notifications</span>
        <span className="ml-auto text-xs font-medium text-primary">Mark all read</span>
      </div>

      <ul className="divide-y divide-border-subtle" aria-label="Notifications">
        {STUB_NOTIFICATIONS.map((n) => {
          const { Icon, color, dot } = TYPE_META[n.type];
          return (
            <li
              key={n.id}
              className={`flex items-start gap-3 px-4 py-3 transition-colors ${n.read ? 'bg-bg-surface' : 'bg-bg-subtle'}`}
              aria-label={`${n.read ? '' : 'Unread: '}${n.title}`}
            >
              <Icon className={`h-5 w-5 mt-0.5 shrink-0 ${color}`} aria-hidden="true" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className={`text-sm font-medium ${n.read ? 'text-text-secondary' : 'text-text-primary'}`}>
                    {n.title}
                  </p>
                  {!n.read && (
                    <span className={`h-1.5 w-1.5 rounded-full ${dot} shrink-0`} aria-hidden="true" />
                  )}
                </div>
                <p className="text-xs text-text-secondary truncate">{n.body}</p>
              </div>
              <span className="text-xs text-text-secondary shrink-0">{n.time}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
