// Cloudflare Turnstile verification.
//
// The client renders the widget with TURNSTILE_SITE_KEY and sends the
// resulting token in the POST body. We round-trip it to /siteverify with the
// server-side secret before accepting the submission.
//
// https://developers.cloudflare.com/turnstile/get-started/server-side-validation/

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export async function verifyTurnstile(token, ip, env) {
    if (!env.TURNSTILE_SECRET_KEY) {
        // Fail closed if the secret isn't configured, so a misconfigured
        // deploy can't become an open relay.
        return { ok: false, reason: 'turnstile-not-configured' };
    }
    if (!token || typeof token !== 'string') {
        return { ok: false, reason: 'missing-token' };
    }

    const form = new FormData();
    form.append('secret', env.TURNSTILE_SECRET_KEY);
    form.append('response', token);
    if (ip) form.append('remoteip', ip);

    let data;
    try {
        const resp = await fetch(VERIFY_URL, { method: 'POST', body: form });
        data = await resp.json();
    } catch {
        return { ok: false, reason: 'verify-request-failed' };
    }

    if (!data || data.success !== true) {
        return {
            ok: false,
            reason: 'turnstile-rejected',
            codes: data?.['error-codes'] || []
        };
    }
    return { ok: true };
}
