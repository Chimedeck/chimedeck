// Sprint 166 — embedding adapter and vector persistence helpers for board chat.
import { randomUUID } from 'crypto';
import { db } from '../../../../../common/db';
import { getEmbeddingProviderConfig } from '../providerConfig';
import type {
  BoardChatEmbedding,
  BoardChatMessageVector,
} from '../../../types';

interface EmbeddingApiResponse {
  data?: Array<{ embedding?: number[] }>;
}

function getEmbeddingConfig() {
  // [why] Provider resolution (OpenAI vs Ollama) is centralised in providerConfig
  // so the embedding call site stays provider-agnostic.
  return getEmbeddingProviderConfig();
}

export async function generateBoardChatEmbedding({
  text,
}: {
  text: string;
}): Promise<BoardChatEmbedding> {
  const config = getEmbeddingConfig();
  const response = await fetch(config.apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: config.model,
      input: text,
    }),
  });

  if (!response.ok) {
    throw new Error(`chat-embedding-request-failed:${response.status}`);
  }

  const payload = (await response.json()) as EmbeddingApiResponse;
  const embedding = payload.data?.[0]?.embedding;
  if (!embedding || embedding.length === 0) {
    throw new Error('chat-embedding-response-invalid');
  }

  return {
    provider: config.provider,
    model: config.model,
    dimensions: embedding.length || config.defaultDimensions,
    values: embedding,
  };
}

export async function persistBoardChatMessageVector({
  messageId,
  boardId,
  embedding,
}: {
  messageId: string;
  boardId: string;
  embedding: BoardChatEmbedding;
}): Promise<BoardChatMessageVector> {
  const now = new Date().toISOString();
  const [vector] = await db('board_chat_message_vectors').insert({
    id: randomUUID(),
    message_id: messageId,
    board_id: boardId,
    provider: embedding.provider,
    model: embedding.model,
    dimensions: embedding.dimensions,
    // Postgres jsonb needs a JSON value, not a bare JS array, when inserted through Knex.
    embedding: JSON.stringify(embedding.values),
    created_at: now,
    updated_at: now,
  }, ['*']);

  return vector as BoardChatMessageVector;
}
