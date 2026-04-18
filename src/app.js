(function () {
    'use strict';

    const I18N = window.I18N;
    const t = (k, p) => I18N.t(k, p);

    const SETS = (window.QUESTION_SETS || []).slice();
    const LETTERS = ['a', 'b', 'c', 'd'];
    const ROLE_KEY = 'quizzy_selected_role_v1';
    const SELECTION_KEY = 'quizzy_selected_sets_v1';
    const SETUP_MODE_KEY = 'quizzy_setup_mode_v1';
    const THEME_KEY = 'celador_theme';
    const PROGRESS_KEY = 'quizzy_progress_v1';

    // Role catalogue. Each role pairs a common questionnaire with a
    // role-specific one. Only roles whose both sets are bundled will be
    // shown in the picker.
    const ROLE_CATALOGUE = [
        {
            id: 'celador',
            commonSetId: 'comun',
            specificSetId: 'celador',
            names: { es: 'Celador/a', eu: 'Zeladorea' },
            // Tabler Icons: wheelchair (MIT). Side-view wheelchair — the
            // universally-recognised disability symbol, fitting because
            // celadores/as move patients in wheelchairs.
            icon:
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
                'stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" ' +
                'aria-hidden="true">' +
                '<path d="M3 16a5 5 0 1 0 10 0a5 5 0 1 0 -10 0"/>' +
                '<path d="M17 19a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/>' +
                '<path d="M19 17a3 3 0 0 0 -3 -3h-3.4"/>' +
                '<path d="M3 3h1a2 2 0 0 1 2 2v6"/>' +
                '<path d="M6 8h11"/>' +
                '<path d="M15 8v6"/>' +
                '</svg>'
        },
        {
            id: 'auxiliar_admin',
            commonSetId: 'comun',
            specificSetId: 'auxiliar_admin',
            names: {
                es: 'Auxiliar Administrativo/a',
                eu: 'Administrari laguntzailea'
            },
            // Lucide: clipboard-list (ISC). Evokes formularios and expediente
            // administrative work.
            icon:
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
                'stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" ' +
                'aria-hidden="true">' +
                '<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/>' +
                '<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>' +
                '<path d="M12 11h4"/>' +
                '<path d="M12 16h4"/>' +
                '<path d="M8 11h.01"/>' +
                '<path d="M8 16h.01"/>' +
                '</svg>'
        },
        {
            id: 'operario_servicios',
            commonSetId: 'comun',
            specificSetId: 'operario_servicios',
            names: {
                es: 'Operario/a de Servicios',
                eu: 'Zerbitzuetako langilea'
            },
            // Lucide: wrench (ISC). Classic maintenance/servicios icon.
            icon:
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
                'stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" ' +
                'aria-hidden="true">' +
                '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0 1-8.259 7.057l-7.91 7.91a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z"/>' +
                '</svg>'
        }
    ];

    // Only surface roles whose required sets are actually bundled.
    const ROLES = ROLE_CATALOGUE.filter(
        (r) =>
            SETS.some((s) => s.id === r.commonSetId) &&
            SETS.some((s) => s.id === r.specificSetId)
    );

    function roleById(id) {
        return ROLES.find((r) => r.id === id) || null;
    }

    function roleSets(role) {
        return [role.commonSetId, role.specificSetId];
    }

    function roleName(role) {
        if (!role) return '';
        const lang = I18N.getLang();
        return role.names[lang] || role.names.es || role.id;
    }

    // Try to infer which role a saved selectedSets array belongs to.
    function roleForSets(ids) {
        if (!Array.isArray(ids) || !ids.length) return null;
        return (
            ROLES.find(
                (r) =>
                    ids.length === 2 &&
                    ids.includes(r.commonSetId) &&
                    ids.includes(r.specificSetId)
            ) || null
        );
    }

    function loadSelectedRoleId() {
        try {
            const raw = localStorage.getItem(ROLE_KEY);
            if (!raw) return null;
            return roleById(raw) ? raw : null;
        } catch {
            return null;
        }
    }

    function saveSelectedRoleId(id) {
        try {
            if (id) localStorage.setItem(ROLE_KEY, id);
            else localStorage.removeItem(ROLE_KEY);
        } catch {
            /* ignore */
        }
    }

    function loadCustomSelection() {
        try {
            const raw = localStorage.getItem(SELECTION_KEY);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                return parsed.filter((id) => SETS.some((s) => s.id === id));
            }
        } catch {
            /* ignore */
        }
        return [];
    }

    function saveCustomSelection(ids) {
        try {
            localStorage.setItem(SELECTION_KEY, JSON.stringify(ids));
        } catch {
            /* ignore */
        }
    }

    function loadSetupMode() {
        try {
            const m = localStorage.getItem(SETUP_MODE_KEY);
            if (m === 'roles' || m === 'custom') return m;
        } catch {
            /* ignore */
        }
        return 'roles';
    }

    function saveSetupMode(mode) {
        try {
            localStorage.setItem(SETUP_MODE_KEY, mode);
        } catch {
            /* ignore */
        }
    }

    // ---------- Progress persistence ----------

    function saveProgress() {
        if (state.view !== 'quiz' || !state.selectedSets.length) return;
        try {
            const snapshot = {
                v: 1,
                selectedSets: state.selectedSets.slice(),
                setSizes: state.selectedSets.map(
                    (id) => (setQuestionsById[id] || []).length
                ),
                mode: state.mode,
                order: state.order.slice(),
                optionOrders: state.optionOrders.map((o) =>
                    Array.isArray(o) ? o.slice() : null
                ),
                pos: state.pos,
                answers: state.answers.map((a) =>
                    a ? { picked: a.picked, correct: !!a.correct } : null
                ),
                updatedAt: Date.now()
            };
            localStorage.setItem(PROGRESS_KEY, JSON.stringify(snapshot));
        } catch {
            /* ignore */
        }
    }

    function clearProgress() {
        try {
            localStorage.removeItem(PROGRESS_KEY);
        } catch {
            /* ignore */
        }
    }

    // Returns a validated snapshot or null. Validates the saved state against
    // the currently bundled question sets — if a set disappears or its size
    // changes, the snapshot is considered stale and is discarded.
    function loadProgress() {
        try {
            const raw = localStorage.getItem(PROGRESS_KEY);
            if (!raw) return null;
            const snap = JSON.parse(raw);
            if (!snap || typeof snap !== 'object') return null;
            if (!Array.isArray(snap.selectedSets) || !snap.selectedSets.length)
                return null;
            // Every set must still exist with the same size.
            for (let i = 0; i < snap.selectedSets.length; i++) {
                const id = snap.selectedSets[i];
                const items = setQuestionsById[id];
                if (!items) return null;
                if (
                    Array.isArray(snap.setSizes) &&
                    typeof snap.setSizes[i] === 'number' &&
                    snap.setSizes[i] !== items.length
                ) {
                    return null;
                }
            }
            const bankSize = snap.selectedSets.reduce(
                (acc, id) => acc + (setQuestionsById[id]?.length || 0),
                0
            );
            if (!Array.isArray(snap.order) || snap.order.length !== bankSize)
                return null;
            for (const idx of snap.order) {
                if (
                    typeof idx !== 'number' ||
                    idx < 0 ||
                    idx >= bankSize ||
                    !Number.isInteger(idx)
                )
                    return null;
            }
            if (
                !Array.isArray(snap.answers) ||
                snap.answers.length !== bankSize
            )
                return null;
            for (const a of snap.answers) {
                if (a === null) continue;
                if (
                    !a ||
                    typeof a.picked !== 'number' ||
                    a.picked < 0 ||
                    a.picked > 3
                )
                    return null;
            }
            if (
                typeof snap.pos !== 'number' ||
                snap.pos < 0 ||
                snap.pos >= bankSize
            )
                return null;
            if (snap.mode !== 'seq' && snap.mode !== 'rand') return null;
            return snap;
        } catch {
            return null;
        }
    }

    function progressSummary(snap) {
        const answered = snap.answers.filter((a) => a !== null).length;
        const correct = snap.answers.filter((a) => a && a.correct).length;
        const wrong = snap.answers.filter((a) => a && !a.correct).length;
        return {
            total: snap.answers.length,
            answered,
            correct,
            wrong,
            pos: snap.pos
        };
    }

    // ---------- Theme ----------

    function currentTheme() {
        return document.documentElement.getAttribute('data-theme') === 'dark'
            ? 'dark'
            : 'light';
    }

    function updateThemeButton() {
        const btn = document.getElementById('theme-toggle');
        if (!btn) return;
        const isDark = currentTheme() === 'dark';
        btn.innerHTML = window.ICONS.get(isDark ? 'sun' : 'moon');
        btn.title = isDark ? t('theme.light') : t('theme.dark');
        btn.setAttribute('aria-label', btn.title);
    }

    function setTheme(theme, persist) {
        document.documentElement.setAttribute('data-theme', theme);
        if (persist) {
            try {
                localStorage.setItem(THEME_KEY, theme);
            } catch {
                /* ignore */
            }
        }
        updateThemeButton();
    }

    // ---------- Language switcher ----------

    function renderLangToggle() {
        const container = document.getElementById('lang-toggle');
        if (!container) return;
        const current = I18N.getLang();
        container.innerHTML = I18N.availableLangs()
            .map((l) => {
                const flag = window.ICONS.get('flag-' + l.code);
                return `<button type="button" class="lang-btn${
                    l.code === current ? ' active' : ''
                }" data-lang="${l.code}" title="${esc(l.label)}" aria-label="${esc(l.label)}">${flag}</button>`;
            })
            .join('');
        container.querySelectorAll('.lang-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                I18N.setLang(btn.dataset.lang);
            });
        });
    }

    // Questions per set, read straight from the bundled data.
    const setQuestionsById = {};
    for (const set of SETS) {
        setQuestionsById[set.id] = set.questions;
    }

    // Active quiz bank: array of raw question objects (with translations
    // preserved) plus {setId, localIdx}. Localization happens at render time
    // via I18N.localizedQuestion.
    let QUESTIONS = [];

    const state = {
        order: [],
        pos: 0,
        answers: [],
        mode: 'seq',
        // optionOrders[qIdx] is a permutation of [0..n-1] used to render that
        // question's options. Only populated in 'rand' mode; empty in 'seq'.
        optionOrders: [],
        view: 'setup', // 'setup' | 'quiz'
        selectedSets: [],
        selectedRoleId: null,
        pendingRoleId: null, // role highlighted in the setup picker
        setupMode: 'roles', // 'roles' | 'custom'
        pendingCustom: [] // set IDs ticked in the custom picker
    };

    const el = {
        subtitle: document.getElementById('subtitle'),
        stats: document.getElementById('stats'),
        setupArea: document.getElementById('setup-area'),
        quizContainer: document.getElementById('quiz-container'),
        setupTitle: document.getElementById('setup-title'),
        setupHelp: document.getElementById('setup-help'),
        roleList: document.getElementById('role-list'),
        setList: document.getElementById('set-list'),
        setupModeToggle: document.getElementById('setup-mode-toggle'),
        setupTotal: document.getElementById('setup-total'),
        startBtn: document.getElementById('start-btn'),
        changeSets: document.getElementById('change-sets'),
        area: document.getElementById('quiz-area'),
        current: document.getElementById('current'),
        total: document.getElementById('total'),
        correct: document.getElementById('correct'),
        wrong: document.getElementById('wrong'),
        pct: document.getElementById('pct'),
        bar: document.getElementById('bar'),
        grid: document.getElementById('grid'),
        modeSeq: document.getElementById('mode-seq'),
        modeRand: document.getElementById('mode-rand'),
        restart: document.getElementById('restart'),
        review: document.getElementById('review'),
        themeToggle: document.getElementById('theme-toggle'),
        resumeBanner: document.getElementById('resume-banner'),
        headerHome: document.getElementById('header-home')
    };

    function shuffle(arr) {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    // A permutation per question of its option indices. Regenerated when the
    // user switches into random mode so each question draws a fresh layout.
    function buildOptionOrders() {
        return QUESTIONS.map((q) => {
            const n = Array.isArray(q.o) ? q.o.length : 0;
            const ids = [];
            for (let i = 0; i < n; i++) ids.push(i);
            return shuffle(ids);
        });
    }

    function esc(s) {
        return String(s).replace(
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

    // ---------- Setup view ----------

    function renderSetup() {
        state.view = 'setup';
        el.setupArea.hidden = false;
        el.quizContainer.hidden = true;
        el.stats.hidden = true;

        renderResumeBanner();

        // Fall back to custom mode when no roles are available but sets are.
        if (!ROLES.length && SETS.length) state.setupMode = 'custom';

        const customMode = state.setupMode === 'custom';
        el.subtitle.textContent = customMode
            ? t('setup.subtitlePromptCustom')
            : t('setup.subtitlePrompt');
        el.setupTitle.textContent = customMode
            ? t('setup.customTitle')
            : t('setup.title');
        el.setupHelp.textContent = customMode
            ? t('setup.customHelp')
            : t('setup.help');
        // Preserve the directional arrow when toggling between modes.
        if (customMode) {
            el.setupModeToggle.innerHTML =
                window.ICONS.get('arrow-left') +
                '<span class="btn-label">' +
                esc(t('setup.rolesToggle')) +
                '</span>';
        } else {
            el.setupModeToggle.innerHTML =
                '<span class="btn-label">' +
                esc(t('setup.customToggle')) +
                '</span>' +
                window.ICONS.get('arrow-right');
        }
        el.setupModeToggle.hidden = !ROLES.length;
        el.roleList.hidden = customMode;
        el.setList.hidden = !customMode;

        if (customMode) renderCustomList();
        else renderRoleList();

        updateSetupSummary();
    }

    function renderRoleList() {
        if (!ROLES.length) {
            el.roleList.innerHTML = `<p class="setup-empty">${esc(t('setup.empty'))}</p>`;
            return;
        }

        // Preselect: in-flight state > persisted role > none.
        if (!state.pendingRoleId) {
            const fromState =
                state.selectedRoleId || roleForSets(state.selectedSets)?.id;
            state.pendingRoleId = fromState || loadSelectedRoleId();
            if (!roleById(state.pendingRoleId)) state.pendingRoleId = null;
        }

        el.roleList.innerHTML = ROLES.map((r) => {
            const total =
                (setQuestionsById[r.commonSetId]?.length || 0) +
                (setQuestionsById[r.specificSetId]?.length || 0);
            const selected = r.id === state.pendingRoleId ? ' selected' : '';
            return `
                <button type="button" class="role-item${selected}" data-role="${esc(r.id)}" aria-pressed="${selected ? 'true' : 'false'}">
                    <span class="role-icon" aria-hidden="true">${r.icon}</span>
                    <span class="role-name">${esc(roleName(r))}</span>
                    <span class="role-desc">${esc(t('setup.roleSummary'))}</span>
                    <span class="role-count">${total} ${esc(t('setup.questionsAbbrev'))}</span>
                </button>
            `;
        }).join('');

        el.roleList.querySelectorAll('.role-item').forEach((btn) => {
            btn.addEventListener('click', () => {
                state.pendingRoleId = btn.dataset.role;
                el.roleList.querySelectorAll('.role-item').forEach((b) => {
                    const active = b.dataset.role === state.pendingRoleId;
                    b.classList.toggle('selected', active);
                    b.setAttribute('aria-pressed', active ? 'true' : 'false');
                });
                updateSetupSummary();
            });
        });
    }

    function renderCustomList() {
        if (!SETS.length) {
            el.setList.innerHTML = `<p class="setup-empty">${esc(t('setup.empty'))}</p>`;
            return;
        }

        // Seed the custom selection from state > persisted > resolved from the
        // active role so that flipping modes feels continuous.
        if (!state.pendingCustom.length) {
            const seed = loadCustomSelection();
            if (seed.length) {
                state.pendingCustom = seed;
            } else {
                const role =
                    roleById(state.pendingRoleId) ||
                    roleById(state.selectedRoleId);
                if (role) state.pendingCustom = roleSets(role);
            }
        }

        el.setList.innerHTML = SETS.map((s) => {
            const count = setQuestionsById[s.id].length;
            const checked = state.pendingCustom.includes(s.id) ? 'checked' : '';
            const loc = I18N.localizedSet(s);
            return `
                <label class="set-item">
                    <input type="checkbox" class="set-check" value="${esc(s.id)}" ${checked}>
                    <div class="set-info">
                        <div class="set-name">${esc(loc.name)}</div>
                        <div class="set-desc">${esc(loc.description || '')}</div>
                    </div>
                    <div class="set-count">${count} ${esc(t('setup.questionsAbbrev'))}</div>
                </label>
            `;
        }).join('');

        el.setList.querySelectorAll('.set-check').forEach((input) => {
            input.addEventListener('change', () => {
                state.pendingCustom = Array.from(
                    el.setList.querySelectorAll('.set-check:checked')
                ).map((i) => i.value);
                updateSetupSummary();
            });
        });
    }

    function updateSetupSummary() {
        if (state.setupMode === 'custom') {
            const ids = state.pendingCustom;
            const total = ids.reduce(
                (acc, id) => acc + (setQuestionsById[id]?.length || 0),
                0
            );
            el.setupTotal.textContent =
                total === 0
                    ? t('setup.noneSelectedCustom')
                    : t('setup.selectedCount', { count: total });
            el.startBtn.disabled = total === 0;
            return;
        }
        const role = roleById(state.pendingRoleId);
        if (!role) {
            el.setupTotal.textContent = t('setup.noneSelected');
            el.startBtn.disabled = true;
            return;
        }
        const total =
            (setQuestionsById[role.commonSetId]?.length || 0) +
            (setQuestionsById[role.specificSetId]?.length || 0);
        el.setupTotal.textContent = t('setup.selectedCount', { count: total });
        el.startBtn.disabled = false;
    }

    function setNamesLabel(ids) {
        const role = roleForSets(ids);
        if (role) return roleName(role);
        return ids
            .map((id) => SETS.find((s) => s.id === id))
            .filter(Boolean)
            .map((s) => I18N.localizedSet(s).name)
            .join(' + ');
    }

    function renderResumeBanner() {
        if (!el.resumeBanner) return;
        const snap = loadProgress();
        if (!snap) {
            el.resumeBanner.hidden = true;
            el.resumeBanner.innerHTML = '';
            return;
        }
        const summary = progressSummary(snap);
        const names = setNamesLabel(snap.selectedSets);
        el.resumeBanner.hidden = false;
        el.resumeBanner.innerHTML = `
            <div class="resume-info">
                <div class="resume-title">${esc(t('setup.resumeTitle'))}</div>
                <div class="resume-meta">${esc(
                    t('setup.resumeMeta', {
                        names: names,
                        answered: summary.answered,
                        total: summary.total
                    })
                )}</div>
            </div>
            <div class="resume-actions">
                <button type="button" class="primary" id="resume-btn"><span class="btn-label">${esc(t('setup.resumeBtn'))}</span>${window.ICONS.get('arrow-right')}</button>
                <button type="button" id="discard-btn">${esc(t('setup.discardBtn'))}</button>
            </div>
        `;
        const resumeBtn = document.getElementById('resume-btn');
        const discardBtn = document.getElementById('discard-btn');
        if (resumeBtn) {
            resumeBtn.addEventListener('click', () => {
                if (!resumeFromSavedProgress()) {
                    // Saved state became invalid since we rendered the banner.
                    renderResumeBanner();
                }
            });
        }
        if (discardBtn) {
            discardBtn.addEventListener('click', async () => {
                const ok = await window.Modal.confirm({
                    message: t('setup.discardConfirm'),
                    confirmLabel: t('setup.discardBtn'),
                    cancelLabel: t('modal.cancel'),
                    danger: true
                });
                if (!ok) return;
                clearProgress();
                renderResumeBanner();
            });
        }
    }

    // ---------- Quiz view ----------

    function buildBank(selectedIds) {
        const bank = [];
        for (const setId of selectedIds) {
            const items = setQuestionsById[setId];
            if (!items) continue;
            for (let i = 0; i < items.length; i++) {
                const it = items[i];
                // Preserve translations (and any other fields) alongside the
                // base q/o/a so they survive through to the render phase.
                bank.push({
                    ...it,
                    o: it.o.slice(),
                    setId,
                    localIdx: i
                });
            }
        }
        return bank;
    }

    function startQuiz(selectedIds) {
        if (!selectedIds.length) return;
        state.selectedSets = selectedIds.slice();
        const inferred = roleForSets(state.selectedSets);
        state.selectedRoleId = inferred ? inferred.id : null;
        saveSelectedRoleId(state.selectedRoleId);

        QUESTIONS = buildBank(state.selectedSets);
        state.order = QUESTIONS.map((_, i) => i);
        if (state.mode === 'rand') state.order = shuffle(state.order);
        state.optionOrders = state.mode === 'rand' ? buildOptionOrders() : [];
        state.answers = new Array(QUESTIONS.length).fill(null);
        state.pos = 0;
        state.view = 'quiz';

        el.setupArea.hidden = true;
        el.quizContainer.hidden = false;
        el.stats.hidden = false;

        updateQuizSubtitle();
        render();
        saveProgress();
    }

    // Restore an in-progress quiz from localStorage, if valid, and switch to
    // the quiz view. Returns true on success.
    function resumeFromSavedProgress() {
        const snap = loadProgress();
        if (!snap) return false;

        state.selectedSets = snap.selectedSets.slice();
        const inferred = roleForSets(state.selectedSets);
        state.selectedRoleId = inferred ? inferred.id : null;
        saveSelectedRoleId(state.selectedRoleId);
        state.mode = snap.mode;
        QUESTIONS = buildBank(state.selectedSets);
        state.order = snap.order.slice();
        // Restore option permutations when the snapshot has them; rebuild on
        // the fly if a previous version saved without them.
        if (
            state.mode === 'rand' &&
            Array.isArray(snap.optionOrders) &&
            snap.optionOrders.length === QUESTIONS.length
        ) {
            state.optionOrders = snap.optionOrders.map((o) =>
                Array.isArray(o) ? o.slice() : null
            );
        } else if (state.mode === 'rand') {
            state.optionOrders = buildOptionOrders();
        } else {
            state.optionOrders = [];
        }
        state.answers = snap.answers.map((a) =>
            a ? { picked: a.picked, correct: !!a.correct } : null
        );
        state.pos = snap.pos;
        state.view = 'quiz';

        el.setupArea.hidden = true;
        el.quizContainer.hidden = false;
        el.stats.hidden = false;
        el.modeSeq.classList.toggle('active', state.mode === 'seq');
        el.modeRand.classList.toggle('active', state.mode === 'rand');

        updateQuizSubtitle();
        render();
        return true;
    }

    function updateQuizSubtitle() {
        if (state.view !== 'quiz') return;
        const role = roleById(state.selectedRoleId);
        const label = role
            ? roleName(role)
            : state.selectedSets
                  .map((id) => SETS.find((s) => s.id === id))
                  .filter(Boolean)
                  .map((s) => I18N.localizedSet(s).name)
                  .join(' + ');
        el.subtitle.textContent = t('quiz.subtitle', {
            names: label,
            count: QUESTIONS.length
        });
        el.changeSets.innerHTML =
            window.ICONS.get('arrow-left') +
            '<span class="btn-label">' +
            esc(t(role ? 'quiz.changeRole' : 'quiz.changeSets')) +
            '</span>';
    }

    function render() {
        if (state.view !== 'quiz') return;
        if (!Array.isArray(state.order) || state.order.length === 0) {
            state.order = QUESTIONS.map((_, i) => i);
        }
        if (state.pos < 0 || state.pos >= state.order.length) state.pos = 0;

        const qIdx = state.order[state.pos];
        const rawQ = QUESTIONS[qIdx];
        const q = rawQ ? I18N.localizedQuestion(rawQ) : null;
        const total = QUESTIONS.length;

        if (el.total) el.total.textContent = total;

        if (!q) {
            el.area.innerHTML = `<div class="card"><p class="q-text">${esc(t('quiz.loadError'))} <button id="reset-now">${esc(t('quiz.resetNow'))}</button></p></div>`;
            const btn = document.getElementById('reset-now');
            if (btn) {
                btn.addEventListener('click', resetCurrentQuiz);
            }
            return;
        }

        const answered = state.answers[qIdx];
        el.current.textContent = state.pos + 1;

        const correct = state.answers.filter((a) => a && a.correct).length;
        const wrong = state.answers.filter((a) => a && !a.correct).length;
        el.correct.textContent = correct;
        el.wrong.textContent = wrong;

        const ans = correct + wrong;
        el.pct.textContent = ans
            ? Math.round((correct / ans) * 100) + '%'
            : '—';
        el.bar.style.width = ((state.pos + 1) / total) * 100 + '%';
        el.review.disabled = wrong === 0;

        // In random mode the set-source label is hidden so the user can't use
        // the section as a hint.
        const setLabel =
            state.mode === 'rand' ? '' : labelForSet(rawQ.setId);

        // Render options in the stored permutation (identity when seq mode).
        // data-i carries the original index so the correctness check and
        // persisted `picked` value remain set-agnostic.
        const optOrder =
            Array.isArray(state.optionOrders[qIdx]) &&
            state.optionOrders[qIdx].length === q.o.length
                ? state.optionOrders[qIdx]
                : q.o.map((_, i) => i);
        const optionsHtml = optOrder
            .map((origIdx, displayPos) => {
                const text = q.o[origIdx];
                let cls = 'opt';
                if (answered) {
                    if (origIdx === q.a) cls += ' correct';
                    else if (origIdx === answered.picked) cls += ' incorrect';
                }
                return `<button class="${cls}" data-i="${origIdx}" ${answered ? 'disabled' : ''}>
                    <span class="letter">${LETTERS[displayPos]}</span>
                    <span>${esc(text)}</span>
                </button>`;
            })
            .join('');

        let feedback = '';
        if (answered) {
            if (answered.correct) {
                feedback = `<div class="feedback ok show">${window.ICONS.get('check')}<span>${esc(t('quiz.correct'))}</span></div>`;
            } else {
                const correctDisplayPos = optOrder.indexOf(q.a);
                feedback = `<div class="feedback ko show">${window.ICONS.get('x')}<span>${esc(t('quiz.wrongPrefix'))} <b>${LETTERS[correctDisplayPos]})</b> ${esc(q.o[q.a])}</span></div>`;
            }
        }

        const qNumText = t('quiz.questionNum', {
            pos: state.pos + 1,
            total: total
        });

        el.area.innerHTML = `
            <div class="card">
                <div class="q-num">${esc(qNumText)}${setLabel ? ` · <span class="set-tag">${esc(setLabel)}</span>` : ''}</div>
                <p class="q-text">${esc(q.q)}</p>
                <div class="options">${optionsHtml}</div>
                ${feedback}
                <div class="nav">
                    <button id="prev" ${state.pos === 0 ? 'disabled' : ''}>${window.ICONS.get('arrow-left')}<span class="btn-label">${esc(t('quiz.prev'))}</span></button>
                    <button id="next" class="primary" ${state.pos === total - 1 ? 'disabled' : ''}><span class="btn-label">${esc(t('quiz.next'))}</span>${window.ICONS.get('arrow-right')}</button>
                </div>
                <div id="report-host" class="report-host"></div>
            </div>
        `;

        if (window.QuizzyReport && window.QuizzyReport.enabled()) {
            const host = document.getElementById('report-host');
            if (host) {
                window.QuizzyReport.mount(host, {
                    setId: rawQ.setId,
                    questionIdx: rawQ.localIdx,
                    questionText: q.q,
                    currentAnswer: q.a,
                    options: q.o.slice()
                });
            }
        }


        el.area.querySelectorAll('.opt').forEach((btn) => {
            btn.addEventListener('click', () => {
                if (state.answers[qIdx]) return;
                const picked = parseInt(btn.dataset.i, 10);
                state.answers[qIdx] = { picked, correct: picked === q.a };
                saveProgress();
                render();
                renderGrid();
            });
        });

        const prev = document.getElementById('prev');
        const next = document.getElementById('next');
        if (prev) {
            prev.addEventListener('click', () => {
                state.pos = Math.max(0, state.pos - 1);
                saveProgress();
                render();
            });
        }
        if (next) {
            next.addEventListener('click', () => {
                state.pos = Math.min(total - 1, state.pos + 1);
                saveProgress();
                render();
            });
        }

        renderGrid();
    }

    function labelForSet(setId) {
        if (state.selectedSets.length <= 1) return '';
        const s = SETS.find((x) => x.id === setId);
        return s ? I18N.localizedSet(s).name : '';
    }

    function renderGrid() {
        el.grid.innerHTML = state.order
            .map((qIdx, i) => {
                const a = state.answers[qIdx];
                let cls = '';
                if (a) cls = a.correct ? 'done-ok' : 'done-ko';
                if (i === state.pos) cls += ' current';
                return `<button class="${cls}" data-pos="${i}">${qIdx + 1}</button>`;
            })
            .join('');
        el.grid.querySelectorAll('button').forEach((b) => {
            b.addEventListener('click', () => {
                state.pos = parseInt(b.dataset.pos, 10);
                saveProgress();
                render();
            });
        });
    }

    async function setMode(m) {
        if (m === state.mode) return;
        // Flipping the order mid-quiz reshuffles questions (and options in
        // random mode) so any already-answered positions become misleading.
        // Warn and clear the answer slate when the user has committed answers.
        const hasAnswers =
            state.view === 'quiz' &&
            state.answers.some((a) => a !== null);
        if (hasAnswers) {
            const ok = await window.Modal.confirm({
                message: t('mode.changeConfirm'),
                confirmLabel: t('mode.changeBtn'),
                cancelLabel: t('modal.cancel'),
                danger: true
            });
            if (!ok) {
                // Revert: leave mode unchanged and keep the active-button
                // indicator in sync with the real state.
                el.modeSeq.classList.toggle('active', state.mode === 'seq');
                el.modeRand.classList.toggle('active', state.mode === 'rand');
                return;
            }
        }
        state.mode = m;
        el.modeSeq.classList.toggle('active', m === 'seq');
        el.modeRand.classList.toggle('active', m === 'rand');
        if (state.view !== 'quiz') return;
        state.order =
            m === 'rand'
                ? shuffle(QUESTIONS.map((_, i) => i))
                : QUESTIONS.map((_, i) => i);
        state.optionOrders = m === 'rand' ? buildOptionOrders() : [];
        if (hasAnswers) {
            state.answers = new Array(QUESTIONS.length).fill(null);
        }
        state.pos = 0;
        saveProgress();
        render();
    }

    function resetCurrentQuiz() {
        startQuiz(state.selectedSets);
    }

    // ---------- Wiring ----------

    el.modeSeq.addEventListener('click', () => setMode('seq'));
    el.modeRand.addEventListener('click', () => setMode('rand'));

    el.startBtn.addEventListener('click', () => {
        if (state.setupMode === 'custom') {
            if (!state.pendingCustom.length) return;
            saveCustomSelection(state.pendingCustom);
            saveSetupMode('custom');
            startQuiz(state.pendingCustom);
            return;
        }
        const role = roleById(state.pendingRoleId);
        if (!role) return;
        saveSetupMode('roles');
        startQuiz(roleSets(role));
    });

    if (el.setupModeToggle) {
        el.setupModeToggle.addEventListener('click', () => {
            state.setupMode =
                state.setupMode === 'custom' ? 'roles' : 'custom';
            renderSetup();
        });
    }

    el.changeSets.addEventListener('click', () => {
        state.pendingRoleId = state.selectedRoleId;
        state.pendingCustom = state.selectedSets.slice();
        // Return to whichever picker started the current quiz.
        state.setupMode = state.selectedRoleId ? 'roles' : 'custom';
        renderSetup();
    });

    if (el.headerHome) {
        el.headerHome.addEventListener('click', () => {
            if (state.view !== 'setup') renderSetup();
        });
    }

    el.restart.addEventListener('click', async () => {
        const ok = await window.Modal.confirm({
            message: t('restart.confirm'),
            confirmLabel: t('quiz.resetNow'),
            cancelLabel: t('modal.cancel'),
            danger: true
        });
        if (!ok) return;
        resetCurrentQuiz();
    });

    el.review.addEventListener('click', () => {
        const wrongs = state.order.filter(
            (qIdx) => state.answers[qIdx] && !state.answers[qIdx].correct
        );
        if (!wrongs.length) return;
        state.order = wrongs;
        state.answers = state.answers.map((a, i) =>
            wrongs.includes(i) ? null : a
        );
        state.pos = 0;
        saveProgress();
        render();
    });

    if (el.themeToggle) {
        el.themeToggle.addEventListener('click', () => {
            setTheme(currentTheme() === 'dark' ? 'light' : 'dark', true);
        });
    }

    if (window.matchMedia) {
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        const onChange = (e) => {
            let stored = null;
            try {
                stored = localStorage.getItem(THEME_KEY);
            } catch {
                /* ignore */
            }
            if (stored !== 'light' && stored !== 'dark') {
                setTheme(e.matches ? 'dark' : 'light', false);
            }
        };
        if (mq.addEventListener) mq.addEventListener('change', onChange);
        else if (mq.addListener) mq.addListener(onChange);
    }

    // ---------- Language wiring ----------

    // Apply translations to all static markup on initial load.
    I18N.applyStaticTranslations();
    renderLangToggle();
    updateThemeButton();

    // Re-render everything that carries localized text when the user switches
    // languages mid-session.
    I18N.onChange(() => {
        I18N.applyStaticTranslations();
        renderLangToggle();
        updateThemeButton();
        if (state.view === 'setup') {
            renderSetup();
        } else {
            updateQuizSubtitle();
            render();
        }
    });

    // Initial render: if there's a valid in-progress quiz in localStorage,
    // resume it straight away. Otherwise show the setup screen.
    if (!resumeFromSavedProgress()) {
        state.pendingRoleId = loadSelectedRoleId();
        state.pendingCustom = loadCustomSelection();
        state.setupMode = loadSetupMode();
        renderSetup();
    }
})();
