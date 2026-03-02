// API client for all workspace-related endpoints.
// Callers must inject an axios-compatible `api` instance (from Redux thunk extras).

export type Role = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';

export interface Workspace {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
}

export interface WorkspaceMember {
  userId: string;
  email: string;
  role: Role;
}

export interface Invite {
  id: string;
  workspaceId: string;
  workspaceName: string;
  invitedEmail: string;
  role: Role;
  expiresAt: string;
}

// ---------- Workspace CRUD ----------

export async function listWorkspaces({
  api,
}: {
  api: { get: <T>(url: string) => Promise<T> };
}): Promise<{ data: Workspace[] }> {
  return api.get<{ data: Workspace[] }>('/api/v1/workspaces');
}

export async function getWorkspace({
  api,
  workspaceId,
}: {
  api: { get: <T>(url: string) => Promise<T> };
  workspaceId: string;
}): Promise<{ data: Workspace }> {
  return api.get<{ data: Workspace }>(`/api/v1/workspaces/${workspaceId}`);
}

export async function createWorkspace({
  api,
  name,
}: {
  api: { post: <B, T>(url: string, body: B) => Promise<T> };
  name: string;
}): Promise<{ data: Workspace }> {
  return api.post<{ name: string }, { data: Workspace }>('/api/v1/workspaces', { name });
}

export async function updateWorkspace({
  api,
  workspaceId,
  name,
}: {
  api: { patch: <B, T>(url: string, body: B) => Promise<T> };
  workspaceId: string;
  name: string;
}): Promise<{ data: Workspace }> {
  return api.patch<{ name: string }, { data: Workspace }>(
    `/api/v1/workspaces/${workspaceId}`,
    { name }
  );
}

export async function deleteWorkspace({
  api,
  workspaceId,
}: {
  api: { delete: <B, T>(url: string, body: B) => Promise<T> };
  workspaceId: string;
}): Promise<{ data: Workspace }> {
  return api.delete<unknown, { data: Workspace }>(
    `/api/v1/workspaces/${workspaceId}`,
    {}
  );
}

// ---------- Invites ----------

export async function createInvite({
  api,
  workspaceId,
  email,
  role,
}: {
  api: { post: <B, T>(url: string, body: B) => Promise<T> };
  workspaceId: string;
  email: string;
  role: Role;
}): Promise<{ data: Invite }> {
  return api.post<{ email: string; role: Role }, { data: Invite }>(
    `/api/v1/workspaces/${workspaceId}/invite`,
    { email, role }
  );
}

export async function inspectInvite({
  api,
  token,
}: {
  api: { get: <T>(url: string) => Promise<T> };
  token: string;
}): Promise<{ data: Invite }> {
  return api.get<{ data: Invite }>(`/api/v1/invites/${token}`);
}

export async function acceptInvite({
  api,
  token,
}: {
  api: { post: <B, T>(url: string, body: B) => Promise<T> };
  token: string;
}): Promise<{ data: WorkspaceMember }> {
  return api.post<unknown, { data: WorkspaceMember }>(
    `/api/v1/invites/${token}/accept`,
    {}
  );
}

// ---------- Members ----------

export async function listMembers({
  api,
  workspaceId,
}: {
  api: { get: <T>(url: string) => Promise<T> };
  workspaceId: string;
}): Promise<{ data: WorkspaceMember[] }> {
  return api.get<{ data: WorkspaceMember[] }>(
    `/api/v1/workspaces/${workspaceId}/members`
  );
}

export async function updateMemberRole({
  api,
  workspaceId,
  userId,
  role,
}: {
  api: { patch: <B, T>(url: string, body: B) => Promise<T> };
  workspaceId: string;
  userId: string;
  role: Role;
}): Promise<{ data: WorkspaceMember }> {
  return api.patch<{ role: Role }, { data: WorkspaceMember }>(
    `/api/v1/workspaces/${workspaceId}/members/${userId}`,
    { role }
  );
}

export async function removeMember({
  api,
  workspaceId,
  userId,
}: {
  api: { delete: <B, T>(url: string, body: B) => Promise<T> };
  workspaceId: string;
  userId: string;
}): Promise<{ data: WorkspaceMember }> {
  return api.delete<unknown, { data: WorkspaceMember }>(
    `/api/v1/workspaces/${workspaceId}/members/${userId}`,
    {}
  );
}
