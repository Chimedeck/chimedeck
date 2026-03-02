// AttachmentStatusBadge — displays the scan status of a FILE attachment.
import React from 'react';

type AttachmentStatus = 'PENDING' | 'READY' | 'REJECTED';

interface Props {
  status: AttachmentStatus;
}

const BADGE_STYLES: Record<AttachmentStatus, React.CSSProperties> = {
  PENDING: { background: '#fbbf24', color: '#1f2937', padding: '2px 8px', borderRadius: 4, fontSize: 12 },
  READY: { background: '#34d399', color: '#1f2937', padding: '2px 8px', borderRadius: 4, fontSize: 12 },
  REJECTED: { background: '#f87171', color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 12 },
};

const BADGE_LABELS: Record<AttachmentStatus, string> = {
  PENDING: 'Scanning…',
  READY: 'Ready',
  REJECTED: 'Rejected',
};

export function AttachmentStatusBadge({ status }: Props): React.ReactElement {
  return <span style={BADGE_STYLES[status]}>{BADGE_LABELS[status]}</span>;
}
