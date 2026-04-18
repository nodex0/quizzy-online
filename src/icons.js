// Inline SVG icon registry. Glyphs are Lucide-style (stroke: currentColor)
// to match the role icons already used in app.js — no external runtime
// dependency. Flags are drawn to scale and use rounded corners so they sit
// nicely inside pill-shaped buttons.
(function () {
    'use strict';

    const stroke =
        'viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
        'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ' +
        'aria-hidden="true"';

    const ICONS = {
        // Lucide: moon
        moon:
            '<svg class="icon" ' +
            stroke +
            '><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',

        // Lucide: sun
        sun:
            '<svg class="icon" ' +
            stroke +
            '>' +
            '<circle cx="12" cy="12" r="4"/>' +
            '<path d="M12 2v2"/><path d="M12 20v2"/>' +
            '<path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/>' +
            '<path d="M2 12h2"/><path d="M20 12h2"/>' +
            '<path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>' +
            '</svg>',

        // Lucide: flag (used for the "report question" button)
        flag:
            '<svg class="icon" ' +
            stroke +
            '>' +
            '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>' +
            '<line x1="4" y1="22" x2="4" y2="15"/>' +
            '</svg>',

        // Lucide: check
        check:
            '<svg class="icon" ' +
            stroke +
            '><polyline points="20 6 9 17 4 12"/></svg>',

        // Lucide: x
        x:
            '<svg class="icon" ' +
            stroke +
            '>' +
            '<line x1="18" y1="6" x2="6" y2="18"/>' +
            '<line x1="6" y1="6" x2="18" y2="18"/>' +
            '</svg>',

        // Lucide: alert-triangle
        alert:
            '<svg class="icon" ' +
            stroke +
            '>' +
            '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>' +
            '<line x1="12" y1="9" x2="12" y2="13"/>' +
            '<line x1="12" y1="17" x2="12.01" y2="17"/>' +
            '</svg>',

        // Lucide: arrow-left
        'arrow-left':
            '<svg class="icon" ' +
            stroke +
            '>' +
            '<line x1="19" y1="12" x2="5" y2="12"/>' +
            '<polyline points="12 19 5 12 12 5"/>' +
            '</svg>',

        // Lucide: arrow-right
        'arrow-right':
            '<svg class="icon" ' +
            stroke +
            '>' +
            '<line x1="5" y1="12" x2="19" y2="12"/>' +
            '<polyline points="12 5 19 12 12 19"/>' +
            '</svg>',

        // Lucide: rotate-ccw (restart)
        'rotate-ccw':
            '<svg class="icon" ' +
            stroke +
            '>' +
            '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/>' +
            '<path d="M3 3v5h5"/>' +
            '</svg>',

        // Spain flag — rojigualda (1:1.5).
        'flag-es':
            '<svg class="flag" viewBox="0 0 750 500" aria-hidden="true" ' +
            'preserveAspectRatio="xMidYMid slice">' +
            '<rect width="750" height="500" fill="#AA151B"/>' +
            '<rect y="125" width="750" height="250" fill="#F1BF00"/>' +
            '</svg>',

        // Ikurriña — Basque flag (14:25). Red field, white upright cross over
        // a green saltire. Values are expressed in the flag's own grid so the
        // proportions stay correct at any render size.
        'flag-eu':
            '<svg class="flag" viewBox="0 0 25 14" aria-hidden="true" ' +
            'preserveAspectRatio="xMidYMid slice">' +
            '<rect width="25" height="14" fill="#D52B1E"/>' +
            // Green saltire, drawn as two thick diagonals.
            '<path d="M0 0 L25 14 M25 0 L0 14" ' +
            'stroke="#009B48" stroke-width="3.2"/>' +
            // White upright cross on top.
            '<path d="M12.5 0 V14 M0 7 H25" ' +
            'stroke="#FFFFFF" stroke-width="2.2"/>' +
            '</svg>'
    };

    function get(name) {
        return ICONS[name] || '';
    }

    window.ICONS = { get };
})();
