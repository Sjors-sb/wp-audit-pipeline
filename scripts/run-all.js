#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const { URL } = require('url');

const root = process.cwd();
const paths = {
  partials: path.join(root, 'data', 'partials'),
  auditJson: path.join(root, 'data', 'audit.json'),
  generator: path.join(root, 'scripts', 'generate-report.js'),
  dist: path.join(root, 'dist')
};

function ensureDir(p){ if(!fs.existsSync(p)) fs.mkdirSync(p,{recursive:true}); }
function jread(p){ return JSON.parse(fs.readFileSync(p,'utf-8')); }
function jwrite(p,o){ fs.writeFileSync(p, JSON.stringify(o,null,2)); }

function parseArgs(){
  const out={}; const a=process.argv.slice(2);
  for(let i=0;i<a.length;i++){
    if(a[i].startsWith('--')){
      const k=a[i].slice(2);
      const v=(i+1<a.length && !a[i+1].startsWith('--'))?a[++i]:true;
      out[k]=v;
    }
  }
  return out;
}

async function fetchHtml(url){
  try{ const res=await fetch(url,{redirect:'follow'}); return await res.text(); }
  catch(e){ console.warn('⚠️ HTML ophalen mislukt:', e.message); return ''; }
}
function extractSiteName(html, siteUrl){
  if(html){
    const og=html.match(/<meta[^>]+property=["']og:site_name["'][^>]*content=["']([^"']+)["']/i);
    if(og?.[1]) return og[1].trim();
    const t=html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if(t?.[1]) return t[1].trim();
  }
  try{ return new URL(siteUrl).hostname.replace(/^www\./,''); }
  catch{ return siteUrl; }
}

function runCollectors(){
  const dir=path.join(root,'scripts','collectors');
  if(!fs.existsSync(dir)) return;
  const files=fs.readdirSync(dir).filter(f=>f.endsWith('.js'));
  for(const f of files){
    try{ cp.execFileSync('node',[path.join(dir,f)],{stdio:'inherit'}); }
    catch(e){ console.warn(`⚠️ Collector '${f}' faalde, ga door...`); }
  }
}

function mergePartials({siteName, siteUrl}){
  ensureDir(paths.partials);
  const files=fs.readdirSync(paths.partials).filter(f=>f.endsWith('.json'));
  const merged={ site:{name:siteName,url:siteUrl}, auditDate:new Date().toISOString().slice(0,10), brand:{}, scores:{}, checks:{} };
  for(const f of files){
    const d=jread(path.join(paths.partials,f));
    for(const k of ['site','brand','scores','checks','notes','backlog']){
      if(d[k]){
        if(Array.isArray(d[k])) merged[k]=(merged[k]||[]).concat(d[k]);
        else if(typeof d[k]==='object') merged[k]={...(merged[k]||{}),...d[k]};
        else merged[k]=d[k];
      }
    }
  }
  if(fs.existsSync(paths.auditJson)){
    try{
      const cur=jread(paths.auditJson);
      const res={...cur,...merged, brand:{...(cur.brand||{}),...(merged.brand||{})}, scores:{...(cur.scores||{}),...(merged.scores||{})}, checks:{...(cur.checks||{}),...(merged.checks||{})}};
      jwrite(paths.auditJson,res); return res;
    }catch{ jwrite(paths.auditJson,merged); return merged; }
  } else { jwrite(paths.auditJson,merged); return merged; }
}

function validateSchema(o){
  const ok=o && o.site?.name && o.site?.url && o.auditDate && o.scores && o.checks;
  if(!ok) throw new Error('Schema validatie faalde: verplichte velden ontbreken.');
}

function buildReport(){ cp.execFileSync('node',[paths.generator],{stdio:'inherit'}); }

(async function main(){
  const args=parseArgs();
  if(!args.siteUrl){ console.error('❌ Gebruik: node scripts/run-all.js --siteUrl "https://voorbeeld.nl"'); process.exit(1); }
  ensureDir(paths.dist);
  const html=await fetchHtml(args.siteUrl);
  const siteName=extractSiteName(html,args.siteUrl);
  runCollectors();
  const merged=mergePartials({siteName, siteUrl:args.siteUrl});
  validateSchema(merged);
  buildReport();
})();