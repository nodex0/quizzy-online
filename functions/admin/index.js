// GET /admin — moderation panel. Redirects to /admin/login if no session.

import { requireAdmin } from '../_lib/auth.js';
import { html } from '../_lib/utils.js';
import { PANEL_HTML } from '../_lib/admin-panel.js';

export async function onRequestGet({ request, env }) {
    const gate = await requireAdmin(request, env);
    if (gate) return gate;
    return html(PANEL_HTML);
}
