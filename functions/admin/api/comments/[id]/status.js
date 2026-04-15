// POST /admin/api/comments/:id/status — body { status, adminNote? }

import { requireAdmin } from '../../../../_lib/auth.js';
import { json, toInt, cleanString } from '../../../../_lib/utils.js';

export async function onRequestPost({ request, env, params }) {
    const gate = await requireAdmin(request, env);
    if (gate) return gate;

    const id = toInt(params.id);
    if (id === null || id <= 0) {
        return json({ error: 'bad-id' }, { status: 400 });
    }

    let payload;
    try {
        payload = await request.json();
    } catch {
        return json({ error: 'bad-json' }, { status: 400 });
    }
    const status = payload?.status;
    const adminNote = cleanString(payload?.adminNote, 500);
    if (!['published', 'hidden', 'spam'].includes(status)) {
        return json({ error: 'bad-status' }, { status: 400 });
    }
    const res = await env.DB.prepare(
        'UPDATE comments SET status = ?, admin_note = COALESCE(?, admin_note) WHERE id = ?'
    )
        .bind(status, adminNote, id)
        .run();
    if (!res.meta.changes) return json({ error: 'not-found' }, { status: 404 });
    return json({ ok: true });
}
