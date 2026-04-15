// Lightweight i18n layer for Quizzy Online.
// Exposes window.I18N with helpers to translate UI strings and to resolve
// multilanguage fields on question sets and questions.
//
// Question data format (backward-compatible):
//   { q: "...", o: [a,b,c,d], a: 0 }                  // single-language
//   { q: "...", o: [...], a: 0,
//     translations: { eu: { q: "...", o: [...] } } }  // with translations
//
// The `a` (answer index) field is ALWAYS shared across languages.
(function () {
    'use strict';

    const STORAGE_KEY = 'quizzy_lang_v1';
    const DEFAULT_LANG = 'es';

    const LANGS = [
        { code: 'es', label: 'Español', short: 'ES' },
        { code: 'eu', label: 'Euskera', short: 'EU' }
    ];

    const TRANSLATIONS = {
        es: {
            title: 'Quizzy Online — OPE Osakidetza',
            'header.title': 'Quizzy — OPE Osakidetza',
            'header.subtitle': 'Test de práctica',
            'stats.question': 'Pregunta',
            'stats.correct': 'Aciertos',
            'stats.wrong': 'Fallos',
            'stats.percent': '% acierto',
            'theme.toggle': 'Cambiar tema',
            'theme.light': 'Tema claro',
            'theme.dark': 'Tema oscuro',
            'lang.label': 'Idioma',
            'setup.title': 'Elige los conjuntos de preguntas',
            'setup.help':
                'Puedes seleccionar uno o varios. Al marcar varios, las preguntas se combinan en un solo test.',
            'setup.empty': 'No se han encontrado conjuntos de preguntas.',
            'setup.noneSelected': 'Selecciona al menos un conjunto',
            'setup.selectedCount': '{count} preguntas seleccionadas',
            'setup.zeroSelected': '0 preguntas seleccionadas',
            'setup.questionsAbbrev': 'pregs.',
            'setup.start': 'Empezar →',
            'setup.subtitlePrompt':
                'Elige los conjuntos de preguntas para empezar',
            'quiz.modeSeq': 'Orden',
            'quiz.modeRand': 'Aleatorio',
            'quiz.changeSets': '← Cambiar conjuntos',
            'quiz.restart': '↻ Reiniciar',
            'quiz.review': 'Ver fallos',
            'quiz.jumpTo': 'Ir a pregunta…',
            'quiz.loadError': 'Error al cargar la pregunta.',
            'quiz.resetNow': 'Reiniciar',
            'quiz.correct': '✓ Correcto',
            'quiz.wrongPrefix': '✗ Incorrecto. Respuesta correcta:',
            'quiz.questionNum': 'Pregunta {pos} de {total}',
            'quiz.prev': '← Anterior',
            'quiz.next': 'Siguiente →',
            'quiz.subtitle': '{names} · {count} preguntas',
            'restart.confirm':
                '¿Reiniciar el test?\n\nEsto borrará tus respuestas.'
        },
        eu: {
            title: 'Quizzy Online — OPE Osakidetza',
            'header.title': 'Quizzy — OPE Osakidetza',
            'header.subtitle': 'Praktika testa',
            'stats.question': 'Galdera',
            'stats.correct': 'Asmatuak',
            'stats.wrong': 'Hutsak',
            'stats.percent': '% asmatze',
            'theme.toggle': 'Gaia aldatu',
            'theme.light': 'Gai argia',
            'theme.dark': 'Gai iluna',
            'lang.label': 'Hizkuntza',
            'setup.title': 'Aukeratu galdera multzoak',
            'setup.help':
                'Bat edo gehiago aukera ditzakezu. Hainbat markatzean, galderak test bakarrean bateratzen dira.',
            'setup.empty': 'Ez da galdera multzorik aurkitu.',
            'setup.noneSelected': 'Aukeratu gutxienez multzo bat',
            'setup.selectedCount': '{count} galdera aukeratuta',
            'setup.zeroSelected': '0 galdera aukeratuta',
            'setup.questionsAbbrev': 'gald.',
            'setup.start': 'Hasi →',
            'setup.subtitlePrompt': 'Aukeratu galdera multzoak hasteko',
            'quiz.modeSeq': 'Ordena',
            'quiz.modeRand': 'Ausazkoa',
            'quiz.changeSets': '← Multzoak aldatu',
            'quiz.restart': '↻ Berrabiarazi',
            'quiz.review': 'Hutsak ikusi',
            'quiz.jumpTo': 'Galderara joan…',
            'quiz.loadError': 'Errorea galdera kargatzean.',
            'quiz.resetNow': 'Berrabiarazi',
            'quiz.correct': '✓ Zuzena',
            'quiz.wrongPrefix': '✗ Okerra. Erantzun zuzena:',
            'quiz.questionNum': '{total}-(e)tik {pos}. galdera',
            'quiz.prev': '← Aurrekoa',
            'quiz.next': 'Hurrengoa →',
            'quiz.subtitle': '{names} · {count} galdera',
            'restart.confirm':
                'Testa berrabiarazi?\n\nHonek zure erantzunak ezabatuko ditu.'
        }
    };

    function detectInitialLang() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored && TRANSLATIONS[stored]) return stored;
        } catch {
            /* ignore */
        }
        const nav = (
            navigator.language ||
            navigator.userLanguage ||
            ''
        ).toLowerCase();
        if (nav.startsWith('eu')) return 'eu';
        if (nav.startsWith('es')) return 'es';
        return DEFAULT_LANG;
    }

    let currentLang = detectInitialLang();
    const listeners = [];

    function format(template, params) {
        if (!params) return template;
        return template.replace(/\{(\w+)\}/g, (_, k) =>
            Object.prototype.hasOwnProperty.call(params, k)
                ? String(params[k])
                : '{' + k + '}'
        );
    }

    function t(key, params) {
        const table =
            TRANSLATIONS[currentLang] || TRANSLATIONS[DEFAULT_LANG] || {};
        const fallback = TRANSLATIONS[DEFAULT_LANG] || {};
        const value =
            table[key] !== undefined
                ? table[key]
                : fallback[key] !== undefined
                  ? fallback[key]
                  : key;
        return format(value, params);
    }

    function getLang() {
        return currentLang;
    }

    function availableLangs() {
        return LANGS.slice();
    }

    function setLang(lang) {
        if (!TRANSLATIONS[lang] || lang === currentLang) return;
        currentLang = lang;
        try {
            localStorage.setItem(STORAGE_KEY, lang);
        } catch {
            /* ignore */
        }
        document.documentElement.setAttribute('lang', lang);
        for (const cb of listeners) {
            try {
                cb(lang);
            } catch {
                /* ignore listener errors */
            }
        }
    }

    function onChange(cb) {
        if (typeof cb === 'function') listeners.push(cb);
    }

    // ---- Localized data resolution (questions & sets) ----

    // Returns a normalized {q, o, a} for the current language.
    // Falls back to the base fields when a translation is absent.
    function localizedQuestion(q) {
        if (!q) return q;
        const base = { q: q.q, o: Array.isArray(q.o) ? q.o : [], a: q.a };
        const tr = q.translations && q.translations[currentLang];
        if (!tr) return base;
        const localizedText =
            typeof tr.q === 'string' && tr.q.length ? tr.q : base.q;
        const localizedOpts =
            Array.isArray(tr.o) && tr.o.length === base.o.length
                ? tr.o.map((opt, i) =>
                      typeof opt === 'string' && opt.length ? opt : base.o[i]
                  )
                : base.o;
        return { q: localizedText, o: localizedOpts, a: base.a };
    }

    // Returns {name, description} for a set in the current language.
    function localizedSet(set) {
        if (!set) return set;
        const base = { name: set.name, description: set.description || '' };
        const tr = set.translations && set.translations[currentLang];
        if (!tr) return base;
        return {
            name:
                typeof tr.name === 'string' && tr.name.length
                    ? tr.name
                    : base.name,
            description:
                typeof tr.description === 'string' && tr.description.length
                    ? tr.description
                    : base.description
        };
    }

    // Applies translations to any element with data-i18n / data-i18n-attr.
    function applyStaticTranslations(root) {
        const scope = root || document;
        scope.querySelectorAll('[data-i18n]').forEach((el) => {
            const key = el.getAttribute('data-i18n');
            if (!key) return;
            const html = el.getAttribute('data-i18n-html') !== null;
            if (html) el.innerHTML = t(key);
            else el.textContent = t(key);
        });
        scope.querySelectorAll('[data-i18n-attr]').forEach((el) => {
            const spec = el.getAttribute('data-i18n-attr');
            if (!spec) return;
            // Format: "attr:key,attr2:key2"
            spec.split(',').forEach((pair) => {
                const [attr, key] = pair.split(':').map((s) => s.trim());
                if (attr && key) el.setAttribute(attr, t(key));
            });
        });
        const titleEl = document.querySelector('title[data-i18n]');
        if (titleEl) document.title = titleEl.textContent;
    }

    // Set initial <html lang="..."> to match detected language.
    document.documentElement.setAttribute('lang', currentLang);

    window.I18N = {
        t,
        getLang,
        setLang,
        onChange,
        availableLangs,
        localizedQuestion,
        localizedSet,
        applyStaticTranslations
    };
})();
