(function () {
    'use strict';

    const I18N = window.I18N;
    const t = (k, p) => I18N.t(k, p);

    const SETS = (window.QUESTION_SETS || []).slice();
    const LETTERS = ['a', 'b', 'c', 'd'];
    const SELECTION_KEY = 'quizzy_selected_sets_v1';
    const THEME_KEY = 'celador_theme';
    const PROGRESS_KEY = 'quizzy_progress_v1';

    function loadSelection() {
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

    function saveSelection(ids) {
        try {
            localStorage.setItem(SELECTION_KEY, JSON.stringify(ids));
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
        btn.textContent = isDark ? '☀️' : '🌙';
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
            .map(
                (l) =>
                    `<button type="button" class="lang-btn${
                        l.code === current ? ' active' : ''
                    }" data-lang="${l.code}" title="${esc(l.label)}" aria-label="${esc(l.label)}">${esc(l.short)}</button>`
            )
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
        view: 'setup', // 'setup' | 'quiz'
        selectedSets: []
    };

    const el = {
        subtitle: document.getElementById('subtitle'),
        stats: document.getElementById('stats'),
        setupArea: document.getElementById('setup-area'),
        quizContainer: document.getElementById('quiz-container'),
        setList: document.getElementById('set-list'),
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
        resumeBanner: document.getElementById('resume-banner')
    };

    function shuffle(arr) {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
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
        el.subtitle.textContent = t('setup.subtitlePrompt');

        renderResumeBanner();

        if (!SETS.length) {
            el.setList.innerHTML = `<p class="setup-empty">${esc(t('setup.empty'))}</p>`;
            el.startBtn.disabled = true;
            el.setupTotal.textContent = t('setup.zeroSelected');
            return;
        }

        const previous = state.selectedSets.length
            ? state.selectedSets
            : loadSelection();

        el.setList.innerHTML = SETS.map((s) => {
            const count = setQuestionsById[s.id].length;
            const checked = previous.includes(s.id) ? 'checked' : '';
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
            input.addEventListener('change', updateSetupSummary);
        });

        updateSetupSummary();
    }

    function getCheckedSetIds() {
        return Array.from(
            el.setList.querySelectorAll('.set-check:checked')
        ).map((i) => i.value);
    }

    function updateSetupSummary() {
        const ids = getCheckedSetIds();
        const total = ids.reduce(
            (acc, id) => acc + (setQuestionsById[id]?.length || 0),
            0
        );
        el.setupTotal.textContent =
            total === 0
                ? t('setup.noneSelected')
                : t('setup.selectedCount', { count: total });
        el.startBtn.disabled = total === 0;
    }

    function setNamesLabel(ids) {
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
                <button type="button" class="primary" id="resume-btn">${esc(t('setup.resumeBtn'))}</button>
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
            discardBtn.addEventListener('click', () => {
                if (!confirm(t('setup.discardConfirm'))) return;
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
        saveSelection(state.selectedSets);

        QUESTIONS = buildBank(state.selectedSets);
        state.order = QUESTIONS.map((_, i) => i);
        if (state.mode === 'rand') state.order = shuffle(state.order);
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
        saveSelection(state.selectedSets);
        state.mode = snap.mode;
        QUESTIONS = buildBank(state.selectedSets);
        state.order = snap.order.slice();
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
        const names = state.selectedSets
            .map((id) => SETS.find((s) => s.id === id))
            .filter(Boolean)
            .map((s) => I18N.localizedSet(s).name);
        el.subtitle.textContent = t('quiz.subtitle', {
            names: names.join(' + '),
            count: QUESTIONS.length
        });
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

        const setLabel = labelForSet(rawQ.setId);
        const optionsHtml = q.o
            .map((text, i) => {
                let cls = 'opt';
                if (answered) {
                    if (i === q.a) cls += ' correct';
                    else if (i === answered.picked) cls += ' incorrect';
                }
                return `<button class="${cls}" data-i="${i}" ${answered ? 'disabled' : ''}>
                    <span class="letter">${LETTERS[i]}</span>
                    <span>${esc(text)}</span>
                </button>`;
            })
            .join('');

        let feedback = '';
        if (answered) {
            if (answered.correct) {
                feedback = `<div class="feedback ok show">${esc(t('quiz.correct'))}</div>`;
            } else {
                feedback = `<div class="feedback ko show">${esc(t('quiz.wrongPrefix'))} <b>${LETTERS[q.a]})</b> ${esc(q.o[q.a])}</div>`;
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
                    <button id="prev" ${state.pos === 0 ? 'disabled' : ''}>${esc(t('quiz.prev'))}</button>
                    <button id="next" class="primary" ${state.pos === total - 1 ? 'disabled' : ''}>${esc(t('quiz.next'))}</button>
                </div>
            </div>
        `;

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

    function setMode(m) {
        state.mode = m;
        el.modeSeq.classList.toggle('active', m === 'seq');
        el.modeRand.classList.toggle('active', m === 'rand');
        if (state.view !== 'quiz') return;
        state.order =
            m === 'rand'
                ? shuffle(QUESTIONS.map((_, i) => i))
                : QUESTIONS.map((_, i) => i);
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
        const ids = getCheckedSetIds();
        if (!ids.length) return;
        startQuiz(ids);
    });

    el.changeSets.addEventListener('click', () => {
        renderSetup();
    });

    el.restart.addEventListener('click', () => {
        const ok = confirm(t('restart.confirm'));
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
        state.selectedSets = loadSelection();
        renderSetup();
    }
})();
