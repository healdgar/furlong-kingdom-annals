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
 // Combined review covers household membership, inherited arithmetic frontiers
 // and hay loss debit, safe metadata grouping, and successful-pass title caching;
 // focused baseline, conservation and replay tests remain.
 assert.equal(digest(source.slice(a,b)),"8ab8e86383e750fd6459b88ed50582530caf87f38abd203321c321f3bb5789ff");
 const outside=(source.slice(0,a)+source.slice(b)).split('\n').filter(l=>/_owners|storageClaimTables|\.held(?:\[[^\]]+\])?\s*(?:=|[+*/-]=)|\.sale(?:\[[^\]]+\])?\s*(?:=|[+*/-]=)/.test(l)).join('\n');
 assert.equal(digest(outside),"a510157c2b2b911c4961d159f4638a79b534dce478df4548a68d900225f5fd3a");
 assert.equal((source.match(/storageTitleDirty\(/g)||[]).length,3);
});
