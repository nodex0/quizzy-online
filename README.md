# quizzy-online

A small web app to do quizzes and prepare practice for upcoming exams.

Built as a zero-framework, zero-build static site (plain HTML + CSS + vanilla
JS). Originally a Lightning Web Components app — now fully rewritten.

## Contents

The repo ships multiple question sets that can be picked before starting a
test — and combined (e.g. run _común_ + _celador_ as a single quiz):

- [`src/data/celador.js`](src/data/celador.js) — **Celador/a OPE Osakidetza**
  (parte específica, 200 preguntas).
- [`src/data/common.js`](src/data/common.js) — **Parte común** (plantilla:
  Constitución, Estatuto, Ley de Sanidad, LOPDGDD…). Edítala in-app o añade
  más entradas directamente al array.

Each file registers itself into `window.QUESTION_SETS`. To add a new set,
create another `src/data/<id>.js` file following the same shape and add a
`<script>` tag in [`src/index.html`](src/index.html).

Edits made in the browser persist per-set in `localStorage`.

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
  `a` and you can fix them in-app with the ✏️ button.
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
- In-place editor: rewrite any question/option or change the correct answer.
- Light/dark mode with system-preference detection.
- Full reset to the original bank (for the currently selected sets).

## Run locally

```bash
npm install
npm start
# → http://localhost:3001
```

Or just open `src/index.html` directly in a browser — no build needed.

## Deploy

Pushed to `main` → deployed to GitHub Pages automatically via
[`.github/workflows/pages.yml`](.github/workflows/pages.yml). The workflow
mirrors `src/` into `docs/` (via `scripts/build.js`, which also drops a
`.nojekyll` marker) and uploads `docs/` as the Pages artifact.

`docs/` is committed so either Pages source works:

- **Source: GitHub Actions** (recommended) — the workflow above handles it.
- **Source: Deploy from a branch → `main` /docs** — reads the committed
  `docs/` tree. `.nojekyll` short-circuits the Jekyll build so the
  `github-pages` gem doesn't choke on `jekyll-sass-converter`.

If you edit the app under `src/`, re-sync with `npm run build` and commit
the regenerated `docs/`.

### Local Jekyll build (optional)

A `Gemfile` is provided for anyone who wants to reproduce the GitHub Pages
build locally. It pins `github-pages` and explicitly depends on
`faraday-retry` so `jekyll-github-metadata` can use retry middleware with
Faraday v2.0+ without warnings.

```bash
bundle install
bundle exec jekyll build
```

## Layout

```
src/                   # single source of truth (edit here)
├── index.html
├── styles.css
├── app.js             # quiz logic (set selection + quiz)
├── data/
│   ├── common.js      # parte común — template
│   └── celador.js     # Celador/a parte específica — 200 preguntas
└── favicon.ico
docs/                  # generated mirror of src/ for GitHub Pages
├── .nojekyll          # disables Jekyll on the Pages build
└── ... (mirror of src/)
scripts/
├── build.js           # mirrors src/ → docs/
├── server.js          # Express static server (local preview)
└── pdf-to-questions.js # PDF → question-set extractor (npm run pdf)
.github/workflows/
└── pages.yml          # Pages auto-deploy
Gemfile                # github-pages + faraday-retry (local Jekyll dev)
_config.yml            # minimal Jekyll config (legacy Pages safety net)
```
