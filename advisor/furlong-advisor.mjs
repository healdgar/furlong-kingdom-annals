#!/usr/bin/env node
/* furlong-advisor: a stateless MCP server (stdio) that lets any agent app, on any model, see and play the game of
   Furlong the player has open in a browser on the same machine. Three tools: search, discover, execute. The game
   pairs with it from its 🗣 dialog, with a code this bridge gives in its answers; the bridge speaks to the page over
   a WebSocket on 127.0.0.1 only. The game's rules (its README and design notes, bundled) are searchable before pairing.
   No dependencies:  npx -y furlong-advisor   (FURLONG_PORT to change the port, default 7357) */
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = +(process.env.FURLONG_PORT || 7357);
const CODE = (process.env.FURLONG_CODE || crypto.randomBytes(4).toString('base64').replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 6)).padEnd(6, 'X');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = [path.join(HERE, 'rules'), path.resolve(HERE, '..')].find(d => fs.existsSync(path.join(d, 'README.md'))) || HERE; // the rules bundled with the package, else the game's own folder
let VERSION = '0'; try { VERSION = JSON.parse(fs.readFileSync(path.join(HERE, 'package.json'), 'utf8')).version; } catch (_) { }
const log = (...a) => process.stderr.write('[furlong-advisor] ' + a.join(' ') + '\n');
if (process.argv.includes('--version')) { process.stdout.write(VERSION + '\n'); process.exit(0); }

/* ---- the rules, from the game's own docs: split into sections for search ---- */
const DOCS = [];
function addDocs(file, txt) {
  let head = file, buf = [];
  const push = () => { if (buf.join('').trim()) DOCS.push({ file, section: head, text: buf.join('\n').trim() }); buf = []; };
  for (const line of txt.split('\n')) { const m = line.match(/^<<<FILE (.+)>>>$/); if (m) { push(); file = head = m[1]; continue; } if (/^#{1,3} /.test(line)) { push(); head = line.replace(/^#+ /, ''); } else buf.push(line); }
  push();
}
for (const f of ['README.md', ...(fs.existsSync(path.join(ROOT, 'docs')) ? fs.readdirSync(path.join(ROOT, 'docs')).filter(x => x.endsWith('.md')).map(x => 'docs/' + x) : [])]) {
  try { addDocs(f, fs.readFileSync(path.join(ROOT, f), 'utf8')); } catch (_) { /* no rules beside the bridge: the game will send them once paired */ }
}
let rulesAsked = false;
async function ensureRules() { // a bridge saved on its own learns the rules from the game it is paired with
  if (DOCS.length || rulesAsked || !sock) return;
  rulesAsked = true; const r = await ask('rules', {}); if (typeof r.result === 'string' && r.result) addDocs('README.md', r.result); else rulesAsked = false;
}
function searchDocs(q) {
  const W = String(q || '').toLowerCase().split(/\s+/).filter(Boolean);
  if (!W.length) return [];
  return DOCS.map(d => ({ d, s: W.reduce((t, w) => t + (d.section.toLowerCase().includes(w) ? 3 : 0) + (d.text.toLowerCase().split(w).length - 1), 0) }))
    .filter(x => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 4)
    .map(({ d }) => ({ rules: d.file + ' › ' + d.section, text: d.text.slice(0, 1800) }));
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
const server = http.createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/plain' }); res.end('Furlong advisor bridge. Pair from the game’s 🗣 dialog.'); });
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
server.on('listening', () => log(`listening on 127.0.0.1:${port}; pairing code ${CODE}`));
server.listen(port, '127.0.0.1');

function ask(op, args) {
  if (!sock) return Promise.resolve({ error: `Not paired with a game yet. Ask the player to open the game, click 🗣 (An advisor) in the top bar, and enter the pairing code ${CODE}.` });
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
  { name: 'discover', description: 'List what can be done right now: every control in a part of the interface (scope "hud", "drawer:crown", "drawer:rates", "drawer:acts", "drawer:over", "drawer:world", "card", "petition", "plan"), or, with no scope, all of them plus the verbs game:state, game:find, game:inspect, game:chronicle, game:persona, game:place, game:advise. Disabled controls say why.',
    inputSchema: { type: 'object', properties: { scope: { type: 'string' } } } },
  { name: 'execute', description: 'Use a control or verb by the name discover gives it: press a button, set a slider/list/box ({value}), or run a verb (game:state {path}, game:find {name}, game:inspect {name}, game:chronicle {n}, game:persona, game:place {at}, game:advise). Acts on the player’s real game: do it only when the player asks.',
    inputSchema: { type: 'object', properties: { tool: { type: 'string' }, args: { type: 'object' } }, required: ['tool'] } }];
const INSTRUCTIONS = `You are the advisor in Furlong, a medieval kingdom simulation the player has open.
Call execute {tool:"game:persona"} first and keep to it: when the player rules, you are their closest confidant at court (a named person in the game, speaking in character, in the first person, using the realm's own names); otherwise you are the game master.
Read before you speak: game:state, game:chronicle, game:inspect, and search for the rules. Explain why things happen from the game's own workings.
Counsel, don't seize the reins: change the game (execute a control) only when the player asks you to.
If game:advise says muted, answer only what you are asked and offer no counsel unasked.`;

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
