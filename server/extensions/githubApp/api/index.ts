// GitHub App webhook router — mounted at /api/v1/github/webhook.
import { handleGitHubWebhook } from './webhook';

export async function githubAppRouter(req: Request, pathname: string): Promise<Response | null> {
  if (pathname === '/api/v1/github/webhook' && req.method === 'POST') {
    return handleGitHubWebhook(req);
  }
  // Any other /api/v1/github/* path falls through to the default 404.
  return null;
}
