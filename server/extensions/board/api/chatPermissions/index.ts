// Barrel export for board chat-permissions handlers.
// GET  /api/v1/boards/:id/chat-permissions — read permissions (all members)
// PATCH /api/v1/boards/:id/chat-permissions — update guest toggles (ADMIN/OWNER only)
export { handleGetChatPermissions } from './get';
export { handlePatchChatPermissions } from './patch';
