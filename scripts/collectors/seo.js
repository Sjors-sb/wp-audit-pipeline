#!/usr/bin/env node
const fs=require('fs'); const path=require('path'); const {URL}=require('url');
const fetch=require('node-fetch'); const cheerio=require('cheerio');

function arg(n){const i=process.argv.indexOf(`--${n}`);return i>-1?process.argv[i+1]:null;}
function out(p,o){fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(o,null,2));}
function siteUrl(){try{ return arg('siteUrl')||process.env.SITE_URL||(JSON.parse(fs.readFileSync(path.join(process.cwd(),'data','audit.json'),'utf8')).site||{}).url }catch{return null}}

(async()=>{
  const url=siteUrl(); if(!url){console.error('seo: geen siteUrl'); process.exit(0);}
  try{
    const res=await fetch(url,{redirect:'follow'}); const html=await res.text(); const $=cheerio.load(html);
    const canonical = $('link[rel="canonical"]').attr('href') || null;
    const title = $('title').text() || null;
    const description = $('meta[name="description"]').attr('content') || null;
    const og = $('meta[property^="og:"]').length>0;
    const twitter = $('meta[name^="twitter:"]').length>0;

    const types=[];
    $('script[type="application/ld+json"]').each((_,el)=>{
      try{
        const data = JSON.parse($(el).text());
        const collect = (obj)=>{ if(!obj) return; if(Array.isArray(obj)) obj.forEach(collect);
          else { if(obj['@type']) types.push(Array.isArray(obj['@type'])?obj['@type'][0]:obj['@type']); if(obj.itemListElement) collect(obj.itemListElement); }
        };
        collect(data);
      }catch{}
    });

    const origin = new URL(url).origin;
    const robotsOk = await fetch(`${origin}/robots.txt`).then(r=>r.ok).catch(()=>false);
    const sitemapGuess = `${origin}/sitemap.xml`;
    const sitemapOk = await fetch(sitemapGuess).then(r=>r.ok).catch(()=>false);

    out(path.join('data','partials','seo.json'), {checks:{seo_details:{
      indexable: res.status===200,
      robots: robotsOk,
      sitemap: sitemapOk ? sitemapGuess : null,
      canonical, meta_title:title, meta_description:description,
      og, twitter, structured_data: types.filter(Boolean)
    }}});

    console.log('✓ seo: details geschreven');
  }catch(e){ console.warn('⚠️ seo:', e.message); }
})();