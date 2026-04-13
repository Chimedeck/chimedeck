// AttachmentExample — static attachment list demo; no API calls.
import { DocumentIcon, PhotoIcon, PaperClipIcon } from '@heroicons/react/24/outline';

interface StubAttachment {
  id: string;
  name: string;
  size: string;
  type: 'image' | 'document' | 'other';
  status: 'done' | 'uploading' | 'error';
}

const STUB_ATTACHMENTS: StubAttachment[] = [
  { id: '1', name: 'design-mockup.png', size: '2.4 MB', type: 'image', status: 'done' },
  { id: '2', name: 'requirements.pdf', size: '820 KB', type: 'document', status: 'done' },
  { id: '3', name: 'data-export.csv', size: '140 KB', type: 'other', status: 'uploading' },
  { id: '4', name: 'broken-file.zip', size: '—', type: 'other', status: 'error' },
];

const STATUS_BADGE: Record<StubAttachment['status'], { label: string; className: string }> = {
  done: { label: 'Ready', className: 'bg-success/10 text-success' },
  uploading: { label: 'Uploading…', className: 'bg-info/10 text-info' },
  error: { label: 'Failed', className: 'bg-danger/10 text-danger' },
};

function FileIcon({ type }: { type: StubAttachment['type'] }) {
  if (type === 'image') return <PhotoIcon className="h-5 w-5 text-blue-400" aria-hidden="true" />;
  if (type === 'document') return <DocumentIcon className="h-5 w-5 text-red-400" aria-hidden="true" />;
  return <PaperClipIcon className="h-5 w-5 text-text-secondary" aria-hidden="true" />;
}

export default function AttachmentExample() {
  return (
    <ul className="divide-y divide-border-subtle rounded-lg border border-border overflow-hidden max-w-md" aria-label="Attachments">
      {STUB_ATTACHMENTS.map((a) => {
        const badge = STATUS_BADGE[a.status];
        return (
          <li key={a.id} className="flex items-center gap-3 px-4 py-3 bg-bg-surface hover:bg-bg-subtle transition-colors">
            <FileIcon type={a.type} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-primary truncate">{a.name}</p>
              <p className="text-xs text-text-secondary">{a.size}</p>
            </div>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badge.className}`}>
              {badge.label}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
