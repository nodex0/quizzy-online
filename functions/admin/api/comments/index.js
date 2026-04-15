// GET /admin/api/comments — list with filters + stats.

import { requireAdmin } from '../../../_lib/auth.js';
import { json, toInt, cleanString } from '../../../_lib/utils.js';

export async function onRequestGet({ request, env }) {
    const gate = await requireAdmin(request, env);
    if (gate) return gate;

    const url = new URL(request.url);
    const status = url.searchParams.get('status') || 'all';
    const kind = url.searchParams.get('kind') || 'all';
    const search = cleanString(url.searchParams.get('q'), 200);
    const offset = Math.max(0, toInt(url.searchParams.get('offset')) || 0);
    const limit = Math.min(
        200,
        Math.max(1, toInt(url.searchParams.get('limit')) || 100)
    );

    const where = [];
    const binds = [];
    if (status !== 'all') {
        where.push('status = ?');
        binds.push(status);
    }
    if (kind !== 'all') {
        where.push('kind = ?');
        binds.push(kind);
    }
    if (search) {
        where.push('(body LIKE ? OR question_text LIKE ? OR nickname LIKE ?)');
        const like = `%${search.replace(/[%_]/g, (c) => '\\' + c)}%`;
        binds.push(like, like, like);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const sql = `
        SELECT id, set_id, question_idx, question_text, current_answer, options_json,
               kind, flag_reason, body, nickname, ip, user_agent, created_at,
               status, admin_note
        FROM comments
        ${whereSql}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
    `;
    const { results } = await env.DB.prepare(sql)
        .bind(...binds, limit, offset)
        .all();

    const countRes = await env.DB.prepare(
        `SELECT COUNT(*) AS n FROM comments ${whereSql}`
    )
        .bind(...binds)
        .all();
    const total = countRes.results?.[0]?.n ?? 0;

    const statsRes = await env.DB.prepare(
        `SELECT status, COUNT(*) AS n FROM comments GROUP BY status`
    ).all();
    const stats = { all: 0, published: 0, hidden: 0, spam: 0 };
    for (const row of statsRes.results || []) {
        if (row.status in stats) stats[row.status] = row.n;
        stats.all += row.n;
    }

    return json({ comments: results || [], total, stats, offset, limit });
}
