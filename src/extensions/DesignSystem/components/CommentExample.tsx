// CommentExample — static comment thread demo; no API calls.
import { UserCircleIcon } from '@heroicons/react/24/outline';

interface StubComment {
  id: string;
  author: string;
  initials: string;
  avatarColor: string;
  time: string;
  content: string;
}

const STUB_COMMENTS: StubComment[] = [
  {
    id: '1',
    author: 'Alice Brown',
    initials: 'AB',
    avatarColor: 'bg-blue-500',
    time: '2h ago',
    content: "Looks good to me! I'll take care of the migration script first thing tomorrow.",
  },
  {
    id: '2',
    author: 'Carlos Jiménez',
    initials: 'CJ',
    avatarColor: 'bg-green-500',
    time: '1h ago',
    content: 'Can we also add a rollback step? Just in case something goes wrong in prod.',
  },
  {
    id: '3',
    author: 'Diana Kim',
    initials: 'DK',
    avatarColor: 'bg-purple-500',
    time: '30m ago',
    content: 'Rollback is already covered by the deploy script. Closing this once merged.',
  },
];

function CommentAvatar({ initials, color, name }: Readonly<{ initials: string; color: string; name: string }>) {
  return (
    <div
      aria-hidden="true"
      className={`h-8 w-8 rounded-full ${color} flex items-center justify-center text-white text-xs font-semibold shrink-0`}
      title={name}
    >
      {initials}
    </div>
  );
}

export default function CommentExample() {
  return (
    <div className="space-y-4 max-w-lg">
      {STUB_COMMENTS.map((c) => (
        <article key={c.id} className="flex gap-3" aria-label={`Comment by ${c.author}`}>
          <CommentAvatar initials={c.initials} color={c.avatarColor} name={c.author} />
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-sm font-semibold text-text-primary">{c.author}</span>
              <span className="text-xs text-text-secondary">{c.time}</span>
            </div>
            <p className="text-sm text-text-primary leading-relaxed">{c.content}</p>
          </div>
        </article>
      ))}

      {/* Reply input stub */}
      <div className="flex gap-3 pt-2 border-t border-border-subtle">
        <div className="h-8 w-8 rounded-full bg-bg-subtle border border-dashed border-border flex items-center justify-center shrink-0">
          <UserCircleIcon className="h-5 w-5 text-text-secondary" />
        </div>
        <div className="flex-1 rounded-md border border-border bg-bg-surface px-3 py-2 text-sm text-text-secondary italic">
          Add a comment…
        </div>
      </div>
    </div>
  );
}
