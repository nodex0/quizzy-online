// /admin/login
//   GET  → login form (or redirect to /admin if already authed)
//   POST → verify password, set session cookie, redirect to /admin

import {
    isAdmin,
    checkPassword,
    issueSession,
    sessionCookie,
    requestIsSecure,
    SESSION_TTL_SEC
} from '../_lib/auth.js';
import { html, json } from '../_lib/utils.js';
import { loginPageHtml } from '../_lib/admin-panel.js';

export async function onRequestGet({ request, env }) {
    if (await isAdmin(request, env)) {
        return new Response(null, {
            status: 302,
            headers: { Location: '/admin' }
        });
    }
    return html(loginPageHtml(''));
}

export async function onRequestPost({ request, env }) {
    const ct = request.headers.get('Content-Type') || '';
    let submitted = '';
    if (ct.includes('application/json')) {
        try {
            const j = await request.json();
            submitted = j.password || '';
        } catch {
            /* ignore */
        }
    } else {
        const form = await request.formData();
        submitted = form.get('password') || '';
    }

    if (!checkPassword(submitted, env)) {
        if (ct.includes('application/json')) {
            return json({ error: 'invalid-password' }, { status: 401 });
        }
        return html(loginPageHtml('Invalid password.'), { status: 401 });
    }

    const token = await issueSession(env);
    const secure = requestIsSecure(request);
    const cookie = sessionCookie(token, SESSION_TTL_SEC, { secure });

    if (ct.includes('application/json')) {
        return json({ ok: true }, { status: 200 }, { 'Set-Cookie': cookie });
    }
    return new Response(null, {
        status: 302,
        headers: { Location: '/admin', 'Set-Cookie': cookie }
    });
}
