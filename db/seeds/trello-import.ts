#!/usr/bin/env bun
/**
 * db/seeds/trello-import.ts
 *
 * Seeds the database from db/all_trello_cards.json (Trello export).
 *
 * Usage:
 *   bun run db/seeds/trello-import.ts
 *
 * Environment: reads DATABASE_URL from .env (falls back to the dev default).
 *
 * The JSON file is 130 MB+. Bun.file().json() uses a C++ iterative JSON parser —
 * there is no recursive descent and therefore no stack overflow risk.
 * All DB writes are batched (BATCH_SIZE records per INSERT) so we never build
 * enormous single SQL statements.
 *
 * Outputs at the end:
 *   - JSON array of workspace (organisation) IDs
 *   - JSON array of user IDs derived from Trello member IDs
 */

import Knex from 'knex';
import { resolve } from 'node:path';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const ROOT = resolve(import.meta.dir, '../..'); // repo root

// Load .env so DATABASE_URL is available when running outside the server
const envFile = Bun.file(resolve(ROOT, '.env'));
if (await envFile.exists()) {
  const raw = await envFile.text();
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    if (!Bun.env[key]) Bun.env[key] = val;
  }
}

const DATABASE_URL =
  Bun.env['DATABASE_URL'] ?? 'postgresql://kanban:kanban@localhost:5432/kanban_dev';

const BATCH_SIZE = 500; // rows per INSERT batch

// ---------------------------------------------------------------------------
// DB connection
// ---------------------------------------------------------------------------

const db = Knex({ client: 'pg', connection: DATABASE_URL, pool: { min: 1, max: 5 } });

// ---------------------------------------------------------------------------
// Trello colour → hex
// ---------------------------------------------------------------------------

const TRELLO_COLORS: Record<string, string> = {
  green:    '#61BD4F',
  yellow:   '#F2D600',
  orange:   '#FF9F1A',
  red:      '#EB5A46',
  purple:   '#C377E0',
  blue:     '#0079BF',
  sky:      '#00C2E0',
  lime:     '#51E898',
  pink:     '#FF78CB',
  black:    '#344563',
  null:     '#B3BAC5',
};

function trelloColor(name: string | null): string {
  if (!name) return TRELLO_COLORS['null'];
  const hex = TRELLO_COLORS[name.toLowerCase()];
  // If it already looks like a hex code pass it through
  if (!hex && /^#[0-9a-fA-F]{3,6}$/.test(name)) return name;
  return hex ?? TRELLO_COLORS['null'];
}

// ---------------------------------------------------------------------------
// Position helpers
// Convert Trello numeric pos to zero-padded string so lexicographic order
// matches numeric order (e.g. 65535 → "000000065535.000000").
// ---------------------------------------------------------------------------

function toPosition(pos: number | null | undefined): string {
  const n = pos ?? 0;
  const [int, frac = '000000'] = n.toFixed(6).split('.');
  return int.padStart(16, '0') + '.' + frac;
}

// ---------------------------------------------------------------------------
// ID helpers
// ---------------------------------------------------------------------------

function memberId(trelloMemberId: string): string {
  // We keep the Trello member ID as our user ID for a stable mapping.
  return trelloMemberId;
}

function memberEmail(trelloMemberId: string): string {
  return `tam.vu+${trelloMemberId}@journeyh.io`;
}

// ---------------------------------------------------------------------------
// Batch insert helper (upsert — ON CONFLICT DO NOTHING)
// ---------------------------------------------------------------------------

async function batchInsert<T extends object>(
  table: string,
  rows: T[],
  conflictTarget?: string | string[],
): Promise<void> {
  if (rows.length === 0) return;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    if (conflictTarget) {
      await db(table)
        .insert(chunk)
        .onConflict(conflictTarget as any)
        .ignore();
    } else {
      await db(table).insert(chunk).onConflict().ignore();
    }
  }
}

