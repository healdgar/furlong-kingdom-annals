#!/usr/bin/env node
/* furlong-advisor: a stateless MCP server (stdio) that lets any agent app, on any model, see and play the game of
   Crown & Commons the player has open in a browser on the same machine. Three tools: search, discover, execute. The game
   pairs with it from its Advisor dialog (Menu → Advisor), with a code this bridge gives in its answers; the bridge speaks to the page over
   a WebSocket on 127.0.0.1 only. The game's rules (its README and its guide to the screen, bundled) are searchable before pairing.
   No dependencies:  npx -y furlong-advisor   (FURLONG_PORT to change the port, default 7357) */
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = +(process.env.FURLONG_PORT || 7357);
const BASE = (process.env.FURLONG_CODE || crypto.randomBytes(6).toString('base64').replace(/[^A-Z]/gi, '').toUpperCase()).slice(0, 5).padEnd(5, 'X');
let CODE = BASE + '0'; // five letters, then the port this bridge took (0 for the first): the game goes straight to it
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = [path.join(HERE, 'rules'), path.resolve(HERE, '..')].find(d => fs.existsSync(path.join(d, 'README.md'))) || HERE; // the rules bundled with the package, else the game's own folder
let VERSION = '0'; try { VERSION = JSON.parse(fs.readFileSync(path.join(HERE, 'package.json'), 'utf8')).version; } catch (_) { }
const log = (...a) => process.stderr.write('[furlong-advisor] ' + a.join(' ') + '\n');
if (process.argv.includes('--version')) { process.stdout.write(VERSION + '\n'); process.exit(0); }

