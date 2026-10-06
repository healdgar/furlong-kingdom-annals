// Before packing: bundle the game's rules (its README and its guide to the screen) so the advisor can answer for them.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url)), game = path.resolve(here, '..'), out = path.join(here, 'rules');
const files = JSON.parse(fs.readFileSync(path.join(here, 'furlong-advisor.mjs'), 'utf8').match(/const RULES = (\[[^\]]*\])/)[1].replace(/'/g, '"'));
fs.rmSync(out, { recursive: true, force: true });
for (const f of files) { fs.mkdirSync(path.dirname(path.join(out, f)), { recursive: true }); fs.copyFileSync(path.join(game, f), path.join(out, f)); }
console.log('rules bundled:', files.join(', '));
