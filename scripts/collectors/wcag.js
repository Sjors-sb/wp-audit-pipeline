#!/usr/bin/env node
const fs=require('fs'); const path=require('path'); const puppeteer=require('puppeteer');
const axe = require('@axe-core/puppeteer');
function arg(n){const i=process.argv.indexOf(`--${n}`);return i>-1?process.argv[i+1]:null;}
function out(p,o){fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(o,null,2));}
function siteUrl(){try{ return arg('siteUrl')||process.env.SITE_URL||(JSON.parse(fs.readFileSync(path.join(process.cwd(),'data','audit.json'),'utf8')).site||{}).url }catch{return null}}

(async()=>{
  const url=siteUrl(); if(!url){console.error('wcag: geen siteUrl'); process.exit(0);}
  const browser=await puppeteer.launch({headless:'new', args:['--no-sandbox']});
  const page=await browser.newPage();
  try{
    await page.goto(url,{waitUntil:'networkidle2', timeout:120000});
    const results = await new axe.AxePuppeteer(page).analyze();
    const items=[];
    const push=(arr,status)=>arr.forEach(v=>{
      const tag = (v.tags||[]).find(t=>/^wcag/.test(t)) || v.id;
      const impactMap={minor:'warn', moderate:'warn', serious:'fail', critical:'fail'};
      items.push({criterion: tag, status: impactMap[v.impact] || status});
    });
    push(results.violations,'fail');
    push(results.incomplete,'warn');
    fs.mkdirSync(path.join('data','partials'),{recursive:true});
    fs.writeFileSync(path.join('data','partials','wcag.json'), JSON.stringify({checks:{wcag: items}}, null, 2));
    console.log('✓ wcag: resultaten geschreven');
  } catch(e){ console.warn('⚠️ wcag:', e.message); }
  finally{ await browser.close(); }
})();