/* ---- the rules, from the game's own player-facing docs (its README and its guide to the screen), searched by paragraph ---- */
const RULES = ['README.md', 'docs/UI-GUIDE.md'];
const DOCS = [];
// The same splitting and scoring as the game's own chat (ADVCHAT.rules in index.html); tools/advisor-context.test.mjs keeps them alike.
const STOP = new Set('a an and are as at be been but by can could did do does doing for from get gets got had has have how i if in into is it its me my of on or our so than that the their them then there these they this those to up us was we were what when where which who whom why will with would you your'.split(' '));
const stem = w => { w = { built: 'build', men: 'man', folk: 'folk', taxes: 'tax' }[w] || w; w = w.replace(/ies$/, 'y').replace(/(x|ch|sh|ss)es$/, '$1').replace(/([^s])s$/, '$1').replace(/(.{3,})ing$/, '$1').replace(/(.{3,})ed$/, '$1'); return w.length > 4 ? w.replace(/e$/, '') : w; };
const words = t => (String(t).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').match(/[a-z0-9]+/g) || []).filter(w => !STOP.has(w)).map(stem);
function addDocs(file, txt) {
  let head = file, buf = [];
  const para = (lines) => { const text = lines.join('\n').trim(); if (text) DOCS.push({ file, section: head, text, w: words(text), h: words(head), l: words((text.match(/^\W*\*\*([^*]+)\*\*/) || [, text.split(/[.:;]/)[0]])[1]) }); }; // a paragraph's lead: its bold opening, else its first clause
  const push = () => { let cur = []; for (const line of buf) { if (!line.trim()) { para(cur); cur = []; } else if (/^\s*([-*]|\d+\.)\s/.test(line) && cur.length && !/^\s*\|/.test(line)) { para(cur); cur = [line]; } else cur.push(line); } para(cur); buf = []; };
  for (const line of txt.split('\n')) { const m = line.match(/^<<<FILE (.+)>>>$/); if (m) { push(); file = head = m[1]; continue; } if (/^#{1,4} /.test(line)) { push(); head = line.replace(/^#+ /, ''); } else buf.push(line); }
  push(); DF = null;
}
let DF = null;
// The realm's own words for what a player asks after: a host is an army, dues are a tax, walls are raised as much as built.
const SYN = { build: ['rais', 'construct', 'mason'], tax: ['due', 'toll', 'rent'], army: ['host', 'levy'], soldier: ['host', 'man'], money: ['gold', 'purse', 'treasury'], king: ['monarch', 'crown'], queen: ['monarch', 'crown'], food: ['grain', 'hunger', 'famine'], war: ['feud', 'rebel'], save: ['resume'], speed: ['pace'] };
function searchDocs(q, n = 3) { // BM25 over paragraphs; a word in the section's heading or the paragraph's lead counts as its subject
  const Q = [...new Set(words(q))];
  if (!Q.length || !DOCS.length) return [];
  if (!DF) { DF = new Map(); let L = 0; for (const d of DOCS) { L += d.w.length; for (const w of new Set(d.w)) DF.set(w, (DF.get(w) || 0) + 1); } DF.avg = L / DOCS.length; }
  const idf = w => Math.log(1 + (DOCS.length - (DF.get(w) || 0) + 0.5) / ((DF.get(w) || 0) + 0.5));
  return DOCS.map(d => { let s = 0, hit = 0; const norm = 1.2 * (0.25 + 0.75 * d.w.length / DF.avg);
    for (const t of Q) { let best = 0; for (const w of [t, ...(SYN[t] || [])]) { let tf = 0; for (const x of d.w) if (x === w) tf++; const subj = (d.h.includes(w) ? 1 : 0) + (d.l.includes(w) ? 1 : 0);
        best = Math.max(best, (w === t ? 1 : 0.5) * idf(t) * (tf * 2.2 / (tf + norm) + 2 * subj)); }
      if (best) { hit++; s += best; } }
    return { d, s: s * hit / Q.length }; })
    .filter(x => x.s > 0).sort((a, b) => b.s - a.s).slice(0, n)
    .map(({ d }) => ({ rules: d.file + ' › ' + d.section, text: d.text.slice(0, 1500) }));
}
for (const f of RULES) {
  try { addDocs(f, fs.readFileSync(path.join(ROOT, f), 'utf8')); } catch (_) { /* no rules beside the bridge: the game will send them once paired */ }
}
let rulesAsked = false;
async function ensureRules() { // a bridge saved on its own learns the rules from the game it is paired with
  if (DOCS.length || rulesAsked || !sock) return;
  rulesAsked = true; const r = await ask('rules', {}); if (typeof r.result === 'string' && r.result) addDocs('README.md', r.result); else rulesAsked = false;
}

/* ---- the page: one WebSocket on this machine, opened by the game when the player enters the code ---- */
let sock = null, nextId = 1;
const waiting = new Map();
function frame(str) {
  const p = Buffer.from(str), n = p.length;
  const h = n < 126 ? Buffer.from([0x81, n]) : n < 65536 ? Buffer.from([0x81, 126, n >> 8, n & 255]) : (() => { const b = Buffer.alloc(10); b[0] = 0x81; b[1] = 127; b.writeBigUInt64BE(BigInt(n), 2); return b; })();
  return Buffer.concat([h, p]);
}
function attach(s) {
  let buf = Buffer.alloc(0), parts = [];
  s.on('data', chunk => {
    buf = Buffer.concat([buf, chunk]);
    for (;;) {
      if (buf.length < 2) return;
      const fin = buf[0] & 0x80, op = buf[0] & 15, masked = buf[1] & 0x80;
      let len = buf[1] & 127, off = 2;
      if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (buf.length < 10) return; len = Number(buf.readBigUInt64BE(2)); off = 10; }
      const mk = masked ? buf.subarray(off, off + 4) : null; if (masked) off += 4;
      if (buf.length < off + len) return;
      const data = Buffer.from(buf.subarray(off, off + len)); buf = buf.subarray(off + len);
      if (mk) for (let i = 0; i < data.length; i++) data[i] ^= mk[i & 3];
      if (op === 8) { s.end(); return; }
      if (op === 9) { s.write(Buffer.concat([Buffer.from([0x8a, data.length]), data])); continue; }
      if (op === 1 || op === 0) {
        parts.push(data);
        if (fin) {
          const msg = Buffer.concat(parts).toString(); parts = [];
          try { const m = JSON.parse(msg), w = waiting.get(m.id); if (w) { waiting.delete(m.id); w(m); } } catch (_) { }
        }
      }
    }
  });
  s.on('close', () => { if (sock === s) { sock = null; log('the game closed the connection'); } });
  s.on('error', () => { });
}
const server = http.createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/plain' }); res.end('Crown & Commons advisor bridge. Pair from the game’s Advisor dialog (Menu → Advisor).'); });
server.on('upgrade', (req, s) => {
  const u = new URL(req.url, 'http://x');
  if (!req.headers['sec-websocket-key']) { s.end('HTTP/1.1 400 Bad Request\r\n\r\n'); return; }
  const acc = crypto.createHash('sha1').update(req.headers['sec-websocket-key'] + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  s.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + acc + '\r\n\r\n');
  if ((u.searchParams.get('code') || '').toUpperCase() !== CODE) { const why = Buffer.from('not my code'); s.end(Buffer.concat([Buffer.from([0x88, 2 + why.length, 0x0f, 0xa3]), why])); return; } // close 4003: not this bridge's code (a refused handshake would make the browser hold back its next tries)
  if (sock) try { sock.end(); } catch (_) { }
  sock = s; attach(s); log('paired with the game');
});
let port = PORT;
server.on('error', e => { if (e.code === 'EADDRINUSE' && port < PORT + 9) { port++; server.listen(port, '127.0.0.1'); } else log('cannot listen on port ' + port + ': ' + e.message); }); // another bridge holds the port: take the next (the game tries ten in turn)
server.on('listening', () => { CODE = BASE + (port - PORT); log(`listening on 127.0.0.1:${port}; pairing code ${CODE}`); });
server.listen(port, '127.0.0.1');

function ask(op, args) {
  if (!sock) return Promise.resolve({ error: `Not paired with a game yet. Ask the player to open the game, choose Menu → Advisor, and enter the pairing code ${CODE}.` });
  const id = nextId++;
  return new Promise(res => {
    const t = setTimeout(() => { waiting.delete(id); res({ error: 'the game did not answer (is its tab asleep?)' }); }, 20000);
    waiting.set(id, m => { clearTimeout(t); res(m); });
    sock.write(frame(JSON.stringify({ id, op, args })));
  });
}

/* ---- MCP over stdio ---- */
const TOOLS = [
  { name: 'search', description: 'Search the game: its controls (every button, slider and list the player has), the places, houses and people of the realm, and the rules (the game’s own documentation). Start here.',
    inputSchema: { type: 'object', properties: { query: { type: 'string', description: 'words to look for, e.g. "tax", "Arnvad", "how do walls get built"' } }, required: ['query'] } },
  { name: 'discover', description: 'List what can be done right now: every control in a part of the interface (scope "hud", "menu", "crown", "rates", "acts", "over", "world", "annals", and while they are open "card", "petition", "plan", "context", "info", "event", "legend", "place", "dialog"; a closed drawer or folded menu still lists its controls), or, with no scope, all of them plus the verbs game:state, game:find, game:inspect, game:panel, game:chronicle, game:persona, game:place, game:plan, game:advise. Disabled controls say why.',
    inputSchema: { type: 'object', properties: { scope: { type: 'string' } } } },
  { name: 'execute', description: 'Use a control or verb by the name discover gives it: press a button, set a slider/list/box ({value}), or run a verb (game:state {path}, game:find {name}, game:inspect {name} or {code, full}, game:panel {kind, town, house}, game:chronicle {n, cat, from, to, q}, game:persona, game:place {at, target} or {cancel:true}, game:plan {kind, points, commit}, game:advise). Names are stable (crown:h-honour:3 is honouring house 3 whatever the day); each control lists its label, cost, why it is disabled, target and any risk. Answers with the game’s own reply and the annals the press wrote. Acts on the player’s real game: do it only when the player asks.',
    inputSchema: { type: 'object', properties: { tool: { type: 'string' }, args: { type: 'object' } }, required: ['tool'] } }];
const INSTRUCTIONS = `You are the advisor in Crown & Commons, a medieval kingdom simulation the player has open.
Call execute {tool:"game:persona"} first and keep to it: when the player rules, you are their closest confidant at court (a named person in the game, speaking in character, in the first person, using the realm's own names); otherwise you are the game master.
Read before you speak: game:state, game:panel, game:chronicle, game:inspect, and search for the rules. Explain why things happen from the game's own workings.
Counsel, don't seize the reins: change the game (execute a control) only when the player asks you to.
If game:advise says muted, answer only what you are asked and offer no counsel unasked.
The screen: the top bar holds the date (the timeline), the treasury (the accounts), Pause, the speed list and Menu. Menu opens the panels: Crown (the court, in four views: Overview with the tax or dues, Governance, Orders, Houses), Realm, Overlays, Kingdom accounts, Annals (filters Crown, War, Trade, Fates), Rates and Acts (sealed while the player rules), Plan, Save, Advisor, Help. Each opens in one card beside the map, which can be expanded, minimized or closed.
Controls are named scope:command:argument (crown:h-honour:3 honours house 3) and keep their names from day to day; discover lists them, a closed panel's too, with cost, why disabled, target and risk. A press answers once the game has: its reply and the annals it wrote. A control marked place:true wants game:place next (a road asks twice); game:place {cancel:true} gives it up. game:panel reads a panel; game:inspect reads any card by name or code.
Speeds (realm.speed): 0 paused, 1 Normal (half a day a second), 2 Fast (2 days), 3 Very fast (8 days), 4 Fastest (30 days), 5 Reel years (a year a second), 6 Life pace (a day in half an hour). A year is four seasons of 90 days.`;

function reply(id, result) { process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n'); }
function fail(id, code, message) { process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } }) + '\n'); }
const text = o => ({ content: [{ type: 'text', text: typeof o === 'string' ? o : JSON.stringify(o, null, 1) }] });

