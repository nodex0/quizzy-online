// Tiny promise-based replacement for window.confirm(). Rendered inside the
// app so the dialog can be themed and translated, instead of showing the
// browser's native chrome. Returns a Promise<boolean>: true = confirmed,
// false = cancelled (via button, Escape, or backdrop click).
(function () {
    'use strict';

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

    function confirmModal(opts) {
        opts = opts || {};
        const message = opts.message || '';
        const confirmLabel = opts.confirmLabel || 'OK';
        const cancelLabel = opts.cancelLabel || 'Cancel';
        const danger = !!opts.danger;

        return new Promise((resolve) => {
            const previouslyFocused = document.activeElement;

            const backdrop = document.createElement('div');
            backdrop.className = 'modal-backdrop';
            backdrop.innerHTML =
                '<div class="modal" role="alertdialog" aria-modal="true" aria-labelledby="modal-msg">' +
                '<p id="modal-msg" class="modal-message">' +
                esc(message) +
                '</p>' +
                '<div class="modal-actions">' +
                '<button type="button" class="modal-cancel">' +
                esc(cancelLabel) +
                '</button>' +
                '<button type="button" class="modal-confirm primary' +
                (danger ? ' danger' : '') +
                '">' +
                esc(confirmLabel) +
                '</button>' +
                '</div>' +
                '</div>';

            let closed = false;
            const close = (value) => {
                if (closed) return;
                closed = true;
                document.removeEventListener('keydown', onKey, true);
                backdrop.classList.add('closing');
                // Let the fade-out transition finish before removing the node.
                setTimeout(() => backdrop.remove(), 120);
                if (previouslyFocused && previouslyFocused.focus) {
                    try {
                        previouslyFocused.focus();
                    } catch {
                        /* ignore */
                    }
                }
                resolve(value);
            };

            const onKey = (e) => {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    e.stopPropagation();
                    close(false);
                } else if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    close(true);
                }
            };

            backdrop.addEventListener('click', (e) => {
                if (e.target === backdrop) close(false);
            });
            backdrop
                .querySelector('.modal-cancel')
                .addEventListener('click', () => close(false));
            backdrop
                .querySelector('.modal-confirm')
                .addEventListener('click', () => close(true));

            document.addEventListener('keydown', onKey, true);
            document.body.appendChild(backdrop);

            // Focus the primary action so Enter/Space work immediately. Using
            // requestAnimationFrame avoids an initial paint jump on Safari.
            requestAnimationFrame(() => {
                const btn = backdrop.querySelector('.modal-confirm');
                if (btn) btn.focus();
            });
        });
    }

    window.Modal = { confirm: confirmModal };
})();
