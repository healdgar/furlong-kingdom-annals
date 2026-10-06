#!/usr/bin/env node
// Transaction-search migration gate. The inventory reports all recognized scans;
// this gate names reviewed hot searches rather than banning legitimate town passes.
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {auditLegacySearchHTML,auditLegacySearches} from './legacy-search-audit.mjs';
export const transactionSearches = [
  {function:'borrow',pattern:'helper:heads_',reason:'A lender search repeats for each underfunded household.'},
  {function:'buildWorks',pattern:'helper:workers_',reason:'A carriage or construction payment repeatedly rebuilds its worker roster.'},
  {function:'commodityExposed',pattern:'unscoped-entries',reason:'An exposed-stock query materializes all commodity rows.'},
  {function:'commodityFacilities',pattern:'collection:buildings',reason:'Daily facility reconciliation visits unrelated town buildings.'},
  {function:'storageRoute',pattern:'collection:streets',reason:'Each source/destination query repeats the street signature scan.'},
];
export function unresolvedTransactionSearches(report){return transactionSearches.flatMap(target=>report.sites.filter(s=>(s.ownerFunction||s.function)===target.function&&s.pattern===target.pattern).map(site=>({...site,reason:target.reason})));}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const source=fs.readFileSync(process.argv[2]||new URL('../index.html',import.meta.url),'utf8');
 const report=source.includes('<script>')?auditLegacySearchHTML(source):auditLegacySearches(source);
 const unresolved=unresolvedTransactionSearches(report);
 for(const s of unresolved)console.log(`${s.function}:${s.line} ${s.pattern}: ${s.reason}`);
 console.log(`${unresolved.length} unresolved transaction search sites; ${report.sites.length} total scan sites inventoried.`);
 process.exitCode=unresolved.length?1:0;
}
