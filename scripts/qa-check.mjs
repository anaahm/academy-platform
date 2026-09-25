import {readdir,readFile,access} from 'node:fs/promises';
import path from 'node:path';

const root=process.cwd();
const failures=[];
const notes=[];
const exists=async p=>{try{await access(path.join(root,p));return true}catch{return false}};
const list=await readdir(root,{withFileTypes:true});
const htmlFiles=list.filter(x=>x.isFile()&&x.name.endsWith('.html')).map(x=>x.name);
const assetNames=await readdir(path.join(root,'assets'));
const jsFiles=assetNames.filter(x=>x.endsWith('.js')).map(x=>'assets/'+x);

for(const file of jsFiles){
  const src=await readFile(path.join(root,file),'utf8');
  try{new Function(src)}catch(err){failures.push(`${file}: JavaScript syntax error: ${err.message}`)}
  if(src.includes('$$$'))failures.push(`${file}: suspicious $$$ selector token`);
}

for(const file of htmlFiles){
  const src=await readFile(path.join(root,file),'utf8');
  const ids=[...src.matchAll(/\bid=["']([^"']+)["']/g)].map(m=>m[1]);
  const seen=new Set();
  for(const id of ids){
    if(seen.has(id))failures.push(`${file}: duplicate id "${id}"`);
    seen.add(id);
  }
  const refs=[...src.matchAll(/\b(?:href|src)=["']([^"']+)["']/g)].map(m=>m[1]);
  for(const raw of refs){
    if(!raw||raw.startsWith('#')||/^(?:https?:|mailto:|tel:|data:|blob:|\/\/)/i.test(raw))continue;
    const clean=raw.split(/[?#]/)[0].replace(/^\.\//,'').replace(/^\/+/,'');
    if(!clean||clean.startsWith('../'))continue;
    if(!(await exists(clean)))failures.push(`${file}: missing local reference "${raw}"`);
  }
}

if(await exists('sw.js')){
  const sw=await readFile(path.join(root,'sw.js'),'utf8');
  const coreMatch=sw.match(/const CORE=\[([\s\S]*?)\];/);
  if(coreMatch){
    const refs=[...coreMatch[1].matchAll(/['"]([^'"]+)['"]/g)].map(m=>m[1]);
    for(const raw of refs){
      const clean=raw.split(/[?#]/)[0].replace(/^\.\//,'').replace(/^\/+/,'');
      if(clean&&!(await exists(clean)))failures.push(`sw.js: CORE references missing file "${raw}"`);
    }
  }else notes.push('sw.js: CORE list not found; skipped cache reference audit.');
}

console.log(`QA checked ${htmlFiles.length} HTML files and ${jsFiles.length} JavaScript files.`);
for(const note of notes)console.log('NOTE:',note);
if(failures.length){
  console.error('\nQA FAILED');
  failures.forEach(x=>console.error(' -',x));
  process.exit(1);
}
console.log('QA PASSED');
