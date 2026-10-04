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
 // Renewed for hay remnant loss: its settled held/sale debit uses managed claim
 // tables and explicit title invalidation; exact owner/loss/replay tests cover it.
 assert.equal(digest(source.slice(a,b)),"2be58b32f1f39357ecb54ed0ac404b3e8364f74fc09c0be9a40ca09b92d0cfe2");
 const outside=(source.slice(0,a)+source.slice(b)).split('\n').filter(l=>/_owners|storageClaimTables|\.held(?:\[[^\]]+\])?\s*(?:=|[+*/-]=)|\.sale(?:\[[^\]]+\])?\s*(?:=|[+*/-]=)/.test(l)).join('\n');
 assert.equal(digest(outside),"a510157c2b2b911c4961d159f4638a79b534dce478df4548a68d900225f5fd3a");
 assert.equal((source.match(/storageTitleDirty\(/g)||[]).length,3);
});
