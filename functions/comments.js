// /comments — public list + submit.
//
// GET  /comments?setId=<id>&questionIdx=<n>  → published comments for a Q
// POST /comments                              → create (Turnstile + rate-limit + honeypot)

import {
    json,
    getClientIp,
    now,
    cleanString,
    toInt,
    runCleanup
} from './_lib/utils.js';
import { verifyTurnstile } from './_lib/turnstile.js';

const MAX_BODY_LEN = 1500;
const MAX_NICK_LEN = 40;
const MAX_QTEXT_LEN = 2000;
const MAX_OPT_LEN = 1000;
const VALID_FLAG_REASONS = new Set([
    'wrong-answer',
    'unclear',
    'typo',
    'other'
]);

export async function onRequestGet({ request, env }) {
    const url = new URL(request.url);
    const setId = cleanString(url.searchParams.get('setId'), 64);
    const questionIdx = toInt(url.searchParams.get('questionIdx'));

    if (!setId || questionIdx === null || questionIdx < 0) {
        return json(
            { error: 'bad-request', message: 'setId and questionIdx required' },
            { status: 400 }
        );
    }

    const { results } = await env.DB.prepare(
        `SELECT id, set_id, question_idx, kind, flag_reason, body, nickname, created_at
         FROM comments
         WHERE set_id = ? AND question_idx = ? AND status = 'published'
         ORDER BY created_at ASC
         LIMIT 200`
    )
        .bind(setId, questionIdx)
        .all();

    return json({ comments: results || [] });
}

export async function onRequestPost(context) {
    const { request, env } = context;

    let payload;
    try {
        payload = await request.json();
    } catch {
        return json({ error: 'bad-json' }, { status: 400 });
    }

    // Honeypot: hidden field clients must leave empty. Bots tend to fill it.
    if (payload && typeof payload.hp === 'string' && payload.hp.length > 0) {
        // Pretend success — don't tip off the bot.
        return json({ ok: true, comment: null }, { status: 202 });
    }

    const setId = cleanString(payload?.setId, 64);
    const questionIdx = toInt(payload?.questionIdx);
    const questionText = cleanString(payload?.questionText, MAX_QTEXT_LEN);
    const currentAnswer = toInt(payload?.currentAnswer);
    const options = Array.isArray(payload?.options) ? payload.options : null;
    const kind = payload?.kind === 'flag' ? 'flag' : 'comment';
    const flagReasonRaw = cleanString(payload?.flagReason, 32);
    const flagReason =
        kind === 'flag' && flagReasonRaw && VALID_FLAG_REASONS.has(flagReasonRaw)
            ? flagReasonRaw
            : kind === 'flag'
              ? 'other'
              : null;
    const body = cleanString(payload?.body, MAX_BODY_LEN);
    const nickname = cleanString(payload?.nickname, MAX_NICK_LEN);
    const turnstileToken = payload?.turnstileToken;

    if (
        !setId ||
        questionIdx === null ||
        questionIdx < 0 ||
        !questionText ||
        currentAnswer === null ||
        currentAnswer < 0 ||
        currentAnswer > 3 ||
        !options ||
        options.length !== 4 ||
        options.some((o) => typeof o !== 'string')
    ) {
        return json(
            { error: 'bad-request', message: 'missing/invalid fields' },
            { status: 400 }
        );
    }

    // Comments need a body; flags can be empty (a bare "this is wrong").
    if (kind === 'comment' && !body) {
        return json(
            {
                error: 'empty-comment',
                message: 'El comentario no puede estar vacío.'
            },
            { status: 400 }
        );
    }

    const optionsJson = JSON.stringify(
        options.map((o) => cleanString(o, MAX_OPT_LEN) || '')
    );

    const ip = getClientIp(request);

    const turnstile = await verifyTurnstile(turnstileToken, ip, env);
    if (!turnstile.ok) {
        return json(
            {
                error: 'turnstile-failed',
                message:
                    'Verificación anti-spam no superada. Recarga e inténtalo de nuevo.',
                reason: turnstile.reason
            },
            { status: 403 }
        );
    }

    // Rate limit by IP: at most RATE_LIMIT_MAX_POSTS in RATE_LIMIT_WINDOW_SEC.
    const windowSec = Math.max(
        60,
        parseInt(env.RATE_LIMIT_WINDOW_SEC || '3600', 10)
    );
    const maxPosts = Math.max(
        1,
        parseInt(env.RATE_LIMIT_MAX_POSTS || '5', 10)
    );
    const since = now() - windowSec;

    const { results: rateRows } = await env.DB.prepare(
        'SELECT COUNT(*) AS n FROM comments WHERE ip = ? AND created_at > ?'
    )
        .bind(ip, since)
        .all();
    const recent = rateRows?.[0]?.n ?? 0;
    if (recent >= maxPosts) {
        return json(
            {
                error: 'rate-limited',
                message: `Demasiados envíos. Máximo ${maxPosts} por ${Math.round(windowSec / 60)} minutos.`
            },
            { status: 429 }
        );
    }

    const userAgent = cleanString(request.headers.get('User-Agent'), 400);
    const ts = now();

    const res = await env.DB.prepare(
        `INSERT INTO comments
           (set_id, question_idx, question_text, current_answer, options_json,
            kind, flag_reason, body, nickname, ip, user_agent, created_at, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published')`
    )
        .bind(
            setId,
            questionIdx,
            questionText,
            currentAnswer,
            optionsJson,
            kind,
            flagReason,
            body,
            nickname,
            ip,
            userAgent,
            ts
        )
        .run();

    const id = res?.meta?.last_row_id ?? null;

    // Lazy background cleanup: ~1% chance of redacting old IPs / purging
    // old spam on each submission, so the DB self-maintains without cron.
    if (Math.random() < 0.01) {
        context.waitUntil(runCleanup(env).catch(() => {}));
    }

    return json(
        {
            ok: true,
            comment: {
                id,
                set_id: setId,
                question_idx: questionIdx,
                kind,
                flag_reason: flagReason,
                body,
                nickname,
                created_at: ts
            }
        },
        { status: 201 }
    );
}