// ---------------------------------------------------------------------------
// Types for the Trello JSON
// ---------------------------------------------------------------------------

interface TrelloLabel {
  id: string;
  idBoard: string;
  name: string;
  color: string | null;
}

interface TrelloList {
  id: string;
  name: string;
  closed: boolean;
  pos: number;
  idBoard: string;
}

interface TrelloCard {
  id: string;
  name: string;
  desc: string;
  closed: boolean;
  due: string | null;
  pos: number;
  idBoard: string;
  idList: string;
  idMembers: string[];
  idLabels: string[];
  labels: TrelloLabel[];
  list: TrelloList;
  shortLink: string;
  shortUrl: string;
  dateLastActivity: string;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const jsonPath = resolve(ROOT, 'db/all_trello_cards.json');
  const jsonFile = Bun.file(jsonPath);

  if (!(await jsonFile.exists())) {
    console.error(`❌  File not found: ${jsonPath}`);
    process.exit(1);
  }

  const bytes = jsonFile.size;
  console.log(`📂  Loading ${(bytes / 1024 / 1024).toFixed(1)} MB JSON…`);

  // Bun.file().json() uses a C++ iterative parser — stack-safe for any depth.
  const cards: TrelloCard[] = await jsonFile.json();
  console.log(`✅  Parsed ${cards.length.toLocaleString()} cards`);

  // -------------------------------------------------------------------------
  // 1. Collect unique entities from all cards
  // -------------------------------------------------------------------------

  // workspaces / boards keyed by idBoard (we use the Trello board ID as both)
  const workspaceSet = new Map<string, { id: string; name: string }>();
  const boardSet = new Map<string, { id: string; workspace_id: string; title: string }>();
  const listSet = new Map<string, object>();
  const labelSet = new Map<string, object>();
  const memberSet = new Map<string, string>(); // trelloId → email

  for (const card of cards) {
    // Board / workspace
    if (!workspaceSet.has(card.idBoard)) {
      workspaceSet.set(card.idBoard, { id: card.idBoard, name: card.idBoard });
      boardSet.set(card.idBoard, {
        id: card.idBoard,
        workspace_id: card.idBoard,
        title: card.idBoard,
        state: 'ACTIVE',
      });
    }

    // List — always anchor the board_id to card.idBoard for FK safety
    if (card.list && !listSet.has(card.list.id)) {
      listSet.set(card.list.id, {
        id: card.list.id,
        board_id: card.idBoard,
        title: card.list.name,
        position: toPosition(card.list.pos),
        archived: card.list.closed ?? false,
      });
    }

    // Labels
    for (const label of card.labels ?? []) {
      if (!labelSet.has(label.id)) {
        labelSet.set(label.id, {
          id: label.id,
          workspace_id: label.idBoard,
          name: label.name || 'Label',
          color: trelloColor(label.color),
        });
      }
    }

    // Members
    for (const mid of card.idMembers ?? []) {
      if (!memberSet.has(mid)) {
        memberSet.set(mid, memberEmail(mid));
      }
    }
  }

  console.log(`\n📊  Unique entities:`);
  console.log(`    Workspaces / Boards : ${workspaceSet.size}`);
  console.log(`    Lists               : ${listSet.size}`);
  console.log(`    Labels              : ${labelSet.size}`);
  console.log(`    Members             : ${memberSet.size}`);

  // -------------------------------------------------------------------------
  // 2. System owner user — owns all workspaces
  // -------------------------------------------------------------------------

  const SYSTEM_USER_ID = 'system-trello-import';
  const SYSTEM_USER_EMAIL = 'system@trello-import.local';
  const DEFAULT_PASSWORD = '12345678';

  console.log('\n👤  Hashing passwords…');
  const systemPasswordHash = await Bun.password.hash(DEFAULT_PASSWORD, {
    algorithm: 'bcrypt',
    cost: 12,
  });