async function call(name, a) {
  a = a || {};
  if (name === 'search') {
    await ensureRules();
    const g = await ask('search', { q: a.query }), d = searchDocs(a.query);
    return text({ game: g.result ?? g.error, rules: d });
  }
  if (name === 'discover') { const g = await ask('discover', { scope: a.scope }); return text(g.result ?? { error: g.error }); }
  if (name === 'execute') { const g = await ask('execute', { tool: a.tool, args: a.args || {} }); return text(g.result ?? { error: g.error }); }
  throw new Error('unknown tool ' + name);
}

let inbuf = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', async chunk => {
  inbuf += chunk;
  let i;
  while ((i = inbuf.indexOf('\n')) >= 0) {
    const line = inbuf.slice(0, i).trim(); inbuf = inbuf.slice(i + 1);
    if (!line) continue;
    let m; try { m = JSON.parse(line); } catch (_) { continue; }
    if (m.id === undefined) continue; // notifications
    try {
      if (m.method === 'initialize') reply(m.id, { protocolVersion: m.params?.protocolVersion || '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'furlong-advisor', version: VERSION }, instructions: INSTRUCTIONS + `\nPairing code for this session: ${CODE}.` });
      else if (m.method === 'tools/list') reply(m.id, { tools: TOOLS });
      else if (m.method === 'tools/call') reply(m.id, await call(m.params.name, m.params.arguments));
      else if (m.method === 'ping') reply(m.id, {});
      else fail(m.id, -32601, 'method not found');
    } catch (e) { fail(m.id, -32000, String(e && e.message || e)); }
  }
});
process.stdin.on('end', () => process.exit(0));
