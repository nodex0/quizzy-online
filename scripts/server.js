// Simple Express server to serve the static quiz app from src/
const compression = require('compression');
const helmet = require('helmet');
const express = require('express');
const path = require('path');

const app = express();

// Relax helmet's CSP for inline-free static assets; questions.js + app.js are external.
app.use(
    helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                imgSrc: ["'self'", 'data:'],
                objectSrc: ["'none'"]
            }
        }
    })
);
app.use(compression());

const HOST = process.env.HOST || 'localhost';
const PORT = process.env.PORT || 3001;
const STATIC_DIR = path.resolve(__dirname, '..', 'src');

app.use(express.static(STATIC_DIR));

app.get('*', (_req, res) => {
    res.sendFile(path.resolve(STATIC_DIR, 'index.html'));
});

app.listen(PORT, () =>
    console.log(`✅  Server started: http://${HOST}:${PORT}`)
);
