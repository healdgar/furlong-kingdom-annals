// Carry the advisor bridge and the game's rules inside index.html, so the 🗣 prompt can hand an agent the whole
// program and the paired bridge can learn the rules from the page. Run before a release (stamp.sh does).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), html = path.join(root, 'index.html');
const esc = t => t.replace(/<\/script/gi, '<\\/script');
const bridge = fs.readFileSync(path.join(root, 'advisor', 'furlong-advisor.mjs'), 'utf8');
let rules = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
for (const f of fs.readdirSync(path.join(root, 'docs')).filter(f => f.endsWith('.md'))) rules += `\n<<<FILE docs/${f}>>>\n` + fs.readFileSync(path.join(root, 'docs', f), 'utf8');
let s = fs.readFileSync(html, 'utf8');
const put = (id, body) => { const re = new RegExp(`(<script type="text/plain" id="${id}">)[\\s\\S]*?(</script>)`); if (!re.test(s)) throw new Error('no #' + id); s = s.replace(re, (m, a, b) => a + '\n' + esc(body) + '\n' + b); };
put('advbridge', bridge); put('advrules', rules);
fs.writeFileSync(html, s);
console.log(`advisor embedded: bridge ${bridge.length} chars, rules ${rules.length} chars`);
