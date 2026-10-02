// Before packing: bundle the game's rules (its README and design notes) so the advisor can answer for them.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url)), game = path.resolve(here, '..'), out = path.join(here, 'rules');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'docs'), { recursive: true });
fs.copyFileSync(path.join(game, 'README.md'), path.join(out, 'README.md'));
for (const f of fs.readdirSync(path.join(game, 'docs')).filter(f => f.endsWith('.md'))) fs.copyFileSync(path.join(game, 'docs', f), path.join(out, 'docs', f));
console.log('rules bundled:', fs.readdirSync(out).concat(fs.readdirSync(path.join(out, 'docs')).map(f => 'docs/' + f)).join(', '));
