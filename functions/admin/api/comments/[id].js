// DELETE /admin/api/comments/:id — hard delete.

import { requireAdmin } from '../../../_lib/auth.js';
import { json, toInt } from '../../../_lib/utils.js';

export async function onRequestDelete({ request, env, params }) {
    const gate = await requireAdmin(request, env);
    if (gate) return gate;

    const id = toInt(params.id);
    if (id === null || id <= 0) {
        return json({ error: 'bad-id' }, { status: 400 });
    }

    const res = await env.DB.prepare('DELETE FROM comments WHERE id = ?')
        .bind(id)
        .run();
    if (!res.meta.changes) return json({ error: 'not-found' }, { status: 404 });
    return json({ ok: true });
}
