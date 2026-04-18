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
            title: 'OPE Osakidetza',
            'header.title': 'OPE Osakidetza',
            'header.subtitle': 'Test de práctica',
            'header.home': 'Volver al inicio',
            'stats.question': 'Pregunta',
            'stats.correct': 'Aciertos',
            'stats.wrong': 'Fallos',
            'stats.percent': '% acierto',
            'theme.toggle': 'Cambiar tema',
            'theme.light': 'Tema claro',
            'theme.dark': 'Tema oscuro',
            'lang.label': 'Idioma',
            'setup.title': 'Elige tu puesto',
            'setup.help':
                'Selecciona el puesto al que te presentas. El test combinará el temario común con la parte específica.',
            'setup.empty': 'No se han encontrado puestos disponibles.',
            'setup.noneSelected': 'Selecciona un puesto',
            'setup.selectedCount': '{count} preguntas seleccionadas',
            'setup.zeroSelected': 'Selecciona un puesto',
            'setup.questionsAbbrev': 'pregs.',
            'setup.start': 'Empezar',
            'setup.subtitlePrompt': 'Elige tu puesto para empezar',
            'setup.subtitlePromptCustom':
                'Elige los conjuntos de preguntas para empezar',
            'setup.roleSummary': 'Común + específico',
            'setup.customToggle': 'Elegir conjuntos manualmente',
            'setup.rolesToggle': 'Volver a elegir puesto',
            'setup.customTitle': 'Elige los conjuntos de preguntas',
            'setup.customHelp':
                'Selecciona uno o varios conjuntos. Al marcar varios, las preguntas se combinan en un solo test.',
            'setup.noneSelectedCustom': 'Selecciona al menos un conjunto',
            'quiz.modeSeq': 'Orden',
            'quiz.seqTooltip':
                'Preguntas y respuestas en su orden original, mostrando el conjunto de cada pregunta.',
            'quiz.modeRand': 'Aleatorio',
            'quiz.randTooltip':
                'Preguntas y respuestas al azar, sin mostrar el conjunto de origen.',
            'quiz.changeSets': 'Cambiar conjuntos',
            'quiz.changeRole': 'Cambiar puesto',
            'quiz.restart': 'Reiniciar',
            'quiz.review': 'Ver fallos',
            'quiz.jumpTo': 'Ir a pregunta…',
            'quiz.loadError': 'Error al cargar la pregunta.',
            'quiz.resetNow': 'Reiniciar',
            'quiz.correct': 'Correcto',
            'quiz.wrongPrefix': 'Incorrecto. Respuesta correcta:',
            'quiz.questionNum': 'Pregunta {pos} de {total}',
            'quiz.prev': 'Anterior',
            'quiz.next': 'Siguiente',
            'quiz.subtitle': '{names} · {count} preguntas',
            'modal.cancel': 'Cancelar',
            'restart.confirm':
                '¿Reiniciar el test?\n\nEsto borrará tus respuestas.',
            'mode.changeConfirm':
                '¿Cambiar el orden?\n\nEsto reiniciará el progreso actual.',
            'mode.changeBtn': 'Cambiar',
            'setup.resumeTitle': 'Test en curso',
            'setup.resumeMeta': '{names} · {answered} de {total} contestadas',
            'setup.resumeBtn': 'Continuar',
            'setup.discardBtn': 'Descartar',
            'setup.discardConfirm':
                '¿Descartar el test en curso?\n\nPerderás las respuestas guardadas.',
            'report.button': 'Reportar pregunta',
            'report.title': 'Reportar un error en esta pregunta',
            'report.reason': 'Motivo',
            'report.reasonWrong': 'Respuesta incorrecta',
            'report.reasonUnclear': 'Pregunta confusa',
            'report.reasonTypo': 'Errata',
            'report.reasonOther': 'Otro',
            'report.body': 'Descripción (opcional)',
            'report.bodyPlaceholder':
                'Describe brevemente el problema (opcional)...',
            'report.nickname': 'Apodo (opcional)',
            'report.nicknamePlaceholder': 'Anónimo',
            'report.cancel': 'Cancelar',
            'report.submit': 'Enviar',
            'report.sending': 'Enviando…',
            'report.sent': 'Reporte enviado. Gracias.',
            'report.turnstileUnavailable':
                'Anti-spam no disponible. Contacta al administrador.',
            'report.turnstileError': 'Error Turnstile: {msg}',
            'report.sendError': 'Error al enviar',
            'footer.disclaimer':
                'Proyecto independiente y gratuito, no afiliado a Osakidetza ni al Gobierno Vasco. Preguntas extraídas del material oficial publicado por Osakidetza.',
            'footer.contact': 'Contacto y privacidad'
        },
        eu: {
            title: 'OPE Osakidetza',
            'header.title': 'OPE Osakidetza',
            'header.subtitle': 'Praktika testa',
            'header.home': 'Hasierara itzuli',
            'stats.question': 'Galdera',
            'stats.correct': 'Asmatuak',
            'stats.wrong': 'Akatsak',
            'stats.percent': '% asmatze',
            'theme.toggle': 'Gaia aldatu',
            'theme.light': 'Gai argia',
            'theme.dark': 'Gai iluna',
            'lang.label': 'Hizkuntza',
            'setup.title': 'Aukeratu zure lanpostua',
            'setup.help':
                'Aukeratu aurkezten zaren lanpostua. Testak gai komuna eta zati espezifikoa konbinatuko ditu.',
            'setup.empty': 'Ez da lanposturik aurkitu.',
            'setup.noneSelected': 'Aukeratu lanpostu bat',
            'setup.selectedCount': '{count} galdera aukeratuta',
            'setup.zeroSelected': 'Aukeratu lanpostu bat',
            'setup.questionsAbbrev': 'gald.',
            'setup.start': 'Hasi',
            'setup.subtitlePrompt': 'Aukeratu zure lanpostua hasteko',
            'setup.subtitlePromptCustom':
                'Aukeratu galdera multzoak hasteko',
            'setup.roleSummary': 'Komuna + espezifikoa',
            'setup.customToggle': 'Eskuz aukeratu multzoak',
            'setup.rolesToggle': 'Lanpostua aukeratzera itzuli',
            'setup.customTitle': 'Aukeratu galdera multzoak',
            'setup.customHelp':
                'Aukeratu multzo bat edo gehiago. Hainbat markatzean, galderak test bakarrean bateratzen dira.',
            'setup.noneSelectedCustom': 'Aukeratu gutxienez multzo bat',
            'quiz.modeSeq': 'Ordena',
            'quiz.seqTooltip':
                'Galderak eta erantzunak jatorrizko ordenan, galdera bakoitzaren multzoa erakutsiz.',
            'quiz.modeRand': 'Ausazkoa',
            'quiz.randTooltip':
                'Galderak eta erantzunak ausaz, jatorrizko multzoa ezkutuan.',
            'quiz.changeSets': 'Multzoak aldatu',
            'quiz.changeRole': 'Lanpostua aldatu',
            'quiz.restart': 'Berrabiarazi',
            'quiz.review': 'Akatsak ikusi',
            'quiz.jumpTo': 'Galderara joan…',
            'quiz.loadError': 'Errorea galdera kargatzean.',
            'quiz.resetNow': 'Berrabiarazi',
            'quiz.correct': 'Zuzena',
            'quiz.wrongPrefix': 'Okerra. Erantzun zuzena:',
            'quiz.questionNum': '{total}-(e)tik {pos}. galdera',
            'quiz.prev': 'Aurrekoa',
            'quiz.next': 'Hurrengoa',
            'quiz.subtitle': '{names} · {count} galdera',
            'modal.cancel': 'Utzi',
            'restart.confirm':
                'Testa berrabiarazi?\n\nHonek zure erantzunak ezabatuko ditu.',
            'mode.changeConfirm':
                'Ordena aldatu?\n\nHonek uneko aurrerapena berrabiaraziko du.',
            'mode.changeBtn': 'Aldatu',
            'setup.resumeTitle': 'Testa martxan',
            'setup.resumeMeta':
                '{names} · {total}-(e)tik {answered} erantzunda',
            'setup.resumeBtn': 'Jarraitu',
            'setup.discardBtn': 'Baztertu',
            'setup.discardConfirm':
                'Martxan dagoen testa baztertu?\n\nGordetako erantzunak galduko dituzu.',
            'report.button': 'Galdera salatu',
            'report.title': 'Galdera honetako akatsa salatu',
            'report.reason': 'Arrazoia',
            'report.reasonWrong': 'Erantzun okerra',
            'report.reasonUnclear': 'Galdera nahasia',
            'report.reasonTypo': 'Idazkera akatsa',
            'report.reasonOther': 'Bestelakoa',
            'report.body': 'Deskripzioa (aukerakoa)',
            'report.bodyPlaceholder':
                'Azaldu laburki zein den arazoa (aukerakoa)...',
            'report.nickname': 'Ezizena (aukerakoa)',
            'report.nicknamePlaceholder': 'Anonimoa',
            'report.cancel': 'Utzi',
            'report.submit': 'Bidali',
            'report.sending': 'Bidaltzen…',
            'report.sent': 'Txostena bidalita. Eskerrik asko.',
            'report.turnstileUnavailable':
                'Anti-spam ez dago erabilgarri. Jarri harremanetan administratzailearekin.',
            'report.turnstileError': 'Turnstile errorea: {msg}',
            'report.sendError': 'Errorea bidaltzean',
            'footer.disclaimer':
                'Proiektu independentea eta doakoa, ez dago Osakidetzarekin edo Eusko Jaurlaritzarekin lotuta. Galderak Osakidetzak argitaratutako material ofizialetik atera dira.',
            'footer.contact': 'Harremanetarako eta pribatutasuna'
        }
    };

    function detectInitialLang() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored && TRANSLATIONS[stored]) return stored;
        } catch {
            /* ignore */
        }
        // Inspect navigator.languages in priority order; the browser's
        // preferred language wins over secondary entries.
        const candidates = Array.isArray(navigator.languages)
            ? navigator.languages.slice()
            : [];
        if (navigator.language) candidates.push(navigator.language);
        if (navigator.userLanguage) candidates.push(navigator.userLanguage);
        for (const raw of candidates) {
            const tag = String(raw || '').toLowerCase();
            if (tag.startsWith('eu')) return 'eu';
            if (tag.startsWith('es')) return 'es';
        }
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
            const leading = el.getAttribute('data-i18n-icon');
            const trailing = el.getAttribute('data-i18n-icon-trailing');
            const html = el.getAttribute('data-i18n-html') !== null;
            if ((leading || trailing) && window.ICONS) {
                const leadHtml = leading ? window.ICONS.get(leading) : '';
                const tailHtml = trailing ? window.ICONS.get(trailing) : '';
                el.innerHTML =
                    leadHtml +
                    '<span class="btn-label">' +
                    t(key) +
                    '</span>' +
                    tailHtml;
            } else if (html) el.innerHTML = t(key);
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
