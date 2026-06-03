import { beforeEach, describe, expect, it } from 'bun:test';

type Row = Record<string, unknown>;
type Store = {
  board_chat_messages: Row[];
  board_chat_message_vectors: Row[];
};

class QueryBuilder {
  private filters: Array<(row: Row) => boolean> = [];
  private _insert: Row | Row[] | null = null;

  constructor(private readonly store: Store, private readonly tableName: keyof Store) {}

  where(criteria: Row): QueryBuilder {
    this.filters.push((row) => Object.entries(criteria).every(([key, value]) => row[key] === value));
    return this;
  }

  async first(): Promise<Row | undefined> {
    return this.rows()[0];
  }

  insert(payload: Row | Row[]): QueryBuilder {
    this._insert = payload;
    return this;
  }

  then<TResult1 = Row[], TResult2 = never>(
    onfulfilled?: ((value: Row[]) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    if (this._insert !== null) {
      const rows = Array.isArray(this._insert) ? this._insert : [this._insert];
      for (const row of rows) {
        (this.store[this.tableName] as Row[]).push({ ...row });
      }
      this._insert = null;
    }
    return Promise.resolve(this.rows()).then(onfulfilled, onrejected);
  }

  private rows(): Row[] {
    return (this.store[this.tableName] as Row[]).filter((row) =>
      this.filters.every((predicate) => predicate(row)),
    );
  }
}

let store: Store;
let published: Array<{ channel: string; message: string }>;
let generateEmbeddingImpl: (args: { text: string }) => Promise<{
  provider: string;
  model: string;
  dimensions: number;
  values: number[];
}>;
let persistVectorImpl: (args: {
  messageId: string;
  boardId: string;
  embedding: {
    provider: string;
    model: string;
    dimensions: number;
    values: number[];
  };
}) => Promise<Row>;

const { enqueueBoardChatEmbeddingRetry, retryBoardChatEmbedding, boardChatRetryDeps } = await import('../retry');

beforeEach(() => {
  store = {
    board_chat_messages: [
      {
        id: 'message-1',
        board_id: 'board-1',
        thread_id: 'thread-1',
        author_id: 'user-1',
        content: 'hello retry',
        created_at: '2026-06-03T00:00:00.000Z',
        updated_at: '2026-06-03T00:00:00.000Z',
      },
    ],
    board_chat_message_vectors: [],
  };
  published = [];
  generateEmbeddingImpl = async () => ({
    provider: 'http',
    model: 'text-embedding-3-small',
    dimensions: 3,
    values: [1, 2, 3],
  });
  persistVectorImpl = async ({ messageId, boardId, embedding }) => {
    const vector = {
      id: `${messageId}-vector`,
      message_id: messageId,
      board_id: boardId,
      provider: embedding.provider,
      model: embedding.model,
      dimensions: embedding.dimensions,
      embedding: embedding.values,
      created_at: '2026-06-03T00:00:00.000Z',
      updated_at: '2026-06-03T00:00:00.000Z',
    };
    store.board_chat_message_vectors.push(vector);
    return vector;
  };

  boardChatRetryDeps.db = ((tableName: keyof Store) => new QueryBuilder(store, tableName)) as unknown as typeof boardChatRetryDeps.db;
  boardChatRetryDeps.pubsub = {
    publish: async (channel: string, message: string) => {
      published.push({ channel, message });
    },
    subscribe: async () => undefined,
    unsubscribe: async () => undefined,
  };
  boardChatRetryDeps.generateBoardChatEmbedding = (args) => generateEmbeddingImpl(args);
  boardChatRetryDeps.persistBoardChatMessageVector = (args) => persistVectorImpl(args);
});

describe('retry helpers', () => {
  it('publishes retry requests to the embedding queue', async () => {
    await enqueueBoardChatEmbeddingRetry({
      messageId: 'message-1',
      boardId: 'board-1',
      reason: 'embedding-unavailable',
    });

    expect(published).toHaveLength(1);
    expect(published[0].channel).toBe('board_chat_embedding_retry');
    expect(JSON.parse(published[0].message)).toEqual({
      messageId: 'message-1',
      boardId: 'board-1',
      reason: 'embedding-unavailable',
    });
  });

  it('rebuilds a missing vector when the message exists', async () => {
    await retryBoardChatEmbedding({ messageId: 'message-1', boardId: 'board-1' });

    expect(store.board_chat_message_vectors).toHaveLength(1);
    expect(store.board_chat_message_vectors[0].message_id).toBe('message-1');
  });
});
