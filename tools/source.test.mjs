import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
test('every inline game script parses',()=>{const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');let n=0;for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){if(/\bsrc=|type=["']text\/plain/.test(match[1])||!match[2].trim())continue;new vm.Script(match[2],{filename:'index.html:script'+(++n)});}assert.ok(n>0);});
