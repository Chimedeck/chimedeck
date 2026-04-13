// CardExample — demonstrates the card surface and badge patterns used in board view.
// Fully stubbed — no API calls or real data.
import { CalendarIcon, PaperClipIcon, ChatBubbleLeftIcon } from '@heroicons/react/24/outline';

interface CardItemProps {
  title: string;
  labels: Array<{ color: string; name: string }>;
  dueDate?: string;
  commentCount?: number;
  attachmentCount?: number;
  assignees?: string[];
}

const COLORS_MAP: Record<string, string> = {
  green: 'bg-green-500',
  blue: 'bg-blue-500',
  red: 'bg-red-500',
  yellow: 'bg-yellow-400',
  purple: 'bg-purple-500',
};

function StubCard({ title, labels, dueDate, commentCount, attachmentCount, assignees = [] }: Readonly<CardItemProps>) {
  return (
    <article
      className="bg-bg-surface rounded-lg border border-border p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
      aria-label={`Card: ${title}`}
    >
      {labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2" aria-label="Labels">
          {labels.map((l) => (
            <span
              key={l.name}
              title={l.name}
              className={`h-1.5 w-8 rounded-full ${COLORS_MAP[l.color] ?? 'bg-bg-subtle'}`}
            />
          ))}
        </div>
      )}

      <p className="text-sm text-text-primary font-medium leading-snug mb-2">{title}</p>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs text-text-secondary">
          {dueDate && (
            <span className="flex items-center gap-0.5" aria-label={`Due ${dueDate}`}>
              <CalendarIcon className="h-3.5 w-3.5" />
              {dueDate}
            </span>
          )}
          {(commentCount ?? 0) > 0 && (
            <span className="flex items-center gap-0.5" aria-label={`${String(commentCount ?? 0)} comments`}>
              <ChatBubbleLeftIcon className="h-3.5 w-3.5" />
              {commentCount}
            </span>
          )}
          {(attachmentCount ?? 0) > 0 && (
            <span className="flex items-center gap-0.5" aria-label={`${String(attachmentCount ?? 0)} attachments`}>
              <PaperClipIcon className="h-3.5 w-3.5" />
              {attachmentCount}
            </span>
          )}
        </div>

        {assignees.length > 0 && (
          <div className="flex -space-x-1">
            {assignees.map((initials) => (
              <div
                key={initials}
                aria-label={initials}
                className="h-6 w-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-semibold border border-bg-surface"
              >
                {initials}
              </div>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

export default function CardExample() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg">
      <StubCard
        title="Design new onboarding flow"
        labels={[{ color: 'blue', name: 'Design' }, { color: 'green', name: 'In Progress' }]}
        dueDate="Apr 20"
        commentCount={3}
        assignees={['AB', 'CJ']}
      />
      <StubCard
        title="Fix payment gateway timeout"
        labels={[{ color: 'red', name: 'Bug' }]}
        dueDate="Apr 15"
        attachmentCount={2}
        commentCount={1}
        assignees={['DK']}
      />
      <StubCard
        title="Update README with new env vars"
        labels={[{ color: 'yellow', name: 'Docs' }]}
        assignees={[]}
      />
      <StubCard
        title="Migrate CI to GitHub Actions"
        labels={[{ color: 'purple', name: 'DevOps' }, { color: 'blue', name: 'Infra' }]}
        commentCount={5}
        attachmentCount={1}
        assignees={['EF', 'FG', 'AB']}
      />
    </div>
  );
}
