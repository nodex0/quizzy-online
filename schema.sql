-- Quizzy Online — comments & flags schema for D1.
--
-- Apply once after `wrangler d1 create quizzy-comments` (see BACKEND.md):
--   wrangler d1 execute quizzy-comments --remote --file schema.sql
--
-- One row per submission, whether it's a free-form comment or a flag (which
-- may itself carry a free-form body). Question context is denormalized into
-- the row so moderation doesn't depend on the evolving client-side set data.

CREATE TABLE IF NOT EXISTS comments (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    set_id          TEXT    NOT NULL,
    question_idx    INTEGER NOT NULL,
    question_text   TEXT    NOT NULL,
    current_answer  INTEGER NOT NULL,          -- 0..3, what the app thinks is correct
    options_json    TEXT    NOT NULL,          -- JSON array of the 4 options at submission time
    kind            TEXT    NOT NULL DEFAULT 'comment' CHECK (kind IN ('comment','flag')),
    flag_reason     TEXT,                      -- 'wrong-answer' | 'unclear' | 'typo' | 'other' | NULL
    body            TEXT,                      -- free-form text; may be NULL for a bare flag
    nickname        TEXT,                      -- optional display name, may be NULL
    ip              TEXT    NOT NULL,          -- raw IP for spam/abuse; redacted after IP_REDACT_AFTER_DAYS
    user_agent      TEXT,
    created_at      INTEGER NOT NULL,          -- unix epoch seconds
    status          TEXT    NOT NULL DEFAULT 'published'
                                  CHECK (status IN ('published','hidden','spam')),
    admin_note      TEXT
);

CREATE INDEX IF NOT EXISTS idx_comments_question
    ON comments(set_id, question_idx, status, created_at);

CREATE INDEX IF NOT EXISTS idx_comments_created
    ON comments(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_comments_status_created
    ON comments(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_comments_ip_created
    ON comments(ip, created_at);
