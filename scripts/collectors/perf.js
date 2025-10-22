#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const lighthouse = require('lighthouse');
const chromeLauncher = require('chrome-launcher');

function arg(name){const i=process.argv.indexOf(`--${name}`);return i>-1?process.argv[i+1]:null;}
function out(p, o){fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(o,null,2));}
function siteUrl(){try{
  return arg('siteUrl') || process.env.SITE_URL ||
    (JSON.parse(fs.readFileSync(path.join(process.cwd(),'data','audit.json'),'utf8')).site||{}).url;
}catch{return null}}

(async () => {
  const url = siteUrl();
  if(!url){ console.error('perf: geen siteUrl'); process.exit(0); }

  const chrome = await chromeLauncher.launch({chromeFlags: ['--headless=new','--no-sandbox']});
  const opts = {logLevel:'error', port: chrome.port};
  const config = { extends: 'lighthouse:default', settings: { formFactor: 'desktop', screenEmulation: {mobile:false, width:1366, height:768, deviceScaleFactor:1, disabled:false}}};

  try{
    const {lhr} = await lighthouse(url, opts, config);
    const audits = lhr.audits;
    const metrics = {
      lcp: audits['largest-contentful-paint']?.displayValue || null,
      cls: audits['cumulative-layout-shift']?.displayValue || null,
      inp: (audits['interaction-to-next-paint']?.displayValue || audits['total-blocking-time']?.displayValue) || null,
      ttfb: audits['server-response-time']?.displayValue || null
    };
    const scores = {
      performance: Math.round((lhr.categories.performance?.score || 0)*100),
      seo: Math.round((lhr.categories.seo?.score || 0)*100),
      accessibility: Math.round((lhr.categories.accessibility?.score || 0)*100),
      best_practices: Math.round((lhr.categories['best-practices']?.score || 0)*100)
    };
    out(path.join('data','partials','scores.json'), {scores});
    out(path.join('data','partials','perf.json'), {checks:{performance_metrics: metrics}});
    console.log('✓ perf: metrics & scores geschreven');
  } catch(e){
    console.warn('⚠️ perf: ', e.message);
  } finally { try{await chrome.kill();}catch{} }
})();