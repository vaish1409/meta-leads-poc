'use strict';
require('dotenv').config();

const http = require('http');
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const axios = require('axios');
const { Server } = require('socket.io');

const {
  PORT = 3000,
  VERIFY_TOKEN,
  APP_SECRET,
  PAGE_ACCESS_TOKEN,
  GRAPH_VERSION = 'v21.0',
  MOCK_GRAPH = 'true',
  CLIENT_TOKEN,
  ENABLE_SIMULATOR = 'true',
  MAX_LEADS = 200,
} = process.env;

if (!VERIFY_TOKEN) {
  console.error('FATAL: VERIFY_TOKEN is not set. Copy .env.example to .env first.');
  process.exit(1);
}
if (!APP_SECRET) {
  console.warn('WARN: APP_SECRET not set -> webhook signatures are NOT being verified.');
}

const leads = [];
const seen = new Set();
const maxLeads = Number(MAX_LEADS);

function storeLead(lead) {
  leads.unshift(lead);
  if (leads.length > maxLeads) {
    const removed = leads.pop();
    seen.delete(removed.id);
  }
}

const app = express();
app.use(helmet());
app.use(cors());
app.use(
  express.json({
    limit: '1mb',
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

io.use((socket, next) => {
  if (!CLIENT_TOKEN) return next();
  const token = socket.handshake.auth && socket.handshake.auth.token;
  return token === CLIENT_TOKEN ? next() : next(new Error('unauthorized'));
});

io.on('connection', (socket) => {
  console.log(`[ws] client connected ${socket.id} (total ${io.engine.clientsCount})`);
  socket.emit('leads:snapshot', leads);
  socket.on('disconnect', (reason) => console.log(`[ws] ${socket.id} disconnected: ${reason}`));
});

function validSignature(req) {
  if (!APP_SECRET) return true;
  const header = req.get('x-hub-signature-256');
  if (!header || !req.rawBody) return false;
  const expected =
    'sha256=' + crypto.createHmac('sha256', APP_SECRET).update(req.rawBody).digest('hex');
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function fetchLeadDetails(leadgenId) {
  if (PAGE_ACCESS_TOKEN) {
    try {
      const { data } = await axios.get(
        `https://graph.facebook.com/${GRAPH_VERSION}/${leadgenId}`,
        { params: { access_token: PAGE_ACCESS_TOKEN }, timeout: 5000 }
      );
      return data;
    } catch (err) {
      const msg = err.response?.data?.error?.message || err.message;
      console.warn(`[graph] could not fetch lead ${leadgenId}: ${msg}`);
      return null;
    }
  }
  if (MOCK_GRAPH === 'true') {
    const n = Math.floor(Math.random() * 900 + 100);
    return {
      id: leadgenId,
      field_data: [
        { name: 'full_name', values: [`Test Lead ${n}`] },
        { name: 'email', values: [`test.lead${n}@example.com`] },
        { name: 'phone_number', values: [`+91 98${Math.floor(10000000 + Math.random() * 89999999)}`] },
      ],
    };
  }
  return null;
}

function normalizeLead(value, graph) {
  const fields = {};
  for (const f of graph?.field_data || []) {
    fields[f.name] = Array.isArray(f.values) ? f.values.join(', ') : String(f.values ?? '');
  }
  const name =
    fields.full_name ||
    [fields.first_name, fields.last_name].filter(Boolean).join(' ') ||
    'Unknown';
  return {
    id: String(value.leadgen_id),
    name,
    email: fields.email || null,
    phone: fields.phone_number || fields.phone || null,
    fields,
    formId: value.form_id ? String(value.form_id) : null,
    pageId: value.page_id ? String(value.page_id) : null,
    adId: value.ad_id ? String(value.ad_id) : null,
    createdTime: value.created_time
      ? new Date(Number(value.created_time) * 1000).toISOString()
      : null,
    receivedAt: new Date().toISOString(),
    source: graph ? 'graph_api' : 'webhook_only',
  };
}

async function handleLeadgen(value) {
  if (!value || !value.leadgen_id) return;
  const id = String(value.leadgen_id);
  if (seen.has(id)) {
    console.log(`[webhook] duplicate lead ${id} ignored`);
    return;
  }
  seen.add(id);
  const graph = await fetchLeadDetails(id);
  const lead = normalizeLead(value, graph);
  storeLead(lead);
  io.emit('lead:new', lead);
  console.log(`[webhook] lead ${id} (${lead.name}) pushed to ${io.engine.clientsCount} client(s)`);
}

app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('[webhook] verified by Meta');
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

app.post('/webhook', (req, res) => {
  if (!validSignature(req)) {
    console.warn('[webhook] invalid signature - rejected');
    return res.sendStatus(401);
  }
  const body = req.body;
  if (body?.object !== 'page') return res.sendStatus(404);

  res.sendStatus(200);

  for (const entry of body.entry || []) {
    for (const change of entry.changes || []) {
      if (change.field !== 'leadgen') continue;
      const value = { page_id: entry.id, ...change.value };
      handleLeadgen(value).catch((e) => console.error('[webhook] handler error', e));
    }
  }
});

app.get('/health', (_req, res) =>
  res.json({ ok: true, clients: io.engine.clientsCount, leads: leads.length })
);
app.get('/api/leads', (_req, res) => res.json(leads));

app.post('/api/simulate', (_req, res) => {
  if (ENABLE_SIMULATOR !== 'true') return res.sendStatus(404);
  const value = {
    leadgen_id: String(Date.now()),
    page_id: '111111111111',
    form_id: '222222222222',
    created_time: Math.floor(Date.now() / 1000),
  };
  handleLeadgen(value).catch(console.error);
  res.json({ simulated: value.leadgen_id });
});

server.listen(PORT, () => console.log(`Server listening on :${PORT}`));

function shutdown() {
  console.log('Shutting down...');
  io.close(() => server.close(() => process.exit(0)));
  setTimeout(() => process.exit(1), 5000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
