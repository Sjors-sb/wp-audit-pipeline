#!/usr/bin/env node
const fs=require('fs'); const path=require('path'); const fetch=require('node-fetch');
function arg(n){const i=process.argv.indexOf(`--${n}`);return i>-1?process.argv[i+1]:null;}
function out(p,o){fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(o,null,2));}
function siteUrl(){try{ return arg('siteUrl')||process.env.SITE_URL||(JSON.parse(fs.readFileSync(path.join(process.cwd(),'data','audit.json'),'utf8')).site||{}).url }catch{return null}}

(async()=>{
  const url=siteUrl(); if(!url){console.error('security: geen siteUrl'); process.exit(0);}
  try{
    const res = await fetch(url,{redirect:'follow'});
    const html = await res.text();
    const headers = Object.fromEntries(res.headers.entries());
    const https = /^https:/i.test(url);
    const hsts = !!headers['strict-transport-security'];
    const mixed = /src=["']http:\/\//i.test(html) || /href=["']http:\/\//i.test(html);
    const listHeaders = ['content-security-policy','x-content-type-options','referrer-policy','permissions-policy']
      .filter(h=>headers[h]).map(h=>h.replace(/(^|-)([a-z])/g,(_,a,b)=> (a?'-':'')+b.toUpperCase()));
    out(path.join('data','partials','security.json'), {checks:{security:{ https, hsts, mixed_content: !!mixed, headers: listHeaders }}});
    console.log('✓ security: geschreven');
  }catch(e){ console.warn('⚠️ security:', e.message); }
})();