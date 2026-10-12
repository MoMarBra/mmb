import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {pathToFileURL,fileURLToPath} from 'node:url';
let rootArg,manifestArg;
for(let i=2;i<process.argv.length;i++){
 const arg=process.argv[i];
 if(arg==='--manifest'){
  manifestArg=process.argv[++i];if(!manifestArg||manifestArg.startsWith('--'))throw Error('--manifest requires a local file path');
 }else if(!arg.startsWith('--')&&!rootArg)rootArg=arg;
 else throw Error('Usage: node voice-assets.test.mjs [game-root] [--manifest private-manifest.json]');
}
const root=rootArg?path.resolve(rootArg):fileURLToPath(new URL('../',import.meta.url));
const packageManifest=fileURLToPath(new URL('../../verification/private-provenance/professional-voice-credits.json',import.meta.url));
const manifest=manifestArg||process.env.VOICE_ASSET_MANIFEST||(fs.existsSync(packageManifest)?packageManifest:null);
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const load=name=>import(pathToFileURL(path.join(root,name)));
const {PROFESSIONAL_VOICE_ASSETS:assets}=await load('professional-voice-assets.js');
const {AUDIO_ASSETS:catalog}=await load('audio-catalog.js');
// An explicitly requested manifest must exist; only the default is optional.
const credits=manifest?JSON.parse(fs.readFileSync(manifest)):null;
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const imports=JSON.parse(html.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]).imports;
let assertions=0;const check=(ok,msg)=>{assert.ok(ok,msg);assertions++;};
check(Object.keys(assets).length===140,'replacement count');
if(credits){check(credits.clips.length===140,'private manifest count');check(new Set(credits.clips.map(x=>x.assetId)).size===140,'unique IDs');}
const groups={};let characters=0;
const slots=[];
for(const name of ['origin-lines.js','fire-lines.js','voice-lines.js','coffee-pitch-voices.js','office-life-voices.js','quiz-lines.js','expansion-voices.js']){
 const m=await load(name);for(const [key,values]of Object.entries(m)){
  if(/ASSETS|VARIANTS/.test(key))continue;
  for(const line of Array.isArray(values)?values:Object.values(values))if(line&&typeof line==='object'&&typeof line.text==='string'){
   const id=line.asset||('voice_'+line.id);if(assets[id])slots.push({id,line,source:name});
  }
 }
}
const rows=credits?.clips||Object.keys(assets).map(assetId=>({assetId}));
for(const row of rows){
 const a=assets[row.assetId];check(!!a,'catalogue ID '+row.assetId);check(catalog[row.assetId].path===a.path,'final overlay wins '+row.assetId);check(catalog[row.assetId].duration===a.duration,'resolved duration '+row.assetId);
 const bytes=fs.readFileSync(path.join(root,a.path));const hash=sha(bytes);
 check(bytes.length>0&&a.path.endsWith('.el-'+hash.slice(0,12)+'.mp3'),'nonempty immutable file/hash '+row.assetId);
 check(Number.isFinite(a.duration)&&a.duration>0,'positive duration metadata '+row.assetId);
 if(credits){check(a.path===row.runtimePath,'private manifest path '+row.assetId);check(hash===row.sha256,'full SHA256 '+row.assetId);check(bytes.length===row.bytes,'bytes '+row.assetId);check(a.duration===row.duration,'measured duration '+row.assetId);}
 const matching=slots.filter(s=>s.id===row.assetId);check(matching.length>0,'reachable line metadata '+row.assetId);
 const text=credits?row.text:matching[0].line.text;
 check(typeof text==='string'&&text.length>0,'nonempty line text '+row.assetId);
 for(const s of matching){check(s.line.duration===a.duration,'synchronized duration '+s.source+':'+row.assetId);check(s.line.text===text,(credits?'unchanged approved script ':'consistent runtime text ')+s.source+':'+row.assetId);}
 if(credits){groups[row.subgroup]=(groups[row.subgroup]||0)+1;characters+=row.text.length;}
}
if(credits)check(characters===8866,'exact approved spoken character count');
for(const [specifier,url]of Object.entries(imports))if(url.includes('?v=voices-')){
 const name=specifier.replace(/^\.\//,'');check(url==='./'+name+'?v=voices-'+sha(fs.readFileSync(path.join(root,name))).slice(0,12),'module cache hash '+name);
}
for(const m of html.matchAll(/(?:href|src)="\.\/([^"?]+)\?v=voices-([0-9a-f]+)"/g))check(sha(fs.readFileSync(path.join(root,m[1]))).startsWith(m[2]),'entry/style cache hash '+m[1]);
check(html.match(/<script type="module" src="([^"]+)"/)[1]===imports['./main.js'],'entry and import map use same main instance');
console.log(JSON.stringify({passed:true,assertions,assets:Object.keys(assets).length,validationMode:credits?'private-manifest':'runtime',hashVerification:credits?'full-sha256':'sha256-filename-prefix',...(credits?{characters,groups}:{}),resolvedMetadataReferences:slots.length,resolvedCatalogueEntries:Object.keys(catalog).length,scope:credits?'Static accepted-file hashes, immutable names, exact scripts, resolved catalogue precedence, duration tables, and runtime cache URLs. Audio decoding/playback is verified separately in the browser.':'Static runtime-file SHA-256 filename-prefix checks, cross-source text consistency, resolved catalogue precedence, positive synchronized duration metadata, and runtime cache URLs. No private accepted-script, group, full-hash or measured-duration claims; audio decoding/playback is verified separately in the browser.'},null,2));
