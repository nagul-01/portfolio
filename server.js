// server.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const basicAuth = require('basic-auth'); // optional, we also support token in query
const cors = require('cors');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const DATA_FILE = path.join(__dirname, 'messages.json');
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'changeme-token';

// Ensure file exists
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]', 'utf8');

function readMessages() {
  const raw = fs.readFileSync(DATA_FILE, 'utf8');
  return JSON.parse(raw || '[]');
}
function writeMessages(arr) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(arr, null, 2), 'utf8');
}

// POST endpoint for receiving messages
app.post('/api/messages', (req, res) => {
  try {
    const data = req.body;
    // basic validation
    if (!data.fullName || !data.email || !data.message) {
      return res.status(400).json({ error: 'missing fields' });
    }
    const messages = readMessages();
    messages.push(Object.assign({}, data, { receivedAt: new Date().toISOString() }));
    writeMessages(messages);
    return res.status(201).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal error' });
  }
});

// Admin page (very simple) — protected by ADMIN_TOKEN via ?token= or Basic-Auth
app.get('/admin', (req, res) => {
  // check token in query param first
  const tokenFromQuery = req.query.token;
  let authorized = false;

  if (tokenFromQuery && tokenFromQuery === ADMIN_TOKEN) authorized = true;

  // or check basic-auth username: token
  const cred = basicAuth(req);
  if (!authorized && cred && cred.name && cred.name === ADMIN_TOKEN) authorized = true;

  if (!authorized) {
    res.statusCode = 401;
    res.setHeader('WWW-Authenticate', 'Basic realm="Admin"');
    return res.end('Unauthorized - provide ?token=YOUR_TOKEN or Basic auth with username=YOUR_TOKEN');
  }

  const messages = readMessages();
  // render minimal HTML
  const listItems = messages.map(m => `
    <li style="margin-bottom:16px;padding:12px;border:1px solid #ddd;border-radius:8px;">
      <strong>${escapeHtml(m.fullName)}</strong> — <em>${escapeHtml(m.email)}</em><br/>
      <small>${escapeHtml(m.receivedAt || m.submittedAt || '')}</small>
      <p>${escapeHtml(m.message)}</p>
      <small>Subject: ${escapeHtml(m.subject||'')}</small><br/>
      <small>Phone: ${escapeHtml(m.phone||'')}</small><br/>
      <small>Page: ${escapeHtml(m.page||'')}</small>
    </li>
  `).join('\n');

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(`
    <html><head><meta charset="utf-8"><title>Admin - Messages</title></head><body style="font-family:system-ui,Arial;margin:24px;">
      <h1>Messages (only accessible with token)</h1>
      <p>Token present and valid.</p>
      <ul style="list-style:none;padding:0;">${listItems}</ul>
      <hr/>
      <p>Messages stored in <code>messages.json</code> on server.</p>
    </body></html>
  `);
});

// simple escape helper
function escapeHtml(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on ${PORT} — admin token: set ADMIN_TOKEN env var`));
