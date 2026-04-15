// Small helpers for Pages Functions.
//
// Static site and API live on the same Cloudflare Pages origin, so there is
// no CORS layer — requests come from the same host that served the HTML.

export function json(body, init = {}, extraHeaders = {}) {
    return new Response(JSON.stringify(body), {
        ...init,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store',
            ...extraHeaders
        }
    });
}

export function text(body, init = {}, extraHeaders = {}) {
    return new Response(body, {
        ...init,
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'no-store',
            ...extraHeaders
        }
    });
}

export function html(body, init = {}, extraHeaders = {}) {
    return new Response(body, {
        ...init,
        headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store',
            'X-Frame-Options': 'DENY',
            'Referrer-Policy': 'same-origin',
            ...extraHeaders
        }
    });
}

export function getClientIp(request) {
    // Cloudflare always sets CF-Connecting-IP on the incoming request.
    return (
        request.headers.get('CF-Connecting-IP') ||
        request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
        'unknown'
    );
}

export function now() {
    return Math.floor(Date.now() / 1000);
}

// Clamp and trim a user-supplied string. Returns null if empty after trim.
export function cleanString(s, maxLen) {
    if (typeof s !== 'string') return null;
    const t = s.replace(/\s+/g, ' ').trim();
    if (!t) return null;
    return t.length > maxLen ? t.slice(0, maxLen) : t;
}

// Integer validation that accepts numeric strings ("0" through MAX_SAFE).
export function toInt(v) {
    if (typeof v === 'number' && Number.isFinite(v)) return Math.trunc(v);
    if (typeof v === 'string' && /^-?\d+$/.test(v)) {
        const n = parseInt(v, 10);
        return Number.isFinite(n) ? n : null;
    }
    return null;
}

// Constant-time string compare for passwords.
export function timingSafeEqual(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) {
        diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return diff === 0;
}

// Lazy background cleanup: redact old IPs, purge old spam. Called with a
// random chance on POST /comments so the DB self-maintains without a cron.
export async function runCleanup(env) {
    const redactDays = Math.max(
        1,
        parseInt(env.IP_REDACT_AFTER_DAYS || '180', 10)
    );
    const spamDays = Math.max(
        1,
        parseInt(env.SPAM_DELETE_AFTER_DAYS || '30', 10)
    );
    const redactBefore = now() - redactDays * 24 * 3600;
    const spamBefore = now() - spamDays * 24 * 3600;

    await env.DB.prepare(
        `UPDATE comments SET ip = 'redacted', user_agent = NULL
         WHERE ip != 'redacted' AND created_at < ?`
    )
        .bind(redactBefore)
        .run();

    await env.DB.prepare(
        `DELETE FROM comments WHERE status = 'spam' AND created_at < ?`
    )
        .bind(spamBefore)
        .run();
}
