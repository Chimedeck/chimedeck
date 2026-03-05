// GET /api/v1/plugins/categories — deduplicated list of category strings from active plugins.
import { db } from '../../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../../auth/middlewares/authentication';

export async function handleListCategories(req: Request): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const result = await db.raw<{ rows: Array<{ category: string }> }>(
    `SELECT DISTINCT jsonb_array_elements_text(categories) AS category
     FROM plugins
     WHERE is_active = true
     ORDER BY category`,
  );

  const categories = result.rows.map((r) => r.category);

  return Response.json({ data: categories });
}
