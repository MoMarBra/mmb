import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(process.argv[2]||'dist');
const required=['noindex','nofollow','nosnippet','noimageindex'];
const pages=[];
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
 if(entry.name.startsWith('.')||entry.name==='node_modules')continue;
 const file=path.join(dir,entry.name);
 if(entry.isDirectory())walk(file);else if(/\.html?$/i.test(entry.name))pages.push(file);
}}
walk(root);
if(!pages.length)throw Error('No public HTML found');
for(const file of pages){
 const html=fs.readFileSync(file,'utf8').replace(/<!--[\s\S]*?-->/g,'');
 const head=html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1]||'';
 const tags=[...head.matchAll(/<meta\b[^>]*>/gi)].map(m=>Object.fromEntries([...m[0].matchAll(/([\w-]+)\s*=\s*(["'])(.*?)\2/g)].map(a=>[a[1].toLowerCase(),a[3].toLowerCase()])));
 const robots=tags.filter(t=>['robots','googlebot','bingbot'].includes(t.name));
 if(!robots.some(t=>t.name==='robots'&&required.every(v=>t.content?.split(/[,\s]+/).includes(v))))throw Error('Missing search protection: '+path.relative(root,file));
 if(robots.some(t=>t.content?.split(/[,\s]+/).some(v=>['index','follow','all'].includes(v))))throw Error('Conflicting robot directive: '+file);
}
const robots=fs.readFileSync(path.join(root,'robots.txt'),'utf8');
let agents=[],hasRules=false;
const groups=[];
for(const original of robots.split(/\r?\n/)){
 const line=original.replace(/#.*/,'').trim();if(!line)continue;
 const match=line.match(/^([^:]+):\s*(.*)$/);if(!match)continue;
 const key=match[1].trim().toLowerCase(),value=match[2].trim();
 if(key==='sitemap')throw Error('Sitemap discovery is disabled for this unlisted site');
 if(key==='user-agent'){
  if(hasRules){agents=[];hasRules=false;}
  agents.push(value.toLowerCase());
 }else if(key==='allow'||key==='disallow'){
  hasRules=true;groups.push({agents:[...agents],key,value});
 }
}
for(const bot of ['*','googlebot','bingbot'])if(groups.some(r=>r.agents.includes(bot)&&r.key==='disallow'&&['/','/*'].includes(r.value)))throw Error('HTML must stay crawlable to expose noindex: '+bot);
for(const bot of ['googlebot-image','googlebot-video'])if(!groups.some(r=>r.agents.includes(bot)&&r.key==='disallow'&&r.value==='/'))throw Error('Missing media bot exclusion: '+bot);
console.log(JSON.stringify({passed:true,html:pages.map(f=>path.relative(root,f).replaceAll('\\','/')),directURLAccessUnchanged:true,htmlCrawlable:true,mediaExcluded:true}));
