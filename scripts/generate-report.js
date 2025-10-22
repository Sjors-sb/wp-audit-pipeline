#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const root = process.cwd();
const paths = {
  input: path.join(root, 'data', 'audit.json'),
  thresholds: path.join(root, 'audit', 'thresholds.yaml'),
  css: path.join(root, 'public', 'report.css'),
  dist: path.join(root, 'dist'),
  out: path.join(root, 'dist', 'report.html'),
};

function ensureDirs(){ if(!fs.existsSync(paths.dist)) fs.mkdirSync(paths.dist,{recursive:true}); }
function loadJson(p){ return JSON.parse(fs.readFileSync(p,'utf-8')); }
function loadYaml(p){ return yaml.load(fs.readFileSync(p,'utf-8')); }
function readCss(p){ return fs.readFileSync(p,'utf-8'); }
function colorFor(value, scale){ if(scale==null) return 'warn'; if(value >= (scale?.green?.value ?? 0)) return 'ok'; if(value >= (scale?.orange?.value ?? 0)) return 'warn'; return 'bad'; }
function pct(n,d=1){ return `${(n).toFixed(d)}%`; }
function ratio(part,total){ return total>0 ? (part/total)*100 : 0; }
function escapeHtml(s=''){ return String(s).replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'})[m]); }
function renderBadge(label,color){ return `<span class="badge ${color}">${label}</span>`; }
function boolBadge(v){ return renderBadge(v ? 'JA':'NEE', v ? 'ok':'bad'); }
function n(v,f='—'){ return (v===0||v) ? v : f; }
function row(k,v){ return `<div class="kv"><span class="k">${escapeHtml(k)}</span><span>${v}</span></div>`; }
function numFrom(str){ if(str==null) return NaN; const s=String(str).replace(',','.').replace(/[^\d.]/g,''); return parseFloat(s); }

function explainPerf(perf){
  const tips=[]; const lcp=numFrom(perf.lcp), cls=numFrom(perf.cls), inp=numFrom(perf.inp), ttfb=numFrom(perf.ttfb);
  if(!isNaN(lcp)){ if(lcp<=2.5) tips.push('LCP: snel genoeg (≤2.5s). Blijf afbeeldingen optimaliseren en critical CSS gebruiken.');
    else if(lcp<=4) tips.push(`LCP: kan beter (~${perf.lcp}). Optimaliseer hero-afbeelding (WebP/AVIF, juiste dimensies) en zet fetchpriority="high".`);
    else tips.push(`LCP: traag (~${perf.lcp}). Start met hero-afbeelding, page/object caching en minder render-blocking CSS/JS.`);
  }
  if(!isNaN(cls)){ if(cls<=0.1) tips.push('CLS: stabiel (≤0.1). Vaste width/height voor media, font-display: swap.');
    else tips.push(`CLS: verschuivingen (~${perf.cls}). Reserveer ruimte voor afbeeldingen/embeds en dynamische banners.`);
  }
  if(!isNaN(inp)){ if(inp<=200) tips.push('INP: vlot (≤200ms). Houd JS slank en 3rd-parties beperkt.');
    else if(inp<=500) tips.push(`INP: merkbaar traag (~${perf.inp}). Minder JS, laad trackers/widgets na consent of on-demand, code-splitting.`);
    else tips.push(`INP: traag (~${perf.inp}). Schrap zware scripts, vervang zware sliders, overweeg server-side rendering.`);
  }
  if(!isNaN(ttfb)){ if(ttfb<=200) tips.push('TTFB: snel (≤200ms).');
    else if(ttfb<=500) tips.push(`TTFB: oké (~${perf.ttfb}). Winst via servercaching, CDN en DB-optimalisatie.`);
    else tips.push(`TTFB: traag (~${perf.ttfb}). Check hosting, DB-indexen, activeer page/object caching.`);
  }
  return tips;
}

function speedRecommendations(perf){
  const recs=new Set(); const lcp=numFrom(perf.lcp), inp=numFrom(perf.inp), ttfb=numFrom(perf.ttfb);
  if(!isNaN(lcp)&&lcp>2.5){ recs.add('Afbeeldingsoptimalisatie (WebP/AVIF, juiste dimensies, lazyload buiten viewport)'); recs.add('Critical CSS + uitstellen niet-kritieke CSS'); recs.add('Prioriteit op LCP-afbeelding (fetchpriority="high", evt. preload)'); }
  if(!isNaN(inp)&&inp>200){ recs.add('JavaScript minimaliseren (code-splitting, tree-shaking, ongebruikte modules verwijderen)'); recs.add('3rd-party scripts pas na consent of on-demand laden'); recs.add('Zware UI-widgets vervangen door lichtere varianten'); }
  if(!isNaN(ttfb)&&ttfb>300){ recs.add('Server-/page-/object-caching inschakelen en goed configureren'); recs.add('CDN voor statische assets en media'); recs.add('Database-queries optimaliseren (indexen, transients)'); }
  return [...recs];
}

function wcagTips(w){
  const tips=[];
  for(const r of (w||[])){
    if(r.status==='fail'||r.status==='warn'){
      const c=(r.criterion||'').toLowerCase();
      if(c.includes('non-text')) tips.push('Alt-teksten toevoegen aan betekenisvolle afbeeldingen; decoratieve met lege alt.');
      else if(c.includes('info and relationships')) tips.push('Semantische HTML: koppen op volgorde, labels bij inputs, landmerkrollen.');
      else if(c.includes('contrast')) tips.push('Minimaal contrast (AA): 4.5:1 tekst; 3:1 grote tekst/UI-componenten.');
      else if(c.includes('link purpose')) tips.push('Beschrijvende linkteksten (“Bekijk tarieven” i.p.v. “klik hier”).');
      else if(c.includes('error')) tips.push('Fouten duidelijk aangeven met tekst en aria-live; uitleg hoe op te lossen.');
      else tips.push(`Bekijk ${r.criterion}: toepassen volgens WCAG 2.1-technieken.`);
    }
  }
  return tips;
}

function main(){
  ensureDirs();
  const data=loadJson(paths.input);
  const t=loadYaml(paths.thresholds)||{};
  const css=readCss(paths.css);

  const s=data.scores||{};
  const checks=data.checks||{};
  const brand=data.brand||{};

  const perf=checks.performance_metrics||{};
  const perfHasAny=['lcp','cls','inp','ttfb'].some(k=>checks.performance_metrics && checks.performance_metrics[k]!=null);
  const perfExplain=perfHasAny?explainPerf(perf):[];

  const plugins=checks.plugins||{};
  const uptime=checks.uptime||{};
  const hasPlugins=Number.isFinite(plugins.total)||Number.isFinite(plugins.outdated)||Number.isFinite(plugins.inactive);
  const hasUptime=Number.isFinite(uptime.last30d);

  const wcag=Array.isArray(checks.wcag)?checks.wcag:[];
  const wcagPass=wcag.length?(wcag.filter(x=>x.status==='pass').length/wcag.length)*100:0;
  const wcagAttention=wcagTips(wcag);

  const seo=checks.seo_details||{};
  const hasStructuredInfo=seo.structured_data!=null;
  const structuredDisplay=Array.isArray(seo.structured_data)
    ? (seo.structured_data.length ? seo.structured_data.map(t=>`<span class="tag">${escapeHtml(t)}</span>`).join(' ') : '—')
    : (seo.structured_data===true?'Aanwezig':(seo.structured_data===false?'Ontbreekt':'—'));

  const legal=checks.legal||{};
  const analytics=checks.analytics||{};
  let consentAssessment='';
  if(legal.cookie_consent===false){ consentAssessment=renderBadge('Geen cookietoestemming → niet AVG-conform','bad'); }
  else if(legal.cookie_consent===true && analytics.ga4 && analytics.consent_mode!==true){ consentAssessment=renderBadge('Consent Mode v2 ontbreekt bij GA4','warn'); }
  else if(legal.cookie_consent===true){ consentAssessment=renderBadge('Consent aanwezig','ok'); }

  const sectionScores = (s && Object.keys(s).length) ? `
    <div class="card section">
      <div class="h2">Prestatie scores</div>
      <div class="grid">
        ${['performance','mobile_performance','seo','accessibility','best_practices'].map(key=>{
          if(s[key]==null) return '';
          const val=s[key], col=colorFor(val,t[key]); const label=key.replace(/_/g,' ');
          return `<div class="card">
            <div class="kv"><span class="k">${escapeHtml(label)}</span> ${renderBadge(col==='ok'?'Goed':col==='warn'?'Aandacht':'Actie',col)}</div>
            <div class="score">${val}<small class="muted">/100</small></div>
          </div>`;
        }).join('')}
      </div>
    </div>` : '';

  const sectionPerfDetails = perfHasAny ? `
    <div class="card section">
      <div class="h2">Performance details (Core Web Vitals)</div>
      <div class="kpi">
        ${perf.lcp!=null?`<div class="item"><div class="label">LCP</div><div class="val">${escapeHtml(String(perf.lcp))}</div></div>`:''}
        ${perf.cls!=null?`<div class="item"><div class="label">CLS</div><div class="val">${escapeHtml(String(perf.cls))}</div></div>`:''}
        ${perf.inp!=null?`<div class="item"><div class="label">INP</div><div class="val">${escapeHtml(String(perf.inp))}</div></div>`:''}
        ${perf.ttfb!=null?`<div class="item"><div class="label">TTFB</div><div class="val">${escapeHtml(String(perf.ttfb))}</div></div>`:''}
      </div>
      ${perfExplain.length?`<hr/><ul>${perfExplain.map(t=>`<li>${escapeHtml(t)}</li>`).join('')}</ul>`:''}
      <small class="muted">Streef: LCP ≤ 2.5s, CLS ≤ 0.1, INP ≤ 200ms.</small>
    </div>` : '';

  const sectionSpeedRecs = (perfHasAny && speedRecommendations(perf).length) ? `
    <div class="card section">
      <div class="h2">Snelheidsadviezen (zonder plugins/merken)</div>
      <ul>${speedRecommendations(perf).map(t=>`<li>${escapeHtml(t)}</li>`).join('')}</ul>
      <small class="muted">Adviezen op basis van gemeten LCP/INP/TTFB.</small>
    </div>` : '';

  const sectionPlugins = (hasPlugins||hasUptime) ? `
    <div class="card section">
      <div class="h2">Plugins & onderhoud</div>
      <div class="grid">
        ${hasPlugins?`
        <div class="card">
          ${row('Totaal plugins', n(plugins.total,0))}
          ${Number.isFinite(plugins.outdated)?row('Verouderd', `${plugins.outdated} (${pct(ratio(plugins.outdated, plugins.total||0))})`):''}
          ${Number.isFinite(plugins.inactive)?row('Gedeactiveerd', `${plugins.inactive} (${pct(ratio(plugins.inactive, plugins.total||0))})`):''}
        </div>`:''}
        ${hasUptime?`
        <div class="card">
          ${row('Uptime (30 dagen)', pct(uptime.last30d))}
          ${uptime.provider?`<small class="muted">Bron: ${escapeHtml(uptime.provider)}</small>`:''}
        </div>`:''}
      </div>
    </div>` : '';

  const sectionSEO = (seo && Object.keys(seo).length) ? `
    <div class="card section">
      <div class="h2">SEO details</div>
      <div class="grid">
        <div class="card">
          ${seo.indexable!=null?row('Indexeerbaar', boolBadge(!!seo.indexable)):''}
          ${seo.robots!=null?row('Robots.txt', boolBadge(!!seo.robots)):''}
          ${seo.sitemap?row('Sitemap', `<a class="link" href="${escapeHtml(seo.sitemap)}">sitemap</a>`):''}
          ${seo.canonical?row('Canonical', `<code class="inline">${escapeHtml(seo.canonical)}</code>`):''}
          ${hasStructuredInfo?row('Structured data', structuredDisplay):''}
        </div>
        <div class="card">
          ${seo.meta_title?row('Meta title', escapeHtml(seo.meta_title)):''}
          ${seo.meta_description?row('Meta description', escapeHtml(seo.meta_description)):''}
          ${seo.og!=null?row('Open Graph', boolBadge(!!seo.og)):''}
          ${seo.twitter!=null?row('Twitter Cards', boolBadge(!!seo.twitter)):''}
        </div>
      </div>
    </div>` : '';

  const security=checks.security||{};
  const sectionSecurity=(security && Object.keys(security).length) ? `
    <div class="card section">
      <div class="h2">Security & HTTPS</div>
      ${security.https!=null?row('HTTPS', boolBadge(!!security.https)):''}
      ${security.hsts!=null?row('HSTS', boolBadge(!!security.hsts)):''}
      ${security.mixed_content!=null?row('Mixed content', renderBadge(security.mixed_content?'AANWEZIG':'NIET GEVONDEN', security.mixed_content?'warn':'ok')):''}
      ${Array.isArray(security.headers)?row('Headers (CSP, XFO, etc.)', security.headers.map(h=>`<span class="tag">${escapeHtml(h)}</span>`).join(' ')):''}
    </div>` : '';

  const legal=checks.legal||{};
  const sectionLegal=(checks.legal && Object.keys(legal).length) ? `
    <div class="card section">
      <div class="h2">Legal & compliance</div>
      ${legal.cookie_consent!=null?row('Cookiemelding/consent', boolBadge(!!legal.cookie_consent)):''}
      ${legal.privacy_url?row('Privacyverklaring', `<a class="link" href="${escapeHtml(legal.privacy_url)}">privacy</a>`):''}
      ${legal.dpa!=null?row('Verwerkersovereenkomst (DPA) aanwezig', boolBadge(!!legal.dpa)):''}
      ${legal.data_retention?row('Gegevensbewaring/anonimiseren', escapeHtml(legal.data_retention)):''}
      ${consentAssessment?`<div style="margin-top:8px;">${consentAssessment}</div>`:''}
    </div>` : '';

  const ux=checks.ux||{};
  const sectionUX=(ux && Object.keys(ux).length) ? `
    <div class="card section">
      <div class="h2">UX & content</div>
      <div class="grid">
        <div class="card">
          ${ux.nav_depth!=null?row('Navigatie-diepte', n(ux.nav_depth,'—')):''}
          ${ux.search!=null?row('Zoekfunctie', boolBadge(!!ux.search)):''}
          ${ux.breadcrumbs!=null?row('Breadcrumbs', boolBadge(!!ux.breadcrumbs)):''}
        </div>
        <div class="card">
          ${ux.page_404!=null?row('404-pagina', boolBadge(!!ux.page_404)):''}
          ${ux.form_validation!=null?row('Formulier validatie', boolBadge(!!ux.form_validation)):''}
          ${ux.locale?row('Taal/vertalingen', escapeHtml(ux.locale)):''}
        </div>
      </div>
    </div>` : '';

  const wp=checks.wordpress||{};
  const sectionWP=(wp && Object.keys(wp).length) ? `
    <div class="card section">
      <div class="h2">WordPress hygiëne</div>
      ${wp.version?row('WP versie', escapeHtml(wp.version)):''}
      ${wp.admin_users!=null?row('Gebruikers met adminrol', n(wp.admin_users,'—')):''}
      ${wp.auto_updates!=null?row('Auto-updates', boolBadge(!!wp.auto_updates)):''}
      ${wp.backups!=null?row('Backups actief', boolBadge(!!wp.backups)):''}
    </div>` : '';

  const sectionWCAG = wcag.length ? `
    <div class="card section">
      <div class="h2">WCAG 2.1 AA overzicht</div>
      <div class="kv"><span class="k">Slagingspercentage</span><strong>${(wcagPass).toFixed(1)}%</strong></div>
      <div style="margin:8px 0;">${renderBadge(`${(wcagPass).toFixed(1)}%`, colorFor(wcagPass, t.wcag_pass_ratio))}</div>
      <table class="table">
        <thead><tr><th>Succescriterium</th><th>Status</th></tr></thead>
        <tbody>
          ${wcag.map(r=>{ const map={pass:'ok',warn:'warn',fail:'bad'}; const col=map[r.status]||'warn';
            return `<tr><td>${escapeHtml(r.criterion)}</td><td>${renderBadge(r.status.toUpperCase(), col)}</td></tr>`; }).join('')}
        </tbody>
      </table>
      ${wcagAttention.length?`<hr/><div class="h2" style="font-size:16px;">Aandachtspunten</div><ul>${wcagAttention.map(t=>`<li>${escapeHtml(t)}</li>`).join('')}</ul>`:''}
      <p><small class="muted">Bundel per onderwerp en verwijs naar WCAG 2.1.</small></p>
    </div>` : '';

  const notes = data.notes ? `<div class="card section"><div class="h2">Notities</div><div class="callout">${escapeHtml(data.notes)}</div></div>` : '';
  const backlog = Array.isArray(data.backlog)?data.backlog:[];
  const sectionBacklog = backlog.length ? `
    <div class="card section">
      <div class="h2">Backlog & verbeterpunten</div>
      <table class="table compact">
        <thead><tr><th>Categorie</th><th>Actie</th><th>Prioriteit</th><th>Owner</th></tr></thead>
        <tbody>
          ${backlog.map(i=>{
            const p=(i.priority||'').toLowerCase();
            const pClass=p==='hoog'||p==='high'?'high':(p==='laag'||p==='low'?'low':'medium');
            return `<tr>
              <td>${escapeHtml(i.category||'—')}</td>
              <td>${escapeHtml(i.item||'—')}</td>
              <td><span class="prio ${pClass}">${escapeHtml(i.priority||'—')}</span></td>
              <td>${escapeHtml(i.owner||'—')}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>` : '';

  const cssText=readCss(paths.css);
  const html=`<!doctype html>
<html lang="nl">
<head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Website Audit Rapport — ${escapeHtml(data.site?.name||'')}</title>
<style>${cssText}</style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div>
        <div class="h1">Website Audit Rapport</div>
        <small class="muted">${escapeHtml(data.site?.url||'')}</small><br/>
        <small class="muted">Auditdatum: ${escapeHtml(data.auditDate||'')}</small>
      </div>
      <div style="flex:1;"></div>
      <a class="cta" href="${escapeHtml(data.site?.url||'#')}" target="_blank" rel="noreferrer">Bekijk site</a>
    </div>

    ${sectionScores}
    ${sectionPerfDetails}
    ${sectionSpeedRecs}
    ${sectionPlugins}
    ${sectionSEO}
    ${sectionSecurity}
    ${sectionLegal}
    ${sectionUX}
    ${sectionWP}
    ${sectionWCAG}
    ${notes}
    ${sectionBacklog}

    <div class="footer">Gemaakt met de audit pipeline. Secties verschijnen alleen bij echte data.</div>
  </div>
</body>
</html>`;

  fs.writeFileSync(paths.out, html, 'utf-8');
  console.log(`✅ Rapport gegenereerd: ${paths.out}`);
}

main();