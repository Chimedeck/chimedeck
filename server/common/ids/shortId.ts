import { randomBytes } from 'node:crypto';
import { db } from '../db';

const SHORT_ID_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const SHORT_ID_LENGTH = 8;

export function generateShortId(length = SHORT_ID_LENGTH): string {
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += SHORT_ID_ALPHABET[bytes[i] % SHORT_ID_ALPHABET.length];
  }
  return out;
}

export async function generateUniqueShortId(
  tableName: 'boards' | 'cards' | 'lists' | 'comments' | 'attachments',
): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const shortId = generateShortId();
    const existing = await db(tableName).where({ short_id: shortId }).first();
    if (!existing) return shortId;
  }
  throw new Error(`failed-to-generate-unique-short-id:${tableName}`);
}