  await batchInsert(
    'users',
    [
      {
        id: SYSTEM_USER_ID,
        email: SYSTEM_USER_EMAIL,
        name: 'System (Trello Import)',
        password_hash: systemPasswordHash,
      },
    ],
    'id',
  );

  // -------------------------------------------------------------------------
  // 3. Member users
  // -------------------------------------------------------------------------

  console.log(`👥  Creating ${memberSet.size} member users…`);

  // Hash all passwords in parallel (Bun.password.hash is async but CPU-bound;
  // keep parallelism reasonable to avoid overloading the event loop).
  const memberEntries = [...memberSet.entries()];
  const memberRows: object[] = [];

  const HASH_CONCURRENCY = 20;
  for (let i = 0; i < memberEntries.length; i += HASH_CONCURRENCY) {
    const slice = memberEntries.slice(i, i + HASH_CONCURRENCY);
    const hashes = await Promise.all(
      slice.map(([, email]) =>
        Bun.password.hash(DEFAULT_PASSWORD, { algorithm: 'bcrypt', cost: 12 }),
      ),
    );
    for (let j = 0; j < slice.length; j++) {
      const [trelloId] = slice[j];
      memberRows.push({
        id: memberId(trelloId),
        email: memberEmail(trelloId),
        name: trelloId, // no real name available from card data alone
        password_hash: hashes[j],
      });
    }
    if ((i / HASH_CONCURRENCY) % 5 === 0) {
      process.stdout.write(
        `    hashed ${Math.min(i + HASH_CONCURRENCY, memberEntries.length)} / ${memberEntries.length}\r`,
      );
    }
  }
  console.log('');

  await batchInsert('users', memberRows, 'id');

  // -------------------------------------------------------------------------
  // 4. Workspaces
  // -------------------------------------------------------------------------

  console.log(`🏢  Creating ${workspaceSet.size} workspaces…`);
  await batchInsert(
    'workspaces',
    [...workspaceSet.values()].map((w) => ({ ...w, owner_id: SYSTEM_USER_ID })),
    'id',
  );

  // Make all member users MEMBER of every workspace they appear on
  // (We do a separate pass after cards are processed for per-board granularity)

  // -------------------------------------------------------------------------
  // 5. Boards
  // -------------------------------------------------------------------------

  console.log(`📋  Creating ${boardSet.size} boards…`);
  await batchInsert('boards', [...boardSet.values()], 'id');

  // -------------------------------------------------------------------------
  // 6. Lists
  // -------------------------------------------------------------------------

  console.log(`📑  Creating ${listSet.size} lists…`);
  await batchInsert('lists', [...listSet.values()], 'id');

  // -------------------------------------------------------------------------
  // 7. Labels
  // -------------------------------------------------------------------------

  console.log(`🏷️   Creating ${labelSet.size} labels…`);
  await batchInsert('labels', [...labelSet.values()], 'id');

  // -------------------------------------------------------------------------
  // 8. Cards + card_labels + card_members (batched)
  // -------------------------------------------------------------------------

  console.log(`🃏  Inserting ${cards.length.toLocaleString()} cards…`);

  const cardRows: object[] = [];
  const cardLabelRows: object[] = [];
  const cardMemberRows: object[] = [];
  // Track uniqueness for junction tables within this run
  const cardLabelSeen = new Set<string>();
  const cardMemberSeen = new Set<string>();

