(function () {
    'use strict';

    const INITIAL_QUESTIONS = window.INITIAL_QUESTIONS || [];
    const STORAGE_KEY = 'celador_questions_v2';
    const LETTERS = ['a', 'b', 'c', 'd'];

    function loadQuestions() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return JSON.parse(JSON.stringify(INITIAL_QUESTIONS));
            const parsed = JSON.parse(raw);
            if (
                Array.isArray(parsed) &&
                parsed.length &&
                parsed.every(
                    (x) =>
                        x &&
                        typeof x.q === 'string' &&
                        Array.isArray(x.o) &&
                        x.o.length === 4 &&
                        Number.isInteger(x.a)
                )
            ) {
                return parsed;
            }
        } catch {
            /* fall back to defaults */
        }
        return JSON.parse(JSON.stringify(INITIAL_QUESTIONS));
    }

    function saveQuestions() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(QUESTIONS));
        } catch (e) {
            alert('No se pudo guardar: ' + e.message);
        }
    }

    let QUESTIONS = loadQuestions();

    const state = {
        order: QUESTIONS.map((_, i) => i),
        pos: 0,
        answers: new Array(QUESTIONS.length).fill(null),
        mode: 'seq',
        editing: false
    };

    const el = {
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
        review: document.getElementById('review')
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
        return String(s).replace(/[&<>"']/g, (c) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[c]));
    }

    function render() {
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
                btn.addEventListener('click', () => {
                    state.order = QUESTIONS.map((_, i) => i);
                    state.answers = new Array(QUESTIONS.length).fill(null);
                    state.pos = 0;
                    render();
                });
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
        el.pct.textContent = ans ? Math.round((correct / ans) * 100) + '%' : '—';
        el.bar.style.width = ((state.pos + 1) / total) * 100 + '%';
        el.review.disabled = wrong === 0;

        if (state.editing) {
            renderEditor(qIdx, q, total);
            return;
        }

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
                    <div class="q-num">Pregunta ${qIdx + 1} de ${total}</div>
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

    function renderEditor(qIdx, q, total) {
        el.area.innerHTML = `
            <div class="card">
                <div class="q-num">Editando pregunta ${qIdx + 1} de ${total}</div>
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
            const checked = document.querySelector('input[name="edit-correct"]:checked');
            const newA = checked ? parseInt(checked.value, 10) : q.a;
            if (!newQ || newOpts.some((o) => !o)) {
                alert('El enunciado y las 4 opciones no pueden estar vacíos.');
                return;
            }
            QUESTIONS[qIdx] = { q: newQ, o: newOpts, a: newA };
            saveQuestions();
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
        state.order =
            m === 'rand'
                ? shuffle(QUESTIONS.map((_, i) => i))
                : QUESTIONS.map((_, i) => i);
        state.pos = 0;
        render();
    }

    el.modeSeq.addEventListener('click', () => setMode('seq'));
    el.modeRand.addEventListener('click', () => setMode('rand'));

    el.restart.addEventListener('click', () => {
        const ok = confirm(
            '¿Reiniciar el test?\n\nEsto borrará tus respuestas Y restablecerá las preguntas y respuestas al conjunto inicial (se perderán tus ediciones).'
        );
        if (!ok) return;
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch {
            /* ignore */
        }
        QUESTIONS = JSON.parse(JSON.stringify(INITIAL_QUESTIONS));
        state.answers = new Array(QUESTIONS.length).fill(null);
        state.order = QUESTIONS.map((_, i) => i);
        state.pos = 0;
        state.editing = false;
        render();
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

    render();
})();
