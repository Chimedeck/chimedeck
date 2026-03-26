// Inline chip rendered for a cardReference Tiptap node.
// Fetches card title + list name from the API on first render and caches them
// in node attrs so the markdown serialiser can produce a meaningful link label.
import { NodeViewWrapper } from '@tiptap/react';
import type { ReactNodeViewProps } from '@tiptap/react';
import { useEffect, useState } from 'react';
import apiClient from '~/common/api/client';
import { parseCardIdFromUrl } from '../extensions/CardReferenceExtension';
import type { Card } from '../api';

interface CardPreview {
  title: string;
  listName: string;
}

interface CardApiResponse {
  data: Card;
  includes: { list: { id: string; title: string } };
}

const CardReferenceChip = ({ node, selected, updateAttributes }: ReactNodeViewProps) => {
  const href = node.attrs['href'] as string;
  const storedTitle = node.attrs['title'] as string | null;
  const storedList = node.attrs['listName'] as string | null;

  const [preview, setPreview] = useState<CardPreview | null>(
    storedTitle ? { title: storedTitle, listName: storedList ?? '' } : null,
  );
  const [loading, setLoading] = useState(!storedTitle);

  useEffect(() => {
    // [why] Skip fetch only when both title AND listName are populated.
    // After a markdown round-trip the listName is lost (markdown stores only link
    // text, not the list badge), so we must re-fetch to restore the status badge.
    if (storedTitle && storedList !== null) return;

    const cardId = parseCardIdFromUrl(href);
    if (!cardId) {
      setLoading(false);
      return;
    }

    apiClient
      .get(`/cards/${cardId}`)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((res: any) => {
        const title: string = res.data?.title ?? '';
        const listName: string = res.includes?.list?.title ?? '';
        setPreview({ title, listName });
        // Cache resolved values so markdown serialisation uses them immediately.
        updateAttributes({ title, listName });
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [href]);

  const displayTitle = preview?.title ?? (loading ? '…' : href);
  const listLabel = preview?.listName ?? '';

  return (
    <NodeViewWrapper
      as="span"
      contentEditable={false}
      className={[
        'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs font-medium mx-0.5 cursor-default select-none align-middle',
        selected
          ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 dark:border-indigo-500'
          : 'border-gray-300 bg-gray-100',
      ].join(' ')}
      data-testid="card-reference-chip"
    >
      {/* Card / clipboard icon */}
      <svg
        className="h-3 w-3 shrink-0 text-gray-500"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
        />
      </svg>

      <span className="max-w-[220px] truncate text-gray-800">
        {displayTitle}
      </span>

      {listLabel && (
        <span className="rounded bg-teal-100 dark:bg-teal-900/50 px-1 text-[10px] font-semibold uppercase tracking-wide text-teal-700 dark:text-teal-300">
          {listLabel}
        </span>
      )}
    </NodeViewWrapper>
  );
};

export default CardReferenceChip;
