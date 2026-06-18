import { beforeEach, describe, expect, it } from 'bun:test';

type Row = Record<string, unknown>;
type Store = {
  board_chat_threads: Row[];
  board_chat_messages: Row[];
  board_chat_message_vectors: Row[];
};

class QueryBuilder {
  private filters: Array<(row: Row) => boolean> = [];
  private _insert: Row | Row[] | null = null;

  constructor(private readonly store: Store, private readonly tableName: keyof Store) {}

  where(criteria: Row): this {
    this.filters.push((row) => Object.entries(criteria).every(([key, value]) => row[key] === value));
    return this;
  }

  async first(): Promise<Row | undefined> {
    return this.rows()[0];
  }

  insert(payload: Row | Row[]): this {
    this._insert = payload;
    return this;
  }

  async update(patch: Row): Promise<number> {
    const rows = this.rows(false);
    for (const row of rows) Object.assign(row, patch);
    return rows.length;
  }

  then<TResult1 = Row[], TResult2 = never>(
    onfulfilled?: ((value: Row[]) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    if (this._insert !== null) {
      const rows = Array.isArray(this._insert) ? this._insert : [this._insert];
      for (const row of rows) {
        (this.store[this.tableName]).push({ ...row });
      }
      this._insert = null;
    }
    return Promise.resolve(this.rows()).then(onfulfilled, onrejected);
  }

  private rows(clone = true): Row[] {
    const filtered = (this.store[this.tableName]).filter((row) =>
      this.filters.every((predicate) => predicate(row)),
    );
    return clone ? filtered.map((row) => ({ ...row })) : filtered;
  }
}

let store: Store;
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
let enqueueRetryImpl: (args: { messageId: string; boardId: string; reason?: string }) => Promise<void>;

const writeModule = await import('../write');
const { writeBoardChatMessage } = writeModule;

beforeEach(() => {
  store = {
    board_chat_threads: [],
    board_chat_messages: [],
    board_chat_message_vectors: [],
  };
  // Pre-create a session thread so tests don't fail on "session not found"
  store.board_chat_threads.push({
    id: 'thread-1',
    board_id: 'board-1',
    name: null,
    created_by: null,
    created_at: '2026-06-15T00:00:00.000Z',
    updated_at: '2026-06-15T00:00:00.000Z',
    last_message_at: null,
  });
  generateEmbeddingImpl = async () => ({
    provider: 'http',
    model: 'text-embedding-3-small',
    dimensions: 3,
    values: [0.1, 0.2, 0.3],
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
  enqueueRetryImpl = async () => undefined;

  writeModule.boardChatWriteDeps.db = ((tableName: keyof Store) => new QueryBuilder(store, tableName)) as unknown as typeof writeModule.boardChatWriteDeps.db;
  writeModule.boardChatWriteDeps.generateBoardChatEmbedding = (args) => generateEmbeddingImpl(args);
  writeModule.boardChatWriteDeps.persistBoardChatMessageVector = (args) => persistVectorImpl(args);
  writeModule.boardChatWriteDeps.enqueueBoardChatEmbeddingRetry = (args) => enqueueRetryImpl(args);
});

describe('writeBoardChatMessage', () => {
  it('stores raw text and vector metadata when embedding succeeds', async () => {
    const result = await writeBoardChatMessage({
      boardId: 'board-1',
      sessionId: 'thread-1',
      authorId: 'user-1',
      content: '  hello board chat  ',
    });

    expect(result.status).toBe(201);
    expect(result.data.queuedForEmbeddingRetry).toBe(false);
    expect(store.board_chat_threads).toHaveLength(1);
    expect(store.board_chat_messages).toHaveLength(1);
    expect(store.board_chat_message_vectors).toHaveLength(1);
    expect(result.data.message.content).toBe('hello board chat');
    expect(result.data.vector?.message_id).toBe(result.data.message.id);
  });

  it('keeps the raw message when embedding fails and enqueues a retry', async () => {
    generateEmbeddingImpl = async () => {
      throw new Error('embedding-unavailable');
    };

    const result = await writeBoardChatMessage({
      boardId: 'board-1',
      sessionId: 'thread-1',
      authorId: 'user-1',
      content: 'retry later',
    });

    expect(result.status).toBe(201);
    expect(result.data.queuedForEmbeddingRetry).toBe(true);
    expect(store.board_chat_threads).toHaveLength(1);
    expect(store.board_chat_messages).toHaveLength(1);
    expect(store.board_chat_message_vectors).toHaveLength(0);
    expect(result.data.vector).toBeNull();
  });
});
