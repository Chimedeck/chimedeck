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
import { tmpdir } from 'node:os';
import { unlink } from 'node:fs/promises';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

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
  Bun.env['DATABASE_URL'] ?? 'postgresql://horiflow:horiflow@localhost:5432/horiflow_dev';

const S3_BUCKET    = Bun.env['S3_BUCKET'] ?? 'horiflow';
const S3_REGION    = Bun.env['S3_REGION'] ?? 'us-east-1';
const S3_ENDPOINT  = Bun.env['S3_ENDPOINT'] || undefined;
const S3_BASE_URL  = S3_ENDPOINT
  ? `${S3_ENDPOINT}/${S3_BUCKET}`
  : `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com`;

// When using LocalStack (S3_ENDPOINT is set), any non-empty credentials are
// accepted — fall back to 'test'/'test' so the SDK doesn't reject empty strings.
// For real AWS both vars must be explicitly set.
const AWS_ACCESS_KEY_ID     = Bun.env['AWS_ACCESS_KEY_ID']     || (S3_ENDPOINT ? 'test' : '');
const AWS_SECRET_ACCESS_KEY = Bun.env['AWS_SECRET_ACCESS_KEY'] || (S3_ENDPOINT ? 'test' : '');

const s3 = new S3Client({
  region: S3_REGION,
  endpoint: S3_ENDPOINT,
  credentials: {
    accessKeyId:     AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
  },
  // Required for LocalStack and other path-style S3-compatible endpoints
  forcePathStyle: !!S3_ENDPOINT,
});

const BATCH_SIZE = 500; // rows per INSERT batch

// ---------------------------------------------------------------------------
// Member ID → email mapper (from trello-import-member-ids-mapper.json)
// ---------------------------------------------------------------------------

const mapperPath = resolve(ROOT, 'db/trello-import-member-ids-mapper.json');
const mapperRaw: { id: string; username: string; email?: string }[] =
  await Bun.file(mapperPath).json();
const memberMapper = new Map(
  mapperRaw.map((entry) => [entry.id, entry]),
);

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

