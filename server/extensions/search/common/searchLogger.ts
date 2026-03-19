// Structured observability logger for the search extension.
//
// WHY: Access-aware search filtering and board-open permission checks must be
// observable in production so that regressions in access control are detectable
// from logs without needing to reproduce them manually.
//
// Design rules:
//   1. Never log sensitive user data: search query text (q), card/board titles.
//   2. Log UUIDs (userId, workspaceId, boardId) — these are operational identifiers.
//   3. Log aggregated counts (filteredCount, totalCount) — not individual result IDs.
//   4. All log entries are JSON-serialisable and written to stdout via console.info.
//   5. Logging must never throw or surface errors to callers.

import type { Role } from '../../../middlewares/permissionManager';

type SearchEvent =
  | 'search.request'
  | 'search.results'
  | 'search.permission_filter_applied'
  | 'search.permission_denied'
  | 'search.feature_disabled'
  | 'board_search.request'
  | 'board_search.results'
  | 'board_search.access_denied'
  | 'board.access_checked';

interface BaseLogEntry {
  event: SearchEvent;
  ts: string;
}

interface SearchRequestLog extends BaseLogEntry {
  event: 'search.request';
  workspaceId: string;
  userId: string;
  callerRole: Role;
  type: 'board' | 'card' | null;
  limit: number;
}

interface SearchResultsLog extends BaseLogEntry {
  event: 'search.results';
  workspaceId: string;
  userId: string;
  callerRole: Role;
  resultCount: number;
  hasMore: boolean;
}

interface SearchPermissionFilterLog extends BaseLogEntry {
  event: 'search.permission_filter_applied';
  workspaceId: string;
  userId: string;
  callerRole: Role;
  type: 'board' | 'card' | null;
  includeArchived: boolean;
}

interface SearchPermissionDeniedLog extends BaseLogEntry {
  event: 'search.permission_denied';
  workspaceId: string;
  userId: string | undefined;
  reason: string;
}

interface SearchFeatureDisabledLog extends BaseLogEntry {
  event: 'search.feature_disabled';
  workspaceId: string;
}

interface BoardSearchRequestLog extends BaseLogEntry {
  event: 'board_search.request';
  boardId: string;
  userId: string | undefined;
}

interface BoardSearchResultsLog extends BaseLogEntry {
  event: 'board_search.results';
  boardId: string;
  userId: string | undefined;
  resultCount: number;
}

interface BoardSearchAccessDeniedLog extends BaseLogEntry {
  event: 'board_search.access_denied';
  boardId: string;
  userId: string | undefined;
  statusCode: number;
}

interface BoardAccessCheckedLog extends BaseLogEntry {
  event: 'board.access_checked';
  boardId: string;
  userId: string | undefined;
  visibility: string;
  callerRole: Role | undefined;
  result: 'allowed' | 'denied';
  statusCode: number | undefined;
}

type LogEntry =
  | SearchRequestLog
  | SearchResultsLog
  | SearchPermissionFilterLog
  | SearchPermissionDeniedLog
  | SearchFeatureDisabledLog
  | BoardSearchRequestLog
  | BoardSearchResultsLog
  | BoardSearchAccessDeniedLog
  | BoardAccessCheckedLog;

function emit(entry: LogEntry): void {
  try {
    console.info(JSON.stringify({ ...entry, ts: new Date().toISOString() }));
  } catch {
    // Logging must never surface errors to callers.
  }
}

export const searchLog = {
  request(params: Omit<SearchRequestLog, 'event' | 'ts'>): void {
    emit({ event: 'search.request', ts: '', ...params });
  },

  results(params: Omit<SearchResultsLog, 'event' | 'ts'>): void {
    emit({ event: 'search.results', ts: '', ...params });
  },

  permissionFilterApplied(params: Omit<SearchPermissionFilterLog, 'event' | 'ts'>): void {
    emit({ event: 'search.permission_filter_applied', ts: '', ...params });
  },

  permissionDenied(params: Omit<SearchPermissionDeniedLog, 'event' | 'ts'>): void {
    emit({ event: 'search.permission_denied', ts: '', ...params });
  },

  featureDisabled(params: Omit<SearchFeatureDisabledLog, 'event' | 'ts'>): void {
    emit({ event: 'search.feature_disabled', ts: '', ...params });
  },

  boardSearchRequest(params: Omit<BoardSearchRequestLog, 'event' | 'ts'>): void {
    emit({ event: 'board_search.request', ts: '', ...params });
  },

  boardSearchResults(params: Omit<BoardSearchResultsLog, 'event' | 'ts'>): void {
    emit({ event: 'board_search.results', ts: '', ...params });
  },

  boardSearchAccessDenied(params: Omit<BoardSearchAccessDeniedLog, 'event' | 'ts'>): void {
    emit({ event: 'board_search.access_denied', ts: '', ...params });
  },

  boardAccessChecked(params: Omit<BoardAccessCheckedLog, 'event' | 'ts'>): void {
    emit({ event: 'board.access_checked', ts: '', ...params });
  },
};
