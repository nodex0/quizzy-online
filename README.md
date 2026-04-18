# quizzy-online

A small web app to do quizzes and prepare practice for upcoming exams.

Built as a zero-framework, zero-build static site (plain HTML + CSS + vanilla
JS). Originally a Lightning Web Components app — now fully rewritten.

## Contents

The repo ships multiple question sets that can be picked before starting a
test — and combined (e.g. run _común_ + _celador_ as a single quiz):

- [`src/data/celador.js`](src/data/celador.js) — **Celador/a OPE Osakidetza**
  (parte específica, 200 preguntas).
- [`src/data/comun.js`](src/data/comun.js) — **Parte común** (OPE Osakidetza
  Temario Común, 300 preguntas).

Each file registers itself into `window.QUESTION_SETS`. To add a new set,
create another `src/data/<id>.js` file following the same shape and add a
`<script>` tag in [`src/index.html`](src/index.html).

## Import a PDF question bank

Osakidetza publishes its question banks as PDFs. The repo ships a small
CLI to extract them into a committable set file:

```bash
# Requires poppler-utils (pdftotext).
#   Ubuntu/Debian: sudo apt-get install poppler-utils
#   macOS:         brew install poppler

npm run pdf -- path/to/bank.pdf \
  --id auxiliar-admin \
  --name "Auxiliar Administrativo" \
  --description "OPE Osakidetza · 200 preguntas" \
  --answers path/to/answer-key.txt
```

This writes `src/data/auxiliar-admin.js`. Then add
`<script src="./data/auxiliar-admin.js"></script>` to
[`src/index.html`](src/index.html) (above `app.js`).

- The parser expects the typical Osakidetza layout: `N.-` for question
  stems and `a)`, `b)`, `c)`, `d)` for options. Multi-line wrapping is
  handled.
- `--answers` is optional; without it every question defaults to option
  `a`. Use [`scripts/apply-answers.js`](scripts/apply-answers.js) to set
  them later without re-parsing the PDF.
- The answer-key format is flexible: `1.b 2.a 3.c`, `1) b`, one letter
  per line, or any mix that includes question numbers with an `a`–`d`
  letter next to them.
- Use `--print` to send the generated file to stdout instead of writing
  it, and `--force` to overwrite an existing file.

## Features

- Pick one or several question sets before starting; the app merges them.
- Multiple-choice questions with live feedback (correct / wrong).
- Two modes: sequential order or randomized.
- Jump-to-question grid.
- "Ver fallos" — review only the questions you got wrong.
- Light/dark mode with system-preference detection.
- Full reset of the current quiz.
- Multilanguage UI (Español / Euskera) with browser-language detection.
- **Community comments & flagging** (optional): users can comment on any
  question or flag it as wrong. Backed by Cloudflare Pages Functions + D1
  on the same Pages project, Turnstile-protected, with a built-in admin
  panel at `/admin`. See [`BACKEND.md`](BACKEND.md) for setup. The feature
  is inert until `window.QUIZZY_CONFIG.turnstileSiteKey` is set in
  [`src/index.html`](src/index.html).

## Multilanguage

The UI is fully translatable. Strings live in
[`src/i18n.js`](src/i18n.js) under the `TRANSLATIONS` table. To add a new
language, add a new entry (e.g. `fr: { ... }`) and a new `{ code, label, short }`
row in `LANGS`.

**Question sets** can also be translated. Each set and each question
accepts an optional `translations` map; the **answer index (`a`)** is always
shared across languages because the correct answer never changes.

```js
// Set metadata with translations:
{
  id: 'celador',
  name: 'Celador/a — Parte específica',
  description: 'OPE Osakidetza · 200 preguntas',
  translations: {
    eu: { name: 'Zeladorea — Berariazko zatia',
          description: 'OPE Osakidetza · 200 galdera' }
  },
  questions: [ /* ... */ ]
}

// Per-question translations (optional, falls back to base text):
{
  q: 'Pregunta en castellano',
  o: ['Opción A', 'Opción B', 'Opción C', 'Opción D'],
  a: 0,
  translations: {
    eu: { q: 'Galdera euskaraz',
          o: ['A aukera', 'B aukera', 'C aukera', 'D aukera'] }
  }
}
```

If a translation is missing, the UI falls back to the base (Spanish) text.

## Run locally

```bash
npm install
npm start
# → http://localhost:3001
```

Or just open `src/index.html` directly in a browser — no build needed.

## Deploy

The site is deployed to **Cloudflare Pages**, which serves the contents of
`src/` directly — there is no build step. Cloudflare Pages works with
**private GitHub repos** on its free tier, so the repository does not need
to be public.

### One-time setup

1. Push this repo to GitHub (public or private).
2. Cloudflare dashboard → **Workers & Pages** → **Create application** →
   **Pages** → **Connect to Git**. Pick the repo.
3. Build settings:
   - **Production branch:** `main`
   - **Framework preset:** None
   - **Build command:** _(leave empty)_
   - **Build output directory:** `src`
   - **Root directory:** _(leave empty)_
4. Save and deploy. Cloudflare assigns a default URL of the form
   `https://<project-name>.pages.dev`.

That's it — every push to `main` triggers a new deploy. Branch pushes get
preview deploys at `https://<branch>.<project-name>.pages.dev`.

### Alternative: CLI deploy

If you prefer to deploy from your machine instead of Git integration:

```bash
npx wrangler pages deploy src --project-name quizzy-online
```

### Custom domain

Cloudflare dashboard → **Workers & Pages** → your project → **Custom
domains** → **Set up a custom domain**. Cloudflare handles TLS automatically.

### Comments backend

The commenting / flagging feature runs as **Pages Functions** (in
[`functions/`](functions/)) deployed alongside the static site — same
Cloudflare Pages project, same origin, no separate Worker. You need to
create a D1 database, load the schema, set three secrets, and add the
Turnstile site key to `src/index.html`. Full walkthrough:
[`BACKEND.md`](BACKEND.md).

## Layout

```
src/                   # static site — deployed to Pages as-is
├── index.html
├── styles.css
├── app.js             # quiz logic (set selection + quiz)
├── i18n.js            # translations table + runtime localization
├── report.js          # question-report client (no-op until configured)
├── _headers           # Cloudflare Pages security headers
├── data/
│   ├── comun.js           # parte común — 300 preguntas (Temario Común)
│   ├── celador.js         # Celador/a parte específica — 200 preguntas
│   └── auxiliar_admin.js  # Auxiliar Administrativo/a — parte específica
└── favicon.ico
functions/             # Pages Functions — comments + admin API
├── comments.js        # GET + POST /comments
├── admin/             # /admin panel + /admin/api/*
└── _lib/              # shared helpers (HMAC auth, Turnstile, utils, HTML)
wrangler.toml          # Pages config + D1 binding (pages_build_output_dir=src)
schema.sql             # D1 schema, applied with `wrangler d1 execute`
BACKEND.md             # backend setup guide
PRIVACY.md             # privacy-notice template (Spain/GDPR)
scripts/
├── server.js          # Express static server (local preview)
└── pdf-to-questions.js # PDF → question-set extractor (npm run pdf)
```