  for (const card of cards) {
    // Skip cards whose list was not collected (list property missing)
    if (!listSet.has(card.idList)) continue;

    cardRows.push({
      id: card.id,
      list_id: card.idList,
      title: card.name.slice(0, 512),
      description: card.desc ?? null,
      position: toPosition(card.pos),
      archived: card.closed ?? false,
      due_date: card.due ? new Date(card.due) : null,
      short_link: card.shortLink ?? null,
      short_url: card.shortUrl ?? null,
      created_at: card.dateLastActivity ? new Date(card.dateLastActivity) : new Date(),
      updated_at: card.dateLastActivity ? new Date(card.dateLastActivity) : new Date(),
    });

    for (const labelId of card.idLabels ?? []) {
      if (labelSet.has(labelId)) {
        const key = `${card.id}:${labelId}`;
        if (!cardLabelSeen.has(key)) {
          cardLabelSeen.add(key);
          cardLabelRows.push({ card_id: card.id, label_id: labelId });
        }
      }
    }

    for (const mid of card.idMembers ?? []) {
      const userId = memberId(mid);
      const key = `${card.id}:${userId}`;
      if (!cardMemberSeen.has(key)) {
        cardMemberSeen.add(key);
        cardMemberRows.push({ card_id: card.id, user_id: userId });
      }
    }

    // Flush when batches are large enough to avoid holding too much in memory
    if (cardRows.length >= BATCH_SIZE * 4) {
      await flushCards(cardRows, cardLabelRows, cardMemberRows);
      cardRows.length = 0;
      cardLabelRows.length = 0;
      cardMemberRows.length = 0;
    }
  }

  // Final flush
  await flushCards(cardRows, cardLabelRows, cardMemberRows);

  // -------------------------------------------------------------------------
  // 9. Workspace memberships for member users
  //    Add every member user as MEMBER of every workspace (board).
  //    This is a cross-product; we do it after cards so we know who's who.
  // -------------------------------------------------------------------------

  // Build workspace→member mapping from cards
  const workspaceMemberMap = new Map<string, Set<string>>();
  for (const card of cards) {
    if (!workspaceMemberMap.has(card.idBoard)) {
      workspaceMemberMap.set(card.idBoard, new Set());
    }
    for (const mid of card.idMembers ?? []) {
      workspaceMemberMap.get(card.idBoard)!.add(memberId(mid));
    }
  }

  const membershipRows: object[] = [];
  for (const [workspaceId, userIds] of workspaceMemberMap.entries()) {
    for (const userId of userIds) {
      membershipRows.push({ user_id: userId, workspace_id: workspaceId, role: 'MEMBER' });
    }
  }

  // System user is OWNER
  for (const workspaceId of workspaceSet.keys()) {
    membershipRows.push({
      user_id: SYSTEM_USER_ID,
      workspace_id: workspaceId,
      role: 'OWNER',
    });
  }

  console.log(`🔗  Creating ${membershipRows.length.toLocaleString()} workspace memberships…`);
  await batchInsert('memberships', membershipRows, ['user_id', 'workspace_id']);

  // -------------------------------------------------------------------------
  // 10. Summary output
  // -------------------------------------------------------------------------

  const workspaceIds = [...workspaceSet.keys()];
  const memberIds = [...memberSet.keys()].map(memberId);

  console.log('\n✅  Import complete!\n');

  console.log('=== WORKSPACE (ORGANISATION) IDs ===');
  console.log(JSON.stringify(workspaceIds, null, 2));

  console.log('\n=== MEMBER IDs ===');
  console.log(JSON.stringify(memberIds, null, 2));

  // Also write them to files for easy scripting
  const outDir = resolve(ROOT, 'db');
  await Bun.write(
    resolve(outDir, 'trello-import-workspace-ids.json'),
    JSON.stringify(workspaceIds, null, 2),
  );
  await Bun.write(
    resolve(outDir, 'trello-import-member-ids.json'),
    JSON.stringify(memberIds, null, 2),
  );
  console.log('\n📄  Written to db/trello-import-workspace-ids.json and db/trello-import-member-ids.json');

  await db.destroy();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function flushCards(
  cardRows: object[],
  cardLabelRows: object[],
  cardMemberRows: object[],
): Promise<void> {
  await batchInsert('cards', cardRows, 'id');
  await batchInsert('card_labels', cardLabelRows, ['card_id', 'label_id']);
  await batchInsert('card_members', cardMemberRows, ['card_id', 'user_id']);
}

main().catch((err) => {
  console.error('❌  Import failed:', err);
  process.exit(1);
});
