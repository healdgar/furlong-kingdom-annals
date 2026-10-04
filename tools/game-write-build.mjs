// Local, source-pinned artifacts. Production admission fails while game contracts remain unresolved.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {buildGameConfig} from './game-write-game-config.mjs';
import {transformWrites} from './game-write-transform.mjs';
const sha=v=>createHash('sha256').update(v).digest('hex');
const parser=fs.readFileSync(new URL('./vendor/acorn/acorn.mjs',import.meta.url));
const runtime=()=>fs.readFileSync(new URL('./game-write-log.mjs',import.meta.url),'utf8');

export function createWriteArtifact(source,options,{runtimeSource=runtime(),scope='explicit supplied mutation contract'}={}){
  const result=transformWrites(source,{...options,failUnsupported:true});
  return {...result,build:{version:1,scope,sourceSHA256:sha(source),generatedSHA256:sha(result.code),runtimeSHA256:sha(runtimeSource),parserSHA256:sha(parser),optionsSHA256:sha(JSON.stringify(options)),manifestSHA256:sha(JSON.stringify(result.manifest))}};
}
export function verifyWriteArtifact(artifact,source,options,{runtimeSource=runtime()}={}){
  const expected=createWriteArtifact(source,options,{runtimeSource,scope:artifact.build?.scope});
  for(const key of ['sourceSHA256','generatedSHA256','runtimeSHA256','parserSHA256','optionsSHA256','manifestSHA256'])if(artifact.build?.[key]!==expected.build[key])throw Error('Stale or corrupted write artifact: '+key);
  if(artifact.code!==expected.code||JSON.stringify(artifact.manifest)!==JSON.stringify(expected.manifest))throw Error('Stale or corrupted generated mutation sites');
  return true;
}
export function buildGameWriteArtifact(html,options={}){
  const config=buildGameConfig(html,options);
  if(config.gaps.length||config.unsupported.length||!config.complete){const error=Error('Full game write-log build blocked by unresolved coverage contracts');error.coverage={sourceSHA256:config.sourceSHA256,gaps:config.gaps,unsupported:config.unsupported};throw error;}
  const source=html.slice(config.script.offset,config.script.offset+config.script.length);
  return {...createWriteArtifact(source,config.transformOptions,{scope:'full authoritative game contracts'}),htmlSHA256:config.htmlSHA256};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const [input,mode]=process.argv.slice(2);if(!input)throw Error('Usage: node tools/game-write-build.mjs INDEX_HTML [--audit]');
  const html=fs.readFileSync(input,'utf8');
  process.stdout.write(JSON.stringify(mode==='--audit'?buildGameConfig(html):buildGameWriteArtifact(html))+'\n');
}
