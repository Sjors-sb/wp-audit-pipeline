#!/usr/bin/env node
const fs=require('fs'); const path=require('path'); const puppeteer=require('puppeteer');
function arg(n){const i=process.argv.indexOf(`--${n}`);return i>-1?process.argv[i+1]:null;}
function out(p,o){fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(o,null,2));}
function siteUrl(){try{ return arg('siteUrl')||process.env.SITE_URL||(JSON.parse(fs.readFileSync(path.join(process.cwd(),'data','audit.json'),'utf8')).site||{}).url }catch{return null}}

(async()=>{
  const url=siteUrl(); if(!url){console.error('ux: geen siteUrl'); process.exit(0);}
  const browser=await puppeteer.launch({headless:'new', args:['--no-sandbox']});
  const page=await browser.newPage();
  try{
    await page.goto(url,{waitUntil:'networkidle2', timeout:120000});
    const data = await page.evaluate(()=>{
      const nav = document.querySelectorAll('nav a, .menu a, .navbar a'); 
      const search = !!document.querySelector('input[type="search"], form[role="search"] input');
      const breadcrumbs = !!document.querySelector('[aria-label*="breadcrumb" i], .breadcrumb, nav.breadcrumbs');
      return {
        nav_depth: Math.min( (nav?.length||0), 20),
        search, breadcrumbs,
        page_404: null,
        form_validation: null,
        locale: document.documentElement.lang || null
      };
    });
    out(path.join('data','partials','ux.json'), {checks:{ux:data}});
    console.log('✓ ux: geschreven');
  }catch(e){ console.warn('⚠️ ux:', e.message); }
  finally{ await browser.close(); }
})();