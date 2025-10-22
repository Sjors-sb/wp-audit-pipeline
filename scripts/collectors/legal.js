#!/usr/bin/env node
const fs=require('fs'); const path=require('path'); const puppeteer=require('puppeteer');
function arg(n){const i=process.argv.indexOf(`--${n}`);return i>-1?process.argv[i+1]:null;}
function out(p,o){fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(o,null,2));}
function siteUrl(){try{ return arg('siteUrl')||process.env.SITE_URL||(JSON.parse(fs.readFileSync(path.join(process.cwd(),'data','audit.json'),'utf8')).site||{}).url }catch{return null}}

(async()=>{
  const url=siteUrl(); if(!url){console.error('legal: geen siteUrl'); process.exit(0);}
  const browser=await puppeteer.launch({headless:'new', args:['--no-sandbox']});
  const page=await browser.newPage();
  try{
    await page.goto(url,{waitUntil:'networkidle2', timeout:120000});
    const res = await page.evaluate(()=>{
      const findPrivacy = () => {
        const a=[...document.querySelectorAll('a')].find(x=>/privacy|privacystatement|privacyverklaring|gegevensbescherming/i.test(x.textContent||''));
        return a ? a.href : null;
      };
      const scripts = Array.from(document.scripts).map(s=>s.src||s.innerHTML||'').join('\n');
      const hasGA4 = /gtag\(/.test(scripts) || /googletagmanager\.com\/gtag/i.test(scripts);
      const hasConsentMode = /gtag\(['"]consent['"]\s*,\s*['"]default['"]/.test(scripts);
      const hasBanner = !!document.querySelector('[id*="consent"],[class*="consent"],[id*="cookie"],[class*="cookie"]');
      return { privacyLink: findPrivacy(), hasGA4, hasConsentMode, hasBanner };
    });
    out(path.join('data','partials','legal.json'), {checks:{
      legal:{ cookie_consent: res.hasBanner, privacy_url: res.privacyLink },
      analytics:{ ga4: res.hasGA4, consent_mode: res.hasConsentMode }
    }});
    console.log('✓ legal: geschreven');
  }catch(e){ console.warn('⚠️ legal:', e.message); }
  finally{ await browser.close(); }
})();