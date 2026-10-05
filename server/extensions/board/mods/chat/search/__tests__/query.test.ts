import { beforeEach, describe, expect, it } from 'bun:test';

const queryModule = await import('../query');
const { searchBoardChatMessages, boardChatSearchDeps } = queryModule;

beforeEach(() => {
  boardChatSearchDeps.generateBoardChatEmbedding = async () => ({
    provider: 'http',
    model: 'text-embedding-3-small',
    dimensions: 3,
    values: [1, 0, 0],
  });
  boardChatSearchDeps.fetchBoardMessageVectors = async () => [
    { message_id: 'm-1', embedding: [1, 0, 0] },
    { message_id: 'm-2', embedding: [0.5, 0.5, 0] },
    { message_id: 'm-3', embedding: [0, 1, 0] },
  ];
  boardChatSearchDeps.fetchBoardMessagesByIds = async () => [
    {
      id: 'm-1',
      thread_id: 't-1',
      board_id: 'board-1',
      author_id: 'user-1',
      content: 'first message',
      created_at: '2026-06-03T01:00:00.000Z',
      updated_at: '2026-06-03T01:00:00.000Z',
      author_name: 'User 1',
      author_avatar_url: null,
    },
    {
      id: 'm-2',
      thread_id: 't-1',
      board_id: 'board-1',
      author_id: 'user-2',
      content: 'second message',
      created_at: '2026-06-03T02:00:00.000Z',
      updated_at: '2026-06-03T02:00:00.000Z',
      author_name: 'User 2',
      author_avatar_url: null,
    },
    {
      id: 'm-3',
      thread_id: 't-1',
      board_id: 'board-1',
      author_id: 'user-3',
      content: 'third message',
      created_at: '2026-06-03T03:00:00.000Z',
      updated_at: '2026-06-03T03:00:00.000Z',
      author_name: 'User 3',
      author_avatar_url: null,
    },
  ];
});

describe('searchBoardChatMessages', () => {
  it('returns board-scoped chat hits with descending similarity scores', async () => {
    const result = await searchBoardChatMessages({
      boardId: 'board-1',
      query: 'hello',
      limit: 2,
    });

    expect(result.status).toBe(200);
    expect(result.data).toHaveLength(2);
    expect(result.data?.[0]?.id).toBe('m-1');
    expect(result.data?.[1]?.id).toBe('m-2');
    expect(result.data?.[0]?.score).toBeGreaterThan(result.data?.[1]?.score ?? 0);
  });

  it('rejects too-short queries before hitting the embedding provider', async () => {
    let embeddingCalls = 0;
    boardChatSearchDeps.generateBoardChatEmbedding = async () => {
      embeddingCalls += 1;
      return {
        provider: 'http',
        model: 'text-embedding-3-small',
        dimensions: 3,
        values: [1, 0, 0],
      };
    };

    const result = await searchBoardChatMessages({
      boardId: 'board-1',
      query: 'x',
    });

    expect(result.status).toBe(400);
    expect(result.name).toBe('search-query-too-short');
    expect(embeddingCalls).toBe(0);
  });

  it('skips vectors that cannot be converted to numeric embeddings', async () => {
    boardChatSearchDeps.fetchBoardMessageVectors = async () => [
      { message_id: 'm-1', embedding: 'not-json' },
      { message_id: 'm-2', embedding: [1, 0, 0] },
    ];
    boardChatSearchDeps.fetchBoardMessagesByIds = async () => [
      {
        id: 'm-2',
        thread_id: 't-1',
        board_id: 'board-1',
        author_id: 'user-2',
        content: 'second message',
        created_at: '2026-06-03T02:00:00.000Z',
        updated_at: '2026-06-03T02:00:00.000Z',
        author_name: 'User 2',
        author_avatar_url: null,
      },
    ];

    const result = await searchBoardChatMessages({
      boardId: 'board-1',
      query: 'hello',
    });

    expect(result.status).toBe(200);
    expect(result.data).toHaveLength(1);
    expect(result.data?.[0]?.id).toBe('m-2');
  });
});
