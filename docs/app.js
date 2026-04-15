(function () {
    'use strict';

    const SETS = (window.QUESTION_SETS || []).slice();
    const LETTERS = ['a', 'b', 'c', 'd'];
    const SELECTION_KEY = 'quizzy_selected_sets_v1';
    const SET_STORAGE_PREFIX = 'quizzy_set_';
    const SET_STORAGE_VERSION = 'v1';
    const THEME_KEY = 'celador_theme';

    function setStorageKey(setId) {
        return SET_STORAGE_PREFIX + setId + '_' + SET_STORAGE_VERSION;
    }

    function isValidQuestion(x) {
        return (
            x &&
            typeof x.q === 'string' &&
            Array.isArray(x.o) &&
            x.o.length === 4 &&
            Number.isInteger(x.a)
        );
    }

    function loadSetQuestions(set) {
        try {
            const raw = localStorage.getItem(setStorageKey(set.id));
            if (raw) {
                const parsed = JSON.parse(raw);
                if (
                    Array.isArray(parsed) &&
                    parsed.length === set.questions.length &&
                    parsed.every(isValidQuestion)
                ) {
                    return parsed;
                }
            }
        } catch {
            /* fall back to defaults */
        }
        return JSON.parse(JSON.stringify(set.questions));
    }

    function saveSetQuestions(setId, questions) {
        try {
            localStorage.setItem(
                setStorageKey(setId),
                JSON.stringify(questions)
            );
        } catch (e) {
            alert('No se pudo guardar: ' + e.message);
        }
    }

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
        btn.title = isDark ? 'Tema claro' : 'Tema oscuro';
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

    // Current loaded data per set (kept in sync with localStorage).
    const setQuestionsById = {};
    for (const set of SETS) {
        setQuestionsById[set.id] = loadSetQuestions(set);
    }

    // Active quiz bank: array of { q, o, a, setId, localIdx }.
    let QUESTIONS = [];

    const state = {
        order: [],
        pos: 0,
        answers: [],
        mode: 'seq',
        editing: false,
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
        themeToggle: document.getElementById('theme-toggle')
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
        el.subtitle.textContent =
            'Elige los conjuntos de preguntas para empezar';

        if (!SETS.length) {
            el.setList.innerHTML =
                '<p class="setup-empty">No se han encontrado conjuntos de preguntas.</p>';
            el.startBtn.disabled = true;
            el.setupTotal.textContent = '0 preguntas seleccionadas';
            return;
        }

        const previous = state.selectedSets.length
            ? state.selectedSets
            : loadSelection();

        el.setList.innerHTML = SETS.map((s) => {
            const count = setQuestionsById[s.id].length;
            const checked = previous.includes(s.id) ? 'checked' : '';
            return `
                    <label class="set-item">
                        <input type="checkbox" class="set-check" value="${esc(s.id)}" ${checked}>
                        <div class="set-info">
                            <div class="set-name">${esc(s.name)}</div>
                            <div class="set-desc">${esc(s.description || '')}</div>
                        </div>
                        <div class="set-count">${count} pregs.</div>
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
                ? 'Selecciona al menos un conjunto'
                : `${total} preguntas seleccionadas`;
        el.startBtn.disabled = total === 0;
    }

    // ---------- Quiz view ----------

    function buildBank(selectedIds) {
        const bank = [];
        for (const setId of selectedIds) {
            const items = setQuestionsById[setId];
            if (!items) continue;
            for (let i = 0; i < items.length; i++) {
                const it = items[i];
                bank.push({
                    q: it.q,
                    o: it.o.slice(),
                    a: it.a,
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
        state.editing = false;
        state.view = 'quiz';

        el.setupArea.hidden = true;
        el.quizContainer.hidden = false;
        el.stats.hidden = false;

        const names = state.selectedSets
            .map((id) => SETS.find((s) => s.id === id))
            .filter(Boolean)
            .map((s) => s.name);
        el.subtitle.textContent =
            names.join(' + ') + ' · ' + QUESTIONS.length + ' preguntas';

        render();
    }

    function render() {
        if (state.view !== 'quiz') return;
        if (!Array.isArray(state.order) || state.order.length === 0) {
            state.order = QUESTIONS.map((_, i) => i);
        }
        if (state.pos < 0 || state.pos >= state.order.length) state.pos = 0;

        const qIdx = state.order[state.pos];
        const q = QUESTIONS[qIdx];
        const total = QUESTIONS.length;

        if (el.total) el.total.textContent = total;

        if (!q) {
            el.area.innerHTML =
                '<div class="card"><p class="q-text">Error al cargar la pregunta. <button id="reset-now">Reiniciar</button></p></div>';
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

        if (state.editing) {
            renderEditor(qIdx, q, total);
            return;
        }

        const setLabel = labelForSet(q.setId);
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
                feedback = '<div class="feedback ok show">✓ Correcto</div>';
            } else {
                feedback = `<div class="feedback ko show">✗ Incorrecto. Respuesta correcta: <b>${LETTERS[q.a]})</b> ${esc(q.o[q.a])}</div>`;
            }
        }

        el.area.innerHTML = `
            <div class="card">
                <div class="q-head">
                    <div class="q-num">Pregunta ${state.pos + 1} de ${total}${setLabel ? ` · <span class="set-tag">${esc(setLabel)}</span>` : ''}</div>
                    <button id="edit-btn" class="edit-btn" title="Editar pregunta">✏️ Editar</button>
                </div>
                <p class="q-text">${esc(q.q)}</p>
                <div class="options">${optionsHtml}</div>
                ${feedback}
                <div class="nav">
                    <button id="prev" ${state.pos === 0 ? 'disabled' : ''}>← Anterior</button>
                    <button id="next" class="primary" ${state.pos === total - 1 ? 'disabled' : ''}>Siguiente →</button>
                </div>
            </div>
        `;

        document.getElementById('edit-btn').addEventListener('click', () => {
            state.editing = true;
            render();
        });

        el.area.querySelectorAll('.opt').forEach((btn) => {
            btn.addEventListener('click', () => {
                if (state.answers[qIdx]) return;
                const picked = parseInt(btn.dataset.i, 10);
                state.answers[qIdx] = { picked, correct: picked === q.a };
                render();
                renderGrid();
            });
        });

        const prev = document.getElementById('prev');
        const next = document.getElementById('next');
        if (prev) {
            prev.addEventListener('click', () => {
                state.pos = Math.max(0, state.pos - 1);
                render();
            });
        }
        if (next) {
            next.addEventListener('click', () => {
                state.pos = Math.min(total - 1, state.pos + 1);
                render();
            });
        }

        renderGrid();
    }

    function labelForSet(setId) {
        if (state.selectedSets.length <= 1) return '';
        const s = SETS.find((x) => x.id === setId);
        return s ? s.name : '';
    }

    function renderEditor(qIdx, q, total) {
        el.area.innerHTML = `
            <div class="card">
                <div class="q-num">Editando pregunta ${state.pos + 1} de ${total}</div>
                <label class="edit-label">Enunciado</label>
                <textarea id="edit-q" class="edit-input" rows="3">${esc(q.q)}</textarea>
                <label class="edit-label">Opciones (marca la correcta)</label>
                ${q.o
                    .map(
                        (text, i) => `
                    <div class="edit-opt-row">
                        <input type="radio" name="edit-correct" id="edit-c-${i}" value="${i}" ${i === q.a ? 'checked' : ''}>
                        <label for="edit-c-${i}" class="letter">${LETTERS[i]}</label>
                        <textarea class="edit-input edit-opt" data-i="${i}" rows="2">${esc(text)}</textarea>
                    </div>`
                    )
                    .join('')}
                <div class="nav">
                    <button id="edit-cancel">Cancelar</button>
                    <button id="edit-save" class="primary">Guardar</button>
                </div>
            </div>
        `;

        document.getElementById('edit-cancel').addEventListener('click', () => {
            state.editing = false;
            render();
        });

        document.getElementById('edit-save').addEventListener('click', () => {
            const newQ = document.getElementById('edit-q').value.trim();
            const newOpts = Array.from(
                document.querySelectorAll('.edit-opt')
            ).map((t) => t.value.trim());
            const checked = document.querySelector(
                'input[name="edit-correct"]:checked'
            );
            const newA = checked ? parseInt(checked.value, 10) : q.a;
            if (!newQ || newOpts.some((o) => !o)) {
                alert('El enunciado y las 4 opciones no pueden estar vacíos.');
                return;
            }
            const updated = { q: newQ, o: newOpts, a: newA };
            // Persist the edit in the owning set.
            const { setId, localIdx } = QUESTIONS[qIdx];
            setQuestionsById[setId][localIdx] = updated;
            saveSetQuestions(setId, setQuestionsById[setId]);
            // Refresh the active bank entry.
            QUESTIONS[qIdx] = {
                q: newQ,
                o: newOpts.slice(),
                a: newA,
                setId,
                localIdx
            };
            state.answers[qIdx] = null;
            state.editing = false;
            render();
        });
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
        render();
    }

    function resetCurrentQuiz() {
        // Wipe edits for the selected sets and rebuild from defaults.
        for (const setId of state.selectedSets) {
            try {
                localStorage.removeItem(setStorageKey(setId));
            } catch {
                /* ignore */
            }
            const set = SETS.find((s) => s.id === setId);
            if (set) {
                setQuestionsById[setId] = JSON.parse(
                    JSON.stringify(set.questions)
                );
            }
        }
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
        const ok = confirm(
            '¿Reiniciar el test?\n\nEsto borrará tus respuestas Y restablecerá las preguntas y respuestas al conjunto inicial (se perderán tus ediciones en los conjuntos seleccionados).'
        );
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
        render();
    });

    updateThemeButton();
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

    // Initial render: always show the setup screen (pre-checking last selection).
    state.selectedSets = loadSelection();
    renderSetup();
})();
