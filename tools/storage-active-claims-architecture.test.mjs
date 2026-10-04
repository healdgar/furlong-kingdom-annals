import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const source=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const digest=s=>createHash('sha256').update(s).digest('hex');
// Explicit managed mutation contract: raw same-size Map reordering or raw backing-table
// writes require public storageTitleDirty. They are not reflectively detected.
// Pin the existing ownership implementation and its outside owner/table references:
// changing a writer requires renewing this contract and its baseline comparison tests.
// This is a source-change tripwire, not a whole-program alias proof.
test('managed claim writer architecture remains reviewed',()=>{
 const a=source.indexOf('function oldHouseholdHead('),b=source.indexOf('function houseFolk(s)');
 // Renewed after reviewing the facility membership index: ownership writers and
 // outside references are unchanged; both indexes retain their baseline tests.
 assert.equal(digest(source.slice(a,b)),"69d21799b1d1f3fd58ae6e5929aaaad26ca95f3d63572cf1865eb113afa464b4");
 const outside=(source.slice(0,a)+source.slice(b)).split('\n').filter(l=>/_owners|storageClaimTables|\.held(?:\[[^\]]+\])?\s*(?:=|[+*/-]=)|\.sale(?:\[[^\]]+\])?\s*(?:=|[+*/-]=)/.test(l)).join('\n');
 assert.equal(digest(outside),"a510157c2b2b911c4961d159f4638a79b534dce478df4548a68d900225f5fd3a");
 assert.equal((source.match(/storageTitleDirty\(/g)||[]).length,3);
});
