import { describe, expect, test } from 'bun:test';
import { serializeAttachment } from './serializeAttachment';

describe('serializeAttachment', () => {
  test('uses proxy URLs for files and preserves referenced card details', () => {
    const result = serializeAttachment(
      {
        id: 'attachment-1',
        card_id: 'card-1',
        name: 'brief.pdf',
        alias: null,
        type: 'FILE',
        url: null,
        external_url: null,
        mime_type: 'application/pdf',
        size_bytes: 42,
        status: 'READY',
        thumbnail_key: 'thumbs/brief.png',
        width: null,
        height: null,
        created_at: '2026-09-07T00:00:00.000Z',
        updated_at: '2026-09-07T00:00:00.000Z',
        referenced_card_id: 'card-2',
      },
      {
        'card-2': {
          id: 'card-2',
          title: 'Referenced card',
          board_id: 'board-1',
          board_name: 'Board',
          list_id: 'list-1',
          list_name: 'List',
          labels: [{ id: 'label-1', name: 'Urgent', color: 'red' }],
        },
      },
    );

    expect(result.view_url).toBe('/api/v1/attachments/attachment-1/view');
    expect(result.thumbnail_url).toBe('/api/v1/attachments/attachment-1/thumbnail');
    expect(result.referenced_card?.labels).toEqual([{ id: 'label-1', name: 'Urgent', color: 'red' }]);
  });

  test('returns an external URL directly only for URL attachments', () => {
    const result = serializeAttachment(
      {
        id: 'attachment-2', card_id: 'card-1', name: 'Link', alias: null, type: 'URL',
        url: 'https://example.com', external_url: null, mime_type: null, size_bytes: null,
        status: 'READY', thumbnail_key: null, width: null, height: null,
        created_at: '2026-09-07T00:00:00.000Z', updated_at: '2026-09-07T00:00:00.000Z',
        referenced_card_id: null,
      },
      {},
    );

    expect(result.view_url).toBe('https://example.com');
    expect(result.thumbnail_url).toBeNull();
  });
});
