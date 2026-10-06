// Carry the advisor bridge and the game's rules (its player-facing docs) inside index.html, so the 🗣 prompt can hand an agent the whole
// program and the paired bridge can learn the rules from the page. Run before a release (stamp.sh does).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), html = path.join(root, 'index.html');
const esc = t => t.replace(/<\/script/gi, '<\\/script');
const bridge = fs.readFileSync(path.join(root, 'advisor', 'furlong-advisor.mjs'), 'utf8');
export const rulesFiles = src => JSON.parse(src.match(/const RULES = (\[[^\]]*\])/)[1].replace(/'/g, '"')); // the player-facing docs the bridge names: README and the guide to the screen
export const rulesText = (root, files) => files.map((f, i) => (i ? `\n<<<FILE ${f}>>>\n` : '') + fs.readFileSync(path.join(root, f), 'utf8')).join('');
const rules = rulesText(root, rulesFiles(bridge));
if (process.argv[1] !== fileURLToPath(import.meta.url)) { /* imported by a test: only the helpers above */ } else {
let s = fs.readFileSync(html, 'utf8');
const put = (id, body) => { const re = new RegExp(`(<script type="text/plain" id="${id}">)[\\s\\S]*?(</script>)`); if (!re.test(s)) throw new Error('no #' + id); s = s.replace(re, (m, a, b) => a + '\n' + esc(body) + '\n' + b); };
put('advbridge', bridge); put('advrules', rules);
fs.writeFileSync(html, s);
console.log(`advisor embedded: bridge ${bridge.length} chars, rules ${rules.length} chars`);
}