function memberEmail(trelloMemberId: string, username?: string): string {
  const mapped = memberMapper.get(trelloMemberId);
  if (mapped?.email) return mapped.email;
  const slug = username ?? mapped?.username ?? trelloMemberId;
  return `developer+${slug}@journeyh.io`;
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

/**
 * Upsert helper — inserts rows and, on conflict, updates only the specified
 * columns. Columns omitted from `updateColumns` (e.g. created_at, owner_id,
 * password_hash) are left untouched on subsequent runs.
 */
async function batchUpsert<T extends object>(
  table: string,
  rows: T[],
  conflictTarget: string | string[],
  updateColumns: string[],
): Promise<void> {
  if (rows.length === 0) return;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    await db(table)
      .insert(chunk)
      .onConflict(conflictTarget as any)
      .merge(updateColumns);
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

interface TrelloMember {
  id: string;
  fullName: string;
  username: string;
  avatarUrl: string | null;
  avatarHash: string | null;
  initials: string;
  confirmed?: boolean;
}

interface TrelloAction {
  id: string;
  date: string;
  data: {
    text?: string;
    idCard?: string;
    card?: { id: string };
  };
  memberCreator: TrelloMember;
}

interface TrelloBoard {
  id: string;
  name: string;
  manager?: string;
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
  // Enriched fields present in updated export
  members?: TrelloMember[];
  actions?: TrelloAction[];
  board?: TrelloBoard;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const defaultJsonPath = resolve(ROOT, 'db/all_trello_cards.json');
  let jsonPath = defaultJsonPath;
  let jsonFile = Bun.file(jsonPath);

  if (!(await jsonFile.exists())) {
    const seedFileUrl = Bun.env['SEED_FILE_URL'];
    if (!seedFileUrl) {
      console.error(`❌  File not found: ${jsonPath}`);
      console.error(`    Set SEED_FILE_URL to an S3 URL to download it automatically.`);
      process.exit(1);
    }

    console.log(`📥  ${jsonPath} not found — downloading from SEED_FILE_URL…`);
    const response = await fetch(seedFileUrl);
    if (!response.ok) {
      console.error(`❌  Failed to download seed file: ${response.status} ${response.statusText}`);
      process.exit(1);
    }

    const seedBuffer = await response.arrayBuffer();
    const fallbackJsonPath = resolve(tmpdir(), 'all_trello_cards.json');
    let writeError: unknown = null;

    try {
      await Bun.write(defaultJsonPath, seedBuffer);
      jsonPath = defaultJsonPath;
    } catch (err) {
      writeError = err;
      // Docker production runs as non-root user and /app/db may be read-only.
      // Fall back to a temp location so seeding can still proceed.
      await Bun.write(fallbackJsonPath, seedBuffer);
      jsonPath = fallbackJsonPath;
      console.warn(`⚠️   Could not write seed file to ${defaultJsonPath}; using ${fallbackJsonPath} instead.`);
    }

    console.log(`✅  Downloaded seed file to ${jsonPath}`);
    if (writeError) {
      console.warn(`    Original write error: ${toErrorMessage(writeError)}`);
    }
    jsonFile = Bun.file(jsonPath);
  }

  const bytes = jsonFile.size;
  console.log(`📂  Loading ${(bytes / 1024 / 1024).toFixed(1)} MB JSON…`);

  // Bun.file().json() uses a C++ iterative parser — stack-safe for any depth.
  const cards: TrelloCard[] = await jsonFile.json();
  console.log(`✅  Parsed ${cards.length.toLocaleString()} cards`);

  // -------------------------------------------------------------------------
  // 1. Collect unique entities from all cards
  // -------------------------------------------------------------------------

  // Single Journeyhorizon workspace — all Trello boards belong to this one org
  const JOURNEYHORIZON_WORKSPACE_ID = 'journeyhorizon';
  const JOURNEYHORIZON_WORKSPACE_NAME = 'Journeyhorizon';

  // workspaces — single org; boards are keyed by their Trello board ID
  const workspaceSet = new Map<string, { id: string; name: string }>();
  workspaceSet.set(JOURNEYHORIZON_WORKSPACE_ID, { id: JOURNEYHORIZON_WORKSPACE_ID, name: JOURNEYHORIZON_WORKSPACE_NAME });
  const boardSet = new Map<string, { id: string; workspace_id: string; title: string }>();
  const listSet = new Map<string, object>();
  const labelSet = new Map<string, object>();
  const memberSet = new Map<string, string>(); // trelloId → email
  // Rich member data (fullName, username, avatarUrl) when available
  const memberDataMap = new Map<string, TrelloMember>();

  for (const card of cards) {
    // Board — prefer the name from card.board if present; all boards belong to the single workspace
    if (!boardSet.has(card.idBoard)) {
      const boardName = card.board?.name ?? card.idBoard;
      boardSet.set(card.idBoard, {
        id: card.idBoard,
        workspace_id: JOURNEYHORIZON_WORKSPACE_ID,
        title: boardName,
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
          workspace_id: JOURNEYHORIZON_WORKSPACE_ID,
          name: label.name || 'Label',
          color: trelloColor(label.color),
        });
      }
    }

    // Members — prefer rich data from card.members array
    for (const member of card.members ?? []) {
      if (!memberDataMap.has(member.id)) {
        memberDataMap.set(member.id, member);
      }
      if (!memberSet.has(member.id)) {
        memberSet.set(member.id, memberEmail(member.id));
      }
    }

    // Fallback: collect from idMembers (for cards without a members array)
    for (const mid of card.idMembers ?? []) {
      if (!memberSet.has(mid)) {
        memberSet.set(mid, memberEmail(mid));
      }
    }

    // Collect member creators from actions (comments)
    for (const action of card.actions ?? []) {
      if (action.memberCreator) {
        const mc = action.memberCreator;
        if (!memberDataMap.has(mc.id)) {
          memberDataMap.set(mc.id, mc);
        }
        if (!memberSet.has(mc.id)) {
          memberSet.set(mc.id, memberEmail(mc.id));
        }
      }
    }
  }

  console.log(`\n📊  Unique entities:`);
  console.log(`    Workspaces          : ${workspaceSet.size}`);
  console.log(`    Boards              : ${boardSet.size}`);
  console.log(`    Lists               : ${listSet.size}`);
  console.log(`    Labels              : ${labelSet.size}`);
  console.log(`    Members             : ${memberSet.size}`);

  // -------------------------------------------------------------------------
  // 2. System owner user — owns all workspaces
  // -------------------------------------------------------------------------

  const SYSTEM_USER_ID = '58ce49cc971aa59ff0ef284c'; // tam.vu@journeyh.io
  const SYSTEM_USER_EMAIL = 'tam.vu@journeyh.io';
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
        name: 'Tam Vu',
        password_hash: systemPasswordHash,
      },
    ],
    'id',
  );

  // -------------------------------------------------------------------------
  // 3. Member users
  // -------------------------------------------------------------------------

  console.log(`👥  Creating ${memberSet.size} member users…`);

  // ---------------------------------------------------------------------------
  // 3a. Download avatars and upload to S3
  // Avatars are downloaded to a temp directory, uploaded to S3, then deleted.
  // The temp files are never committed to git.
  // ---------------------------------------------------------------------------

  // S3 is available when either:
  //   - S3_ENDPOINT is set → LocalStack or custom S3-compatible endpoint (credentials default to 'test')
  //   - Both AWS credential vars are set → real AWS S3
  const s3Configured = !!(S3_ENDPOINT || (AWS_ACCESS_KEY_ID && AWS_SECRET_ACCESS_KEY));
  if (!s3Configured) {
    console.log('⚠️   No S3_ENDPOINT and no AWS credentials — skipping avatar upload');
  }

  console.log(`🖼️   Downloading & uploading avatars for up to ${memberDataMap.size} members…`);
  const avatarUrlMap = new Map<string, string>(); // trelloId → S3 URL

  const AVATAR_CONCURRENCY = 10;
  const memberDataEntries = [...memberDataMap.entries()];
  if (s3Configured) {
    for (let i = 0; i < memberDataEntries.length; i += AVATAR_CONCURRENCY) {
      const slice = memberDataEntries.slice(i, i + AVATAR_CONCURRENCY);
      await Promise.all(
        slice.map(async ([trelloId, member]) => {
          if (!member.avatarUrl) return;
          const s3Url = await downloadAndUploadAvatar(member);
          if (s3Url) avatarUrlMap.set(trelloId, s3Url);
        }),
      );
      if (i % (AVATAR_CONCURRENCY * 5) === 0) {
        process.stdout.write(`    avatars ${Math.min(i + AVATAR_CONCURRENCY, memberDataEntries.length)} / ${memberDataEntries.length}\r`);
      }
    }
  }
  console.log(`\n    uploaded ${avatarUrlMap.size} avatars to S3`);

  // Hash all passwords in parallel (Bun.password.hash is async but CPU-bound;
  // keep parallelism reasonable to avoid overloading the event loop).
  const memberEntries = [...memberSet.entries()];
  const memberRows: object[] = [];

  const HASH_CONCURRENCY = 20;
  for (let i = 0; i < memberEntries.length; i += HASH_CONCURRENCY) {
    const slice = memberEntries.slice(i, i + HASH_CONCURRENCY);
    const hashes = await Promise.all(
      slice.map(() =>
        Bun.password.hash(DEFAULT_PASSWORD, { algorithm: 'bcrypt', cost: 12 }),
      ),
    );
    for (let j = 0; j < slice.length; j++) {
      const [trelloId] = slice[j];
      const richData = memberDataMap.get(trelloId);
      memberRows.push({
        id: memberId(trelloId),
        email: memberEmail(trelloId, richData?.username),
        // Use fullName when available, fall back to trello ID
        name: richData?.fullName || trelloId,
        // Use Trello username as our nickname; must be unique — use id as fallback
        nickname: richData?.username || trelloId,
        avatar_url: avatarUrlMap.get(trelloId) ?? null,
        password_hash: hashes[j],
        // [why] Seeded accounts are trusted imports — skip the email verification
        // flow so they can log in immediately even when FLAG_EMAIL_VERIFICATION_ENABLED=true.
        email_verified: true,
      });
    }
    if ((i / HASH_CONCURRENCY) % 5 === 0) {
      process.stdout.write(
        `    hashed ${Math.min(i + HASH_CONCURRENCY, memberEntries.length)} / ${memberEntries.length}\r`,
      );
    }
  }
  console.log('');

  // email and password_hash are excluded — preserve any changes the user made.
  // email_verified is included so re-seeding fixes previously imported users.
  await batchUpsert('users', memberRows, 'id', ['name', 'nickname', 'avatar_url', 'email_verified']);

  // -------------------------------------------------------------------------
  // 4. Workspaces
  // -------------------------------------------------------------------------

  console.log(`🏢  Creating/updating ${workspaceSet.size} workspaces…`);
  // owner_id is excluded from the update set — preserve current ownership.
  await batchUpsert(
    'workspaces',
    [...workspaceSet.values()].map((w) => ({ ...w, owner_id: SYSTEM_USER_ID })),
    'id',
    ['name'],
  );

  // Make all member users MEMBER of every workspace they appear on
  // (We do a separate pass after cards are processed for per-board granularity)

  // -------------------------------------------------------------------------
  // 5. Boards
  // -------------------------------------------------------------------------

  console.log(`📋  Creating/updating ${boardSet.size} boards…`);
  await batchUpsert('boards', [...boardSet.values()], 'id', ['title', 'state']);

  // -------------------------------------------------------------------------
  // 6. Lists
  // -------------------------------------------------------------------------

  console.log(`📑  Creating/updating ${listSet.size} lists…`);
  await batchUpsert('lists', [...listSet.values()], 'id', ['title', 'position', 'archived', 'board_id']);

  // -------------------------------------------------------------------------
  // 7. Labels
  // -------------------------------------------------------------------------

  console.log(`🏷️   Creating/updating ${labelSet.size} labels…`);
  await batchUpsert('labels', [...labelSet.values()], 'id', ['name', 'color']);

  // -------------------------------------------------------------------------
  // 8. Cards + card_labels + card_members (batched)
  // -------------------------------------------------------------------------

  console.log(`🃏  Inserting/updating ${cards.length.toLocaleString()} cards…`);

  const cardRows: object[] = [];
  // Junction rows are ID pairs only — small footprint, collected in full so we
  // can sync them with a single delete-then-insert pass after all cards are processed.
  const allCardLabelRows: object[] = [];
  const allCardMemberRows: object[] = [];
  // All Trello card IDs that appear in this JSON (used to scope the junction sync)
  const trelloCardIds: string[] = [];
  // Track uniqueness for junction tables within this run
  const cardLabelSeen = new Set<string>();
  const cardMemberSeen = new Set<string>();

  for (const card of cards) {
    // Skip cards whose list was not collected (list property missing)
    if (!listSet.has(card.idList)) continue;

    trelloCardIds.push(card.id);

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
          allCardLabelRows.push({ card_id: card.id, label_id: labelId });
        }
      }
    }

    for (const mid of card.idMembers ?? []) {
      const userId = memberId(mid);
      const key = `${card.id}:${userId}`;
      if (!cardMemberSeen.has(key)) {
        cardMemberSeen.add(key);
        allCardMemberRows.push({ card_id: card.id, user_id: userId });
      }
    }

    // Flush card rows when large to avoid holding everything in memory.
    // Junction rows (ID pairs only) are small and collected in full above.
    if (cardRows.length >= BATCH_SIZE * 4) {
      await batchUpsert('cards', cardRows, 'id', [
        'list_id', 'title', 'description', 'position', 'archived',
        'due_date', 'short_link', 'short_url', 'updated_at',
      ]);
      cardRows.length = 0;
    }
  }

  // Final flush for remaining card rows
  await batchUpsert('cards', cardRows, 'id', [
    'list_id', 'title', 'description', 'position', 'archived',
    'due_date', 'short_link', 'short_url', 'updated_at',
  ]);

  // Sync junction tables: delete existing rows only for Trello-sourced cards,
  // then re-insert from the latest JSON. Natively-created cards (whose IDs are
  // not in trelloCardIds) are never touched.
  console.log('🔄  Syncing card labels…');
  for (let i = 0; i < trelloCardIds.length; i += BATCH_SIZE) {
    await db('card_labels').whereIn('card_id', trelloCardIds.slice(i, i + BATCH_SIZE)).delete();
  }
  await batchInsert('card_labels', allCardLabelRows, ['card_id', 'label_id']);

  console.log('🔄  Syncing card members…');
  for (let i = 0; i < trelloCardIds.length; i += BATCH_SIZE) {
    await db('card_members').whereIn('card_id', trelloCardIds.slice(i, i + BATCH_SIZE)).delete();
  }
  await batchInsert('card_members', allCardMemberRows, ['card_id', 'user_id']);

  // -------------------------------------------------------------------------
  // 8b. Comments from Trello actions
  // -------------------------------------------------------------------------

  console.log('💬  Collecting comments from card actions…');

  // Build a lookup of every user ID we actually inserted so we can guard
  // against FK violations. memberId(trelloId) === trelloId — Trello member IDs
  // are used as-is as our user PKs, so this set is keyed by the Trello ID.
  const insertedUserIds = new Set<string>([
    SYSTEM_USER_ID,
    ...memberRows.map((r: any) => r.id as string),
  ]);

  const commentRows: object[] = [];
  const commentSeen = new Set<string>();

  for (const card of cards) {
    // Skip cards whose list was not collected
    if (!listSet.has(card.idList)) continue;

    for (const action of card.actions ?? []) {
      if (commentSeen.has(action.id)) continue;
      commentSeen.add(action.id);

      const authorTrelloId = action.memberCreator?.id;
      if (!authorTrelloId) continue;

      // memberId(trelloId) returns the trelloId unchanged — our users table
      // stores Trello member IDs directly as PKs for a stable 1-to-1 mapping.
      const userId = memberId(authorTrelloId);
      if (!insertedUserIds.has(userId)) {
        // Guard: skip if the author was never seeded as a user (avoids FK error)
        console.warn(`    ⚠️  skipping comment ${action.id} — author ${authorTrelloId} not in users table`);
        continue;
      }

      const text = action.data?.text;
      if (!text) continue;

      commentRows.push({
        id: action.id,
        card_id: card.id,
        user_id: userId,
        content: text,
        created_at: new Date(action.date),
        updated_at: new Date(action.date),
      });
    }
  }

  console.log(`💬  Inserting/updating ${commentRows.length.toLocaleString()} comments…`);
  await batchUpsert('comments', commentRows, 'id', ['content', 'updated_at']);

  // -------------------------------------------------------------------------
  // 9. Workspace memberships for member users
  //    Add every member user as MEMBER of every workspace (board).
  //    This is a cross-product; we do it after cards so we know who's who.
  // -------------------------------------------------------------------------

  // Collect all member users across every board into the single Journeyhorizon workspace
  const workspaceMemberSet = new Set<string>();
  for (const card of cards) {
    for (const mid of card.idMembers ?? []) {
      workspaceMemberSet.add(memberId(mid));
    }
  }

  const membershipRows: object[] = [];
  for (const userId of workspaceMemberSet) {
    membershipRows.push({ user_id: userId, workspace_id: JOURNEYHORIZON_WORKSPACE_ID, role: 'MEMBER' });
  }

  // System user is OWNER of the single Journeyhorizon workspace
  membershipRows.push({
    user_id: SYSTEM_USER_ID,
    workspace_id: JOURNEYHORIZON_WORKSPACE_ID,
    role: 'OWNER',
  });

  console.log(`🔗  Creating ${membershipRows.length.toLocaleString()} workspace memberships…`);
  await batchInsert('memberships', membershipRows, ['user_id', 'workspace_id']);

  // -------------------------------------------------------------------------
  // 10. Summary output
  // -------------------------------------------------------------------------

  const workspaceIds = [...workspaceSet.keys()];
  const memberRecords = [...memberSet.keys()].map((trelloId) => {
    const rich = memberDataMap.get(trelloId);
    return {
      id: memberId(trelloId),
      username: rich?.username ?? null,
    };
  });

  console.log('\n✅  Import complete!\n');

  console.log('=== WORKSPACE (ORGANISATION) IDs ===');
  console.log(JSON.stringify(workspaceIds, null, 2));

  console.log('\n=== MEMBER IDs ===');
  console.log(JSON.stringify(memberRecords, null, 2));

  // Also write them to files for easy scripting
  const outDir = resolve(ROOT, 'db');
  const workspaceIdsPath = await writeOutputJsonWithFallback({
    preferredPath: resolve(outDir, 'trello-import-workspace-ids.json'),
    fallbackPath: resolve(tmpdir(), 'trello-import-workspace-ids.json'),
    body: JSON.stringify(workspaceIds, null, 2),
  });
  const memberIdsPath = await writeOutputJsonWithFallback({
    preferredPath: resolve(outDir, 'trello-import-member-ids.json'),
    fallbackPath: resolve(tmpdir(), 'trello-import-member-ids.json'),
    body: JSON.stringify(memberRecords, null, 2),
  });

  console.log(`\n📄  Written workspace IDs to ${workspaceIdsPath}`);
  console.log(`📄  Written member IDs to ${memberIdsPath}`);

  await db.destroy();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Download a Trello member avatar to a temp file, upload it to S3, then
 * delete the temp file. Returns the S3 URL or null on failure.
 *
 * The temp file is written to os.tmpdir() and is never committed to git.
 */
