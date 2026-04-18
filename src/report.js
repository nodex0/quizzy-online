// Client-side question reporting.
//
// Runs against same-origin Pages Functions at /comments. Reads
// `window.QUIZZY_CONFIG = { turnstileSiteKey }` set in index.html. If the
// site key is missing the feature is inert — the quiz still works.
//
// Exposes a single "Report question" button per question. Clicking it opens
// a form that posts a flag (kind: 'flag') to the backend, protected by
// Cloudflare Turnstile.

(function () {
    'use strict';

    const I18N = window.I18N;
    const t = (k, p) => (I18N ? I18N.t(k, p) : k);

    const cfg = window.QUIZZY_CONFIG || {};
    const SITE_KEY =
        typeof cfg.turnstileSiteKey === 'string' ? cfg.turnstileSiteKey : '';

    const FLAG_REASONS = [
        { id: 'wrong-answer', labelKey: 'report.reasonWrong' },
        { id: 'unclear', labelKey: 'report.reasonUnclear' },
        { id: 'typo', labelKey: 'report.reasonTypo' },
        { id: 'other', labelKey: 'report.reasonOther' }
    ];

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
            s.src =
                'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=__quizzyTurnstileReady&render=explicit';
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
        if (!enabled()) throw new Error('report-disabled');
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
                t('report.sendError');
            throw new Error(msg);
        }
        return body.comment;
    }

    // ---------- Rendering ----------

    function renderFormHtml() {
        const reasons = FLAG_REASONS.map(
            (r) =>
                '<option value="' +
                r.id +
                '">' +
                esc(t(r.labelKey)) +
                '</option>'
        ).join('');
        return (
            '<div class="report-form">' +
            '<div class="report-title">🚩 ' +
            esc(t('report.title')) +
            '</div>' +
            '<label for="rf-reason" class="report-label">' +
            esc(t('report.reason')) +
            '</label>' +
            '<select id="rf-reason" class="rf-input">' +
            reasons +
            '</select>' +
            '<label for="rf-body" class="report-label">' +
            esc(t('report.body')) +
            '</label>' +
            '<textarea id="rf-body" class="rf-input" rows="3" maxlength="1500" placeholder="' +
            esc(t('report.bodyPlaceholder')) +
            '"></textarea>' +
            '<label for="rf-nick" class="report-label">' +
            esc(t('report.nickname')) +
            '</label>' +
            '<input id="rf-nick" class="rf-input" type="text" maxlength="40" placeholder="' +
            esc(t('report.nicknamePlaceholder')) +
            '">' +
            // Honeypot: hidden, bots tend to fill it.
            '<input type="text" name="website" class="rf-hp" tabindex="-1" autocomplete="off" aria-hidden="true">' +
            '<div class="rf-turnstile" data-turnstile-host></div>' +
            '<div class="rf-actions">' +
            '<span class="rf-status" data-rf-status></span>' +
            '<button type="button" class="rf-cancel">' +
            esc(t('report.cancel')) +
            '</button>' +
            '<button type="button" class="rf-submit primary" disabled>' +
            esc(t('report.submit')) +
            '</button>' +
            '</div>' +
            '</div>'
        );
    }

    function renderButtonHtml() {
        return (
            '<button type="button" class="report-btn" data-report-open>' +
            esc(t('report.button')) +
            '</button>'
        );
    }

    // Render the report widget into `host`, for the given question context.
    // ctx shape: { setId, questionIdx, questionText, currentAnswer, options }
    function mount(host, ctx) {
        if (!enabled()) {
            host.innerHTML = '';
            return;
        }

        function paintButton() {
            host.innerHTML = renderButtonHtml();
            const btn = host.querySelector('[data-report-open]');
            if (btn) btn.addEventListener('click', openForm);
        }

        function paintThanks() {
            host.innerHTML =
                '<p class="report-thanks">' + esc(t('report.sent')) + '</p>';
        }

        function openForm() {
            host.innerHTML = renderFormHtml();
            const form = host.querySelector('.report-form');
            const status = form.querySelector('[data-rf-status]');
            const submitBtn = form.querySelector('.rf-submit');
            const cancelBtn = form.querySelector('.rf-cancel');
            const bodyEl = form.querySelector('#rf-body');
            const nickEl = form.querySelector('#rf-nick');
            const reasonEl = form.querySelector('#rf-reason');
            const hp = form.querySelector('.rf-hp');
            const tsHost = form.querySelector('[data-turnstile-host]');

            let turnstileToken = '';
            let turnstileWidgetId = null;

            cancelBtn.addEventListener('click', paintButton);

            ensureTurnstile().then((ready) => {
                if (!ready || !SITE_KEY) {
                    status.textContent = t('report.turnstileUnavailable');
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
                    status.textContent = t('report.turnstileError', {
                        msg: e.message
                    });
                }
            });

            submitBtn.addEventListener('click', async () => {
                submitBtn.disabled = true;
                status.textContent = t('report.sending');
                try {
                    const payload = {
                        setId: ctx.setId,
                        questionIdx: ctx.questionIdx,
                        questionText: ctx.questionText,
                        currentAnswer: ctx.currentAnswer,
                        options: ctx.options,
                        kind: 'flag',
                        flagReason: reasonEl.value,
                        body: bodyEl.value.trim() || null,
                        nickname: nickEl.value.trim() || null,
                        turnstileToken,
                        hp: hp.value
                    };
                    await submit(payload);
                    paintThanks();
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

        paintButton();
    }

    window.QuizzyReport = {
        enabled: enabled,
        mount: mount
    };
})();
