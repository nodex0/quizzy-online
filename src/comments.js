// Client-side comments & flagging.
//
// Runs against same-origin Pages Functions at /comments. Reads
// `window.QUIZZY_CONFIG = { turnstileSiteKey }` set in index.html. If the
// site key is missing the feature is inert — the quiz still works.
//
// This module:
//   - Renders a collapsible "comments" block into a host element.
//   - Fetches/caches comments per (setId, questionIdx).
//   - Lazily loads the Cloudflare Turnstile widget when the form opens.
//   - Submits via POST /comments with a Turnstile token.

(function () {
    'use strict';

    const cfg = window.QUIZZY_CONFIG || {};
    const SITE_KEY = typeof cfg.turnstileSiteKey === 'string' ? cfg.turnstileSiteKey : '';

    const LETTERS = ['a', 'b', 'c', 'd'];
    const FLAG_REASONS = [
        { id: 'wrong-answer', label: 'Respuesta incorrecta' },
        { id: 'unclear', label: 'Pregunta confusa' },
        { id: 'typo', label: 'Errata' },
        { id: 'other', label: 'Otro' }
    ];

    // In-memory cache: key = setId + ':' + questionIdx → { comments, fetchedAt }
    const cache = new Map();

    function enabled() {
        return Boolean(SITE_KEY);
    }

    function esc(s) {
        return String(s == null ? '' : s).replace(
            /[&<>"']/g,
            (c) =>
                ({
                    '&': '&amp;',
                    '<': '&lt;',
                    '>': '&gt;',
                    '"': '&quot;',
                    "'": '&#39;'
                })[c]
        );
    }

    function fmtRelative(ts) {
        const s = Math.floor(Date.now() / 1000) - ts;
        if (s < 60) return 'hace un momento';
        if (s < 3600) return 'hace ' + Math.floor(s / 60) + ' min';
        if (s < 86400) return 'hace ' + Math.floor(s / 3600) + ' h';
        if (s < 2592000) return 'hace ' + Math.floor(s / 86400) + ' d';
        return new Date(ts * 1000).toLocaleDateString();
    }

    function cacheKey(setId, qIdx) {
        return setId + ':' + qIdx;
    }

    async function list(setId, qIdx) {
        if (!enabled()) return [];
        const k = cacheKey(setId, qIdx);
        const cached = cache.get(k);
        if (cached && Date.now() - cached.fetchedAt < 30000) {
            return cached.comments;
        }
        try {
            const url = new URL('/comments', window.location.origin);
            url.searchParams.set('setId', setId);
            url.searchParams.set('questionIdx', String(qIdx));
            const resp = await fetch(url.toString(), {
                method: 'GET',
                credentials: 'same-origin'
            });
            if (!resp.ok) throw new Error('HTTP ' + resp.status);
            const data = await resp.json();
            const comments = Array.isArray(data.comments) ? data.comments : [];
            cache.set(k, { comments, fetchedAt: Date.now() });
            return comments;
        } catch {
            // Network hiccup: empty list, don't cache so next open retries.
            return [];
        }
    }

    function invalidate(setId, qIdx) {
        cache.delete(cacheKey(setId, qIdx));
    }

    function appendToCache(setId, qIdx, comment) {
        const k = cacheKey(setId, qIdx);
        const cur = cache.get(k);
        if (cur) {
            cur.comments = cur.comments.concat([comment]);
            cur.fetchedAt = Date.now();
        }
    }

    // ---------- Turnstile loader ----------

    let turnstileLoader = null;
    function ensureTurnstile() {
        if (!SITE_KEY) return Promise.resolve(false);
        if (window.turnstile && typeof window.turnstile.render === 'function') {
            return Promise.resolve(true);
        }
        if (turnstileLoader) return turnstileLoader;
        turnstileLoader = new Promise((resolve) => {
            const s = document.createElement('script');
            s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=__quizzyTurnstileReady&render=explicit';
            s.async = true;
            s.defer = true;
            window.__quizzyTurnstileReady = function () {
                resolve(Boolean(window.turnstile));
            };
            s.onerror = () => resolve(false);
            document.head.appendChild(s);
        });
        return turnstileLoader;
    }

    // ---------- Submission ----------

    async function submit(payload) {
        if (!enabled()) throw new Error('comments-disabled');
        const resp = await fetch('/comments', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        let body = null;
        try {
            body = await resp.json();
        } catch {
            /* ignore */
        }
        if (!resp.ok || !body || body.ok !== true) {
            const msg =
                (body && body.message) ||
                (body && body.error) ||
                'Error al enviar';
            throw new Error(msg);
        }
        return body.comment;
    }

    // ---------- Rendering ----------

    function renderListHtml(comments) {
        if (!comments.length) {
            return '<p class="comments-empty">Aún no hay comentarios para esta pregunta.</p>';
        }
        return (
            '<ul class="comments-list">' +
            comments
                .map((c) => {
                    const who = c.nickname
                        ? esc(c.nickname)
                        : 'Anónimo';
                    const when = esc(fmtRelative(c.created_at));
                    const meta =
                        '<div class="comment-meta"><b>' +
                        who +
                        '</b> · <span>' +
                        when +
                        '</span></div>';
                    let kindBadge = '';
                    if (c.kind === 'flag') {
                        const reason = c.flag_reason
                            ? FLAG_REASONS.find((r) => r.id === c.flag_reason)
                                  ?.label || c.flag_reason
                            : 'Reporte';
                        kindBadge =
                            '<span class="comment-badge flag">🚩 ' +
                            esc(reason) +
                            '</span>';
                    } else {
                        kindBadge =
                            '<span class="comment-badge">💬 Comentario</span>';
                    }
                    const body = c.body
                        ? '<p class="comment-body">' + esc(c.body) + '</p>'
                        : '';
                    return (
                        '<li class="comment">' +
                        kindBadge +
                        meta +
                        body +
                        '</li>'
                    );
                })
                .join('') +
            '</ul>'
        );
    }

    function renderFormHtml() {
        const reasons = FLAG_REASONS.map(
            (r) =>
                '<option value="' + r.id + '">' + esc(r.label) + '</option>'
        ).join('');
        return (
            '<div class="comment-form">' +
            '<div class="comment-kind-tabs">' +
            '<button type="button" class="kind-tab active" data-kind="comment">💬 Comentario</button>' +
            '<button type="button" class="kind-tab" data-kind="flag">🚩 Reportar error</button>' +
            '</div>' +
            '<div class="flag-reason-row" hidden>' +
            '<label for="cf-reason" class="comment-label">Motivo</label>' +
            '<select id="cf-reason" class="cf-input">' +
            reasons +
            '</select>' +
            '</div>' +
            '<label for="cf-body" class="comment-label">Tu comentario</label>' +
            '<textarea id="cf-body" class="cf-input" rows="3" maxlength="1500" placeholder="Explica por qué la pregunta es incorrecta o añade una nota..."></textarea>' +
            '<label for="cf-nick" class="comment-label">Apodo (opcional)</label>' +
            '<input id="cf-nick" class="cf-input" type="text" maxlength="40" placeholder="Anónimo">' +
            // Honeypot: hidden, bots tend to fill it. Labelled innocuously
            // but visually hidden.
            '<input type="text" name="website" class="cf-hp" tabindex="-1" autocomplete="off" aria-hidden="true">' +
            '<div class="cf-turnstile" data-turnstile-host></div>' +
            '<div class="cf-actions">' +
            '<span class="cf-status" data-cf-status></span>' +
            '<button type="button" class="cf-cancel">Cancelar</button>' +
            '<button type="button" class="cf-submit primary" disabled>Enviar</button>' +
            '</div>' +
            '</div>'
        );
    }

    // Render (or re-render) the comments widget into `host`, for the given
    // question context. `ctx` shape:
    //   { setId, questionIdx, questionText, currentAnswer, options }
    function mount(host, ctx) {
        if (!enabled()) {
            host.innerHTML = '';
            return;
        }

        host.innerHTML =
            '<details class="comments" data-comments>' +
            '<summary><span class="comments-title">💬 Comentarios</span>' +
            '<span class="comments-count" data-cc>…</span></summary>' +
            '<div class="comments-body" data-cbody>' +
            '<div class="comments-loading">Cargando…</div>' +
            '</div>' +
            '</details>';

        const details = host.querySelector('[data-comments]');
        const cbody = host.querySelector('[data-cbody]');
        const cc = host.querySelector('[data-cc]');

        // Preview count first (without fetching) from cache if available.
        const cached = cache.get(cacheKey(ctx.setId, ctx.questionIdx));
        if (cached) cc.textContent = '(' + cached.comments.length + ')';

        let rendered = false;

        function paint(comments) {
            cc.textContent = '(' + comments.length + ')';
            cbody.innerHTML =
                renderListHtml(comments) +
                '<button type="button" class="comments-add" data-add>+ Añadir comentario o reportar error</button>';
            wireAdd(comments);
        }

        function wireAdd(comments) {
            const addBtn = cbody.querySelector('[data-add]');
            if (!addBtn) return;
            addBtn.addEventListener('click', () => {
                openForm(comments);
            });
        }

        function openForm(comments) {
            cbody.innerHTML = renderListHtml(comments) + renderFormHtml();
            const form = cbody.querySelector('.comment-form');
            const status = form.querySelector('[data-cf-status]');
            const submitBtn = form.querySelector('.cf-submit');
            const cancelBtn = form.querySelector('.cf-cancel');
            const tabs = form.querySelectorAll('.kind-tab');
            const reasonRow = form.querySelector('.flag-reason-row');
            const bodyEl = form.querySelector('#cf-body');
            const nickEl = form.querySelector('#cf-nick');
            const reasonEl = form.querySelector('#cf-reason');
            const hp = form.querySelector('.cf-hp');
            const tsHost = form.querySelector('[data-turnstile-host]');

            let kind = 'comment';
            let turnstileToken = '';
            let turnstileWidgetId = null;

            tabs.forEach((t) =>
                t.addEventListener('click', () => {
                    kind = t.dataset.kind;
                    tabs.forEach((x) => x.classList.toggle('active', x === t));
                    reasonRow.hidden = kind !== 'flag';
                    if (kind === 'flag') {
                        bodyEl.placeholder =
                            'Describe brevemente el problema (opcional)...';
                    } else {
                        bodyEl.placeholder =
                            'Explica por qué la pregunta es incorrecta o añade una nota...';
                    }
                })
            );

            cancelBtn.addEventListener('click', () => paint(comments));

            // Mount Turnstile widget once the form is visible.
            ensureTurnstile().then((ready) => {
                if (!ready || !SITE_KEY) {
                    status.textContent =
                        '⚠ Anti-spam no disponible. Contacta al administrador.';
                    return;
                }
                try {
                    turnstileWidgetId = window.turnstile.render(tsHost, {
                        sitekey: SITE_KEY,
                        callback: (token) => {
                            turnstileToken = token;
                            submitBtn.disabled = false;
                        },
                        'expired-callback': () => {
                            turnstileToken = '';
                            submitBtn.disabled = true;
                        },
                        'error-callback': () => {
                            turnstileToken = '';
                            submitBtn.disabled = true;
                        }
                    });
                } catch (e) {
                    status.textContent = '⚠ Error Turnstile: ' + e.message;
                }
            });

            submitBtn.addEventListener('click', async () => {
                const bodyText = bodyEl.value.trim();
                if (kind === 'comment' && !bodyText) {
                    status.textContent = 'Escribe algo primero.';
                    return;
                }
                submitBtn.disabled = true;
                status.textContent = 'Enviando…';
                try {
                    const payload = {
                        setId: ctx.setId,
                        questionIdx: ctx.questionIdx,
                        questionText: ctx.questionText,
                        currentAnswer: ctx.currentAnswer,
                        options: ctx.options,
                        kind,
                        body: bodyText || null,
                        nickname: nickEl.value.trim() || null,
                        turnstileToken,
                        hp: hp.value
                    };
                    if (kind === 'flag') {
                        payload.flagReason = reasonEl.value;
                    }
                    const created = await submit(payload);
                    if (created) {
                        appendToCache(ctx.setId, ctx.questionIdx, created);
                        const newList = (
                            cache.get(cacheKey(ctx.setId, ctx.questionIdx))
                                ?.comments || []
                        ).slice();
                        paint(newList);
                        status.textContent = '';
                    } else {
                        // Likely honeypot silent accept — pretend success.
                        paint(comments);
                    }
                } catch (e) {
                    status.textContent = '✗ ' + e.message;
                    submitBtn.disabled = false;
                    if (turnstileWidgetId != null && window.turnstile) {
                        try {
                            window.turnstile.reset(turnstileWidgetId);
                        } catch {
                            /* ignore */
                        }
                    }
                }
            });
        }

        details.addEventListener(
            'toggle',
            function () {
                if (!details.open || rendered) return;
                rendered = true;
                list(ctx.setId, ctx.questionIdx).then(paint);
            }
        );
    }

    window.QuizzyComments = {
        enabled: enabled,
        mount: mount,
        list: list,
        invalidate: invalidate
    };
})();
