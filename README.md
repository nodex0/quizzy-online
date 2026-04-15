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
[`.github/workflows/pages.yml`](.github/workflows/pages.yml) (uploads the
`src/` tree as the Pages artifact). Nothing to build, nothing to commit.

One-time setup on the repo: **Settings → Pages → Source: GitHub Actions**.

## Layout

```
src/
├── index.html         # shell
├── styles.css         # all styles
├── app.js             # quiz logic
├── data/questions.js  # 200-question bank
└── favicon.ico
scripts/
└── server.js          # Express static server (local preview)
.github/workflows/
└── pages.yml          # Pages auto-deploy
```
