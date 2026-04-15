// Admin session tokens — HMAC-SHA256 over a tiny payload, no KV needed.
//
// Cookie format: `qadmin=<base64url(payload)>.<base64url(sig)>`
// payload = { iat: <unix seconds> }
// Signed with env.ADMIN_SESSION_SECRET. Valid for SESSION_TTL_SEC.

import { timingSafeEqual } from './utils.js';

const COOKIE_NAME = 'qadmin';
const SESSION_TTL_SEC = 7 * 24 * 3600; // 7 days

function b64urlEncode(bytes) {
    let s = btoa(String.fromCharCode(...bytes));
    return s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(str) {
    const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
    const b64 = (str + pad).replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
}

async function hmacKey(secret) {
    const enc = new TextEncoder();
    return crypto.subtle.importKey(
        'raw',
        enc.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign', 'verify']
    );
}

async function sign(payloadBytes, secret) {
    const key = await hmacKey(secret);
    const sig = await crypto.subtle.sign('HMAC', key, payloadBytes);
    return new Uint8Array(sig);
}

export async function issueSession(env) {
    if (!env.ADMIN_SESSION_SECRET) {
        throw new Error('ADMIN_SESSION_SECRET not set');
    }
    const payload = JSON.stringify({ iat: Math.floor(Date.now() / 1000) });
    const payloadBytes = new TextEncoder().encode(payload);
    const sig = await sign(payloadBytes, env.ADMIN_SESSION_SECRET);
    return `${b64urlEncode(payloadBytes)}.${b64urlEncode(sig)}`;
}

export async function verifySession(token, env) {
    if (!token || !env.ADMIN_SESSION_SECRET) return null;
    const dot = token.indexOf('.');
    if (dot < 1) return null;
    const p = token.slice(0, dot);
    const s = token.slice(dot + 1);

    let payloadBytes, sigBytes;
    try {
        payloadBytes = b64urlDecode(p);
        sigBytes = b64urlDecode(s);
    } catch {
        return null;
    }

    const key = await hmacKey(env.ADMIN_SESSION_SECRET);
    const ok = await crypto.subtle.verify('HMAC', key, sigBytes, payloadBytes);
    if (!ok) return null;

    let payload;
    try {
        payload = JSON.parse(new TextDecoder().decode(payloadBytes));
    } catch {
        return null;
    }
    if (typeof payload?.iat !== 'number') return null;
    const age = Math.floor(Date.now() / 1000) - payload.iat;
    if (age < 0 || age > SESSION_TTL_SEC) return null;
    return payload;
}

export function parseCookies(request) {
    const header = request.headers.get('Cookie') || '';
    const out = {};
    for (const part of header.split(';')) {
        const eq = part.indexOf('=');
        if (eq < 0) continue;
        const k = part.slice(0, eq).trim();
        const v = part.slice(eq + 1).trim();
        if (k) out[k] = decodeURIComponent(v);
    }
    return out;
}

export async function isAdmin(request, env) {
    const cookies = parseCookies(request);
    const token = cookies[COOKIE_NAME];
    if (!token) return false;
    return !!(await verifySession(token, env));
}

export function sessionCookie(value, maxAgeSec, opts = {}) {
    // Drop Secure on non-HTTPS (local dev via `wrangler pages dev`) so
    // auth still works without a TLS cert.
    const secure = opts.secure !== false;
    const parts = [
        `${COOKIE_NAME}=${encodeURIComponent(value)}`,
        'Path=/',
        'HttpOnly',
        'SameSite=Strict',
        `Max-Age=${maxAgeSec}`
    ];
    if (secure) parts.push('Secure');
    return parts.join('; ');
}

export function clearSessionCookie(opts = {}) {
    return sessionCookie('', 0, opts);
}

export function requestIsSecure(request) {
    try {
        return new URL(request.url).protocol === 'https:';
    } catch {
        return true;
    }
}

export function checkPassword(submitted, env) {
    const stored = env.ADMIN_PASSWORD || '';
    if (!stored) return false;
    return timingSafeEqual(String(submitted || ''), stored);
}

// Gate helper for admin routes. Returns a Response to short-circuit with,
// or null if the caller is authenticated.
export async function requireAdmin(request, env) {
    if (await isAdmin(request, env)) return null;
    const url = new URL(request.url);
    if (url.pathname.startsWith('/admin/api/')) {
        return new Response(JSON.stringify({ error: 'unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json; charset=utf-8' }
        });
    }
    return new Response(null, {
        status: 302,
        headers: { Location: '/admin/login' }
    });
}

export { COOKIE_NAME, SESSION_TTL_SEC };
