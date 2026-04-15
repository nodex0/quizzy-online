# quizzy-online

A small web app to do quizzes and prepare practice for upcoming exams.

Built as a zero-framework, zero-build static site (plain HTML + CSS + vanilla
JS). Originally a Lightning Web Components app — now fully rewritten.

## Contents

The repo ships one test: **Celador/a OPE Osakidetza — 200 preguntas**.
Questions live in [`src/data/questions.js`](src/data/questions.js) and can be
edited in the browser; edits persist in `localStorage`.

## Features

- 200 multiple-choice questions with live feedback (correct / wrong).
- Two modes: sequential order or randomized.
- Jump-to-question grid.
- "Ver fallos" — review only the questions you got wrong.
- In-place editor: rewrite any question/option or change the correct answer.
- Full reset to the original bank.

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
├── app.js
├── data/questions.js
└── favicon.ico
docs/                  # generated mirror of src/ for GitHub Pages
├── .nojekyll          # disables Jekyll on the Pages build
└── ... (mirror of src/)
scripts/
├── build.js           # mirrors src/ → docs/
└── server.js          # Express static server (local preview)
.github/workflows/
└── pages.yml          # Pages auto-deploy
Gemfile                # github-pages + faraday-retry (local Jekyll dev)
_config.yml            # minimal Jekyll config (legacy Pages safety net)
```