async function downloadAndUploadAvatar(member: TrelloMember): Promise<string | null> {
  if (!member.avatarUrl) return null;
  // Trello avatar URLs support size suffixes: /170.png gives a 170×170 image
  const fetchUrl = `${member.avatarUrl}/170.png`;
  const tmpPath = resolve(tmpdir(), `trello-avatar-${member.id}.png`);
  try {
    const response = await fetch(fetchUrl, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) return null;
    const buffer = await response.arrayBuffer();

    // Write to temp file
    await Bun.write(tmpPath, buffer);

    // Upload to S3 — use the same key pattern as the avatar upload handler
    const s3Key = `avatars/${member.id}.png`;
    await s3.send(
      new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: s3Key,
        Body: new Uint8Array(buffer),
        ContentType: 'image/png',
      }),
    );

    return `${S3_BASE_URL}/${s3Key}`;
  } catch {
    // Non-fatal: avatar failures should not block the import
    return null;
  } finally {
    // Always clean up the temp file
    try { await unlink(tmpPath); } catch { /* ignore — file may not exist */ }
  }
}

async function writeOutputJsonWithFallback({
  preferredPath,
  fallbackPath,
  body,
}: {
  preferredPath: string;
  fallbackPath: string;
  body: string;
}): Promise<string> {
  try {
    await Bun.write(preferredPath, body);
    return preferredPath;
  } catch (err) {
    await Bun.write(fallbackPath, body);
    console.warn(`⚠️   Could not write ${preferredPath}; wrote ${fallbackPath} instead.`);
    console.warn(`    Original write error: ${toErrorMessage(err)}`);
    return fallbackPath;
  }
}

function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  if (typeof err === 'number' || typeof err === 'boolean' || typeof err === 'bigint') {
    return `${err}`;
  }
  try {
    const parsed = JSON.stringify(err);
    return parsed ?? 'unknown-error';
  } catch {
    return 'unknown-error';
  }
}

main().catch((err) => {
  console.error('❌  Import failed:', err);
  process.exit(1);
});
