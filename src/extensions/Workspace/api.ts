// API client for all workspace-related endpoints.
// Callers must inject an axios-compatible `api` instance (from Redux thunk extras).

export type Role = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER' | 'GUEST';

export interface Workspace {
  id: string;
  name: string;
  ownerId: string;
  // [why] callerRole is returned by GET /workspaces so the client can gate UI
  // without a separate members request (GUESTs cannot call the members endpoint).
  callerRole?: Role;
  createdAt: string;
}

export interface WorkspaceMember {
  userId: string;
  email: string;
  role: Role;
  name?: string | null;
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
  return api.get<{ data: Workspace[] }>('/workspaces');
}

export async function getWorkspace({
  api,
  workspaceId,
}: {
  api: { get: <T>(url: string) => Promise<T> };
  workspaceId: string;
}): Promise<{ data: Workspace }> {
  return api.get<{ data: Workspace }>(`/workspaces/${workspaceId}`);
}

export async function createWorkspace({
  api,
  name,
}: {
  api: { post: <B, T>(url: string, body: B) => Promise<T> };
  name: string;
}): Promise<{ data: Workspace }> {
  return api.post<{ name: string }, { data: Workspace }>('/workspaces', { name });
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
    `/workspaces/${workspaceId}`,
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
    `/workspaces/${workspaceId}`,
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
    `/workspaces/${workspaceId}/invite`,
    { email, role }
  );
}

export async function addMember({
  api,
  workspaceId,
  email,
  role,
}: {
  api: { post: <B, T>(url: string, body: B) => Promise<T> };
  workspaceId: string;
  email: string;
  role: Role;
}): Promise<{ data: WorkspaceMember }> {
  return api.post<{ email: string; role: Role }, { data: WorkspaceMember }>(
    `/workspaces/${workspaceId}/members`,
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
  return api.get<{ data: Invite }>(`/invites/${token}`);
}

export async function acceptInvite({
  api,
  token,
}: {
  api: { post: <B, T>(url: string, body: B) => Promise<T> };
  token: string;
}): Promise<{ data: WorkspaceMember }> {
  return api.post<unknown, { data: WorkspaceMember }>(
    `/invites/${token}/accept`,
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
    `/workspaces/${workspaceId}/members`
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
    `/workspaces/${workspaceId}/members/${userId}`,
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
    `/workspaces/${workspaceId}/members/${userId}`,
    {}
  );
}
