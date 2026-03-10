// API functions for the board view preference endpoints (Sprint 52).
// GET /api/v1/boards/:id/view-preference  — retrieve current user's saved view
// PUT /api/v1/boards/:id/view-preference  — upsert the view type
import { apiClient } from '~/common/api/client';
import type { ViewPreference } from './types';

export async function getViewPreference({
  boardId,
}: {
  boardId: string;
}): Promise<{ data: ViewPreference }> {
  return apiClient.get(`/boards/${boardId}/view-preference`);
}

export async function putViewPreference({
  boardId,
  viewType,
}: {
  boardId: string;
  viewType: string;
}): Promise<{ data: ViewPreference }> {
  return apiClient.put(`/boards/${boardId}/view-preference`, { viewType });
}
