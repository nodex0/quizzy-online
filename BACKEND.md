# Comments & flagging backend setup

The commenting/flagging feature is implemented as **Cloudflare Pages
Functions** living in [`functions/`](functions/). They deploy as part of
the same Cloudflare Pages project that serves the static site, so there is
no separate Worker, no cross-origin traffic, and no CORS layer.

- Runtime: Cloudflare Pages Functions
- Storage: Cloudflare D1 (serverless SQLite)
- Anti-abuse: Cloudflare Turnstile + IP-based rate limiting + honeypot
- Admin: password-protected panel at `/admin`

## Endpoints

Public:

- `GET /comments?setId=<id>&questionIdx=<n>` — list published comments.
- `POST /comments` — submit a comment or flag (Turnstile + rate-limit).

Admin (session cookie required):

- `GET  /admin/login` · `POST /admin/login` — password form + session issue
- `GET  /admin/logout` · `POST /admin/logout` — clear cookie
- `GET  /admin` — moderation panel HTML
- `GET  /admin/api/comments` — list, filter, search, stats
- `POST /admin/api/comments/:id/status` — publish/hide/spam
- `DELETE /admin/api/comments/:id` — hard delete

## One-time setup (~10 minutes)

Prereqs: a free Cloudflare account, `node` 18+.

### 1. Create the D1 database

From the repo root:

```bash
npx wrangler login
npx wrangler d1 create quizzy-comments
```

The last command prints a block like:

```toml
[[d1_databases]]
binding = "DB"
database_name = "quizzy-comments"
database_id = "abc123-..."
```

Copy the `database_id` into [`wrangler.toml`](wrangler.toml)
(replace `REPLACE_ME_AFTER_CREATE`).

### 2. Initialize the schema

```bash
npx wrangler d1 execute quizzy-comments --remote --file schema.sql
```

### 3. Create a Turnstile site

1. Cloudflare dashboard → **Turnstile** → **Add site**.
2. Hostnames:
   - `ope-kwy.pages.dev`
   - `ope.eus` + `www.ope.eus` once the custom domain is attached
   - `localhost` and `127.0.0.1` for local dev (`wrangler pages dev`)
3. Widget mode: **Managed** (invisible unless suspicious).
4. Save. You get a **Site Key** (public) and a **Secret Key** (private).

### 4. Set Pages Functions secrets

From the repo root:

```bash
# Strong admin password for /admin:
npx wrangler pages secret put ADMIN_PASSWORD --project-name <pages-project>

# Random 32+ char string that signs session cookies. Generate with:
#   node -e "console.log(crypto.randomBytes(48).toString('base64url'))"
npx wrangler pages secret put ADMIN_SESSION_SECRET --project-name <pages-project>

# Turnstile secret key from step 3:
npx wrangler pages secret put TURNSTILE_SECRET_KEY --project-name <pages-project>
```

You can also set these in the Cloudflare dashboard → your Pages project →
**Settings → Variables and Secrets**.

### 5. Wire the Turnstile site key into the frontend

Edit [`src/index.html`](src/index.html) and paste the **Site Key** (not the
secret) into `QUIZZY_CONFIG`:

```html
<script>
    window.QUIZZY_CONFIG = {
        turnstileSiteKey: '0x4AAAAAAA…',
        cfAnalyticsToken: ''
    };
</script>
```

Commit and push. Cloudflare Pages redeploys automatically.

### 6. (Optional) Enable Cloudflare Web Analytics

Cloudflare dashboard → **Analytics & Logs → Web Analytics** → **Add a
site**. Enter your Pages hostname. Cloudflare gives you a JS snippet
containing a `token` value — paste that token into
`QUIZZY_CONFIG.cfAnalyticsToken`. The site auto-injects the beacon
only when the token is non-empty.

The beacon is cookieless and reports aggregate traffic (views, referrers,
countries, device class). It does not distinguish AI crawlers from other
bots — if you need that level of detail, a custom Pages Function
middleware logging to D1 is the alternative.

## Using the admin panel

Visit `https://ope-kwy.pages.dev/admin` (or your custom domain), enter the
password from step 4. You get:

- Filter by status (all / published / hidden / spam) and by kind (comment /
  flag).
- Full-text search across body, question text, and nickname.
- Per-row actions: publish / hide / mark as spam / delete.
- Click a row to expand: full question, options, current correct answer,
  user-agent, IP.

## Data retention & privacy

Raw IPs are stored for abuse prevention. Because Pages Functions don't
support scheduled (cron) triggers, cleanup runs **lazily**: every incoming
`POST /comments` has a ~1% chance of triggering a background
`ctx.waitUntil(runCleanup(env))` that:

1. Redacts `ip` and `user_agent` on rows older than `IP_REDACT_AFTER_DAYS`
   (default: 180 days).
2. Deletes rows with `status = 'spam'` older than `SPAM_DELETE_AFTER_DAYS`
   (default: 30 days).

For a site with even a few submissions per week this keeps up fine. If
submissions are truly rare, run the cleanup manually:

```bash
npx wrangler d1 execute quizzy-comments --remote --command \
  "UPDATE comments SET ip='redacted', user_agent=NULL \
   WHERE ip != 'redacted' AND created_at < strftime('%s','now') - 180*86400"

npx wrangler d1 execute quizzy-comments --remote --command \
  "DELETE FROM comments WHERE status='spam' \
   AND created_at < strftime('%s','now') - 30*86400"
```

See [`PRIVACY.md`](PRIVACY.md) for a starter privacy-notice template.

## Local development

```bash
npx wrangler pages dev src
# → http://localhost:8788 with functions and static site
```

`wrangler pages dev` runs the Pages Functions locally, so
`POST /comments` and `/admin/*` work end-to-end. For D1, pass
`--d1 DB=quizzy-comments` (it uses a local SQLite file by default, or
`--remote` to hit the production DB).

Plain `npm start` (Express) only serves the static site — no functions.

## Debugging & operations

```bash
# Tail live logs from the Pages deployment:
npx wrangler pages deployment tail --project-name <pages-project>

# Query the DB directly:
npx wrangler d1 execute quizzy-comments --remote --command \
  "SELECT status, COUNT(*) FROM comments GROUP BY status"
```

## Disabling comments at runtime

Set `QUIZZY_CONFIG.turnstileSiteKey` to `''` in
[`src/index.html`](src/index.html), commit, push. The UI hides the
comments section entirely. Existing submissions in D1 are untouched.

## Layout

```
functions/                          # Pages Functions (deployed with src/)
├── comments.js                     # GET + POST /comments
├── admin/
│   ├── index.js                    # GET /admin
│   ├── login.js                    # GET + POST /admin/login
│   ├── logout.js                   # GET + POST /admin/logout
│   └── api/
│       └── comments/
│           ├── index.js            # GET /admin/api/comments
│           ├── [id].js             # DELETE /admin/api/comments/:id
│           └── [id]/status.js      # POST /admin/api/comments/:id/status
└── _lib/                           # shared helpers (not routed)
    ├── auth.js                     # HMAC session cookies
    ├── turnstile.js                # /siteverify round-trip
    ├── utils.js                    # JSON helpers, IP, cleanup
    └── admin-panel.js              # admin HTML blobs

wrangler.toml                       # Pages config + D1 binding
schema.sql                          # D1 schema (apply with wrangler d1 execute)
PRIVACY.md                          # privacy-notice template (Spain/GDPR)
```
