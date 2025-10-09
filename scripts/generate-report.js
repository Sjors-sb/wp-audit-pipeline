#!/usr/bin/env node
/**
 * HOTFIX: define sectionBacklog before template usage and keep robust guards.
 * Extended single-site report generator with backlog table.
 */
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

function ensureDirs() {
  if (!fs.existsSync(paths.dist)) fs.mkdirSync(paths.dist, { recursive: true });
}
function loadJson(p) { return JSON.parse(fs.readFileSync(p, 'utf-8')); }
function loadYaml(p) { return yaml.load(fs.readFileSync(p, 'utf-8')); }
function readCss(p) { return fs.readFileSync(p, 'utf-8'); }
function colorFor(value, scale) {
  if (!scale && scale !== 0) return 'warn';
  if (value >= (scale?.green?.value ?? 0)) return 'ok';
  if (value >= (scale?.orange?.value ?? 0)) return 'warn';
  return 'bad';
}
function pct(n, digits=1) { return `${(n).toFixed(digits)}%`; }
function ratio(part, total) { return total > 0 ? (part / total) * 100 : 0; }
function escapeHtml(str='') {
  return String(str).replace(/[&<>\"']/g, (m) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  })[m]);
}
function renderBadge(label, color) { return `<span class="badge ${color}">${label}</span>`; }
function boolBadge(v) { return renderBadge(v ? 'JA' : 'NEE', v ? 'ok' : 'bad'); }
function n(v, fallback='—') { return (v === 0 || v) ? v : fallback; }
function row(label, value) { return `<div class="kv"><span class="k">${escapeHtml(label)}</span><span>${value}</span></div>`; }

function main() {
  ensureDirs();
  const data = loadJson(paths.input);
  const t = loadYaml(paths.thresholds) || {};
  const css = readCss(paths.css);

  const s = data.scores || {};
  const checks = data.checks || {};
  const brand = data.brand || {};

  const plugins = checks.plugins || {};
  const uptime = checks.uptime || {};
  const wcag = checks.wcag || [];

  const outdatedRatio = ratio(plugins.outdated || 0, plugins.total || 0);
  const inactiveRatio = ratio(plugins.inactive || 0, plugins.total || 0);
  const wcagPass = ratio(wcag.filter(x => x.status === 'pass').length, wcag.length || 1);

  // === Sections (same as PLUS build) ===
  const sectionScores = `
    <div class="card section">
      <div class="h2">Prestatie scores</div>
      <div class="grid">
        ${['performance','mobile_performance','seo','accessibility','best_practices'].map(key => {
          const val = s[key] ?? 0;
          const col = colorFor(val, t[key]);
          const label = key.replace(/_/g,' ');
          return `<div class="card">
            <div class="kv"><span class="k">${escapeHtml(label)}</span> ${renderBadge(col === 'ok' ? 'Goed' : col === 'warn' ? 'Aandacht' : 'Actie', col)}</div>
            <div class="score">${val}<small class="muted">/100</small></div>
          </div>`;
        }).join('')}
      </div>
    </div>`;

  const sectionPlugins = `
    <div class="card section">
      <div class="h2">Plugins & onderhoud</div>
      <div class="grid">
        <div class="card">
          ${row('Totaal plugins', n(plugins.total, 0))}
          <hr/>
          ${row('Verouderd', `${n(plugins.outdated,0)} (${pct(outdatedRatio)})`)}
          <div style="margin-top:8px;">${renderBadge(pct(outdatedRatio), colorFor(outdatedRatio, t.plugins_outdated_ratio))}</div>
        </div>
        <div class="card">
          ${row('Gedeactiveerd', `${n(plugins.inactive,0)} (${pct(inactiveRatio)})`)}
          <div style="margin-top:8px;">${renderBadge(pct(inactiveRatio), colorFor(inactiveRatio, t.inactive_plugins_ratio))}</div>
        </div>
        <div class="card">
          ${row('Uptime (30 dagen)', uptime.last30d != null ? pct(uptime.last30d) : '—')}
          <div style="margin-top:8px;">${renderBadge(uptime.last30d != null ? pct(uptime.last30d) : '—', colorFor(uptime.last30d ?? 0, t.uptime_30d))}</div>
          <small class="muted">Bron: ${escapeHtml(uptime.provider || '—')}</small>
        </div>
      </div>
    </div>`;

  const perf = checks.performance_metrics || {};
  const sectionPerfDetails = `
    <div class="card section">
      <div class="h2">Performance details (Core Web Vitals)</div>
      <div class="kpi">
        <div class="item"><div class="label">LCP</div><div class="val">${n(perf.lcp, '—')}</div></div>
        <div class="item"><div class="label">CLS</div><div class="val">${n(perf.cls, '—')}</div></div>
        <div class="item"><div class="label">INP</div><div class="val">${n(perf.inp, '—')}</div></div>
        <div class="item"><div class="label">TTFB</div><div class="val">${n(perf.ttfb, '—')}</div></div>
      </div>
      <small class="muted">Streef: LCP &lt; 2.5s, CLS &lt; 0.1, INP &lt; 200ms.</small>
    </div>`;

  const seo = checks.seo_details || {};
  const sectionSEO = `
    <div class="card section">
      <div class="h2">SEO details</div>
      <div class="grid">
        <div class="card">
          ${row('Indexeerbaar', boolBadge(!!seo.indexable))}
          ${row('Robots.txt', boolBadge(!!seo.robots))}
          ${row('Sitemap', seo.sitemap ? `<a class="link" href="${escapeHtml(seo.sitemap)}">sitemap</a>` : '—')}
          ${row('Canonical', seo.canonical ? `<code class="inline">${escapeHtml(seo.canonical)}</code>` : '—')}
        </div>
        <div class="card">
          ${row('Meta title', seo.meta_title ? escapeHtml(seo.meta_title) : '—')}
          ${row('Meta description', seo.meta_description ? escapeHtml(seo.meta_description) : '—')}
          ${row('Open Graph', boolBadge(!!seo.og))}
          ${row('Twitter Cards', boolBadge(!!seo.twitter))}
        </div>
      </div>
    </div>`;

  const security = checks.security || {};
  const sectionSecurity = `
    <div class="card section">
      <div class="h2">Security & HTTPS</div>
      ${row('HTTPS', boolBadge(!!security.https))}
      ${row('HSTS', boolBadge(!!security.hsts))}
      ${row('Mixed content', renderBadge(security.mixed_content ? 'AANWEZIG' : 'NIET GEVONDEN', security.mixed_content ? 'warn' : 'ok'))}
      ${row('Headers (CSP, XFO, etc.)', security.headers ? security.headers.map(h=>`<span class="tag">${escapeHtml(h)}</span>`).join('') : '—')}
    </div>`;

  const legal = checks.legal || {};
  const sectionLegal = `
    <div class="card section">
      <div class="h2">Legal & compliance</div>
      ${row('Cookiemelding/consent', boolBadge(!!legal.cookie_consent))}
      ${row('Privacyverklaring', legal.privacy_url ? `<a class="link" href="${escapeHtml(legal.privacy_url)}">privacy</a>` : '—')}
      ${row('Verwerkersovereenkomst (DPA) aanwezig', boolBadge(!!legal.dpa))}
      ${row('Gegevensbewaring/anonimiseren', legal.data_retention ? escapeHtml(legal.data_retention) : '—')}
    </div>`;

  const ux = checks.ux || {};
  const sectionUX = `
    <div class="card section">
      <div class="h2">UX & content</div>
      <div class="grid">
        <div class="card">
          ${row('Navigatie-diepte', n(ux.nav_depth, '—'))}
          ${row('Zoekfunctie', boolBadge(!!ux.search))}
          ${row('Breadcrumbs', boolBadge(!!ux.breadcrumbs))}
        </div>
        <div class="card">
          ${row('404-pagina', boolBadge(!!ux.page_404))}
          ${row('Formulier validatie', boolBadge(!!ux.form_validation))}
          ${row('Taal/vertalingen', ux.locale ? escapeHtml(ux.locale) : '—')}
        </div>
      </div>
    </div>`;

  const wp = checks.wordpress || {};
  const sectionWP = `
    <div class="card section">
      <div class="h2">WordPress hygiëne</div>
      ${row('WP versie', n(wp.version,'—'))}
      ${row('Gebruikers met adminrol', n(wp.admin_users,'—'))}
      ${row('Auto-updates', boolBadge(!!wp.auto_updates))}
      ${row('Backups actief', boolBadge(!!wp.backups))}
    </div>`;

  const analytics = checks.analytics || {};
  const sectionAnalytics = `
    <div class="card section">
      <div class="h2">Analytics & tagging</div>
      ${row('GA4', boolBadge(!!analytics.ga4))}
      ${row('GTM', boolBadge(!!analytics.gtm))}
      ${row('Consent-mode v2', boolBadge(!!analytics.consent_mode))}
      ${row('Server-side tagging', boolBadge(!!analytics.server_side))}
    </div>`;

  const notes = data.notes ? `<div class="card section"><div class="h2">Notities</div><div class="callout">${escapeHtml(data.notes)}</div></div>` : '';

  // === Backlog (HOTFIX: define before template usage) ===
  const backlog = Array.isArray(data.backlog) ? data.backlog : [];
  const sectionBacklog = backlog.length ? `
    <div class="card section">
      <div class="h2">Backlog & verbeterpunten</div>
      <table class="table compact">
        <thead><tr>
          <th>Categorie</th>
          <th>Actie</th>
          <th>Prioriteit</th>
          <th>Owner</th>
        </tr></thead>
        <tbody>
          ${backlog.map(i => {
            const p = (i.priority || '').toLowerCase();
            const pClass = p === 'hoog' || p === 'high' ? 'high' : (p === 'laag' || p === 'low' ? 'low' : 'medium');
            const pLabel = i.priority || '—';
            return `<tr>
              <td>${escapeHtml(i.category || '—')}</td>
              <td>${escapeHtml(i.item || '—')}</td>
              <td><span class="prio ${pClass}">${escapeHtml(pLabel)}</span></td>
              <td>${escapeHtml(i.owner || '—')}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  ` : '';

  const html = `<!doctype html>
<html lang="nl">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Website Audit Rapport — ${escapeHtml(data.site?.name || '')}</title>
  <style>${css}</style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      ${brand.logo ? `<img src="${escapeHtml(brand.logo)}" alt="Logo"/>` : ''}
      <div>
        <div class="h1">Website Audit Rapport</div>
        <small class="muted">${escapeHtml(data.site?.url || '')}</small><br/>
        <small class="muted">Auditdatum: ${escapeHtml(data.auditDate || '')}</small>
      </div>
      <div style="flex:1;"></div>
      <a class="cta" href="${escapeHtml(data.site?.url || '#')}" target="_blank" rel="noreferrer">Bekijk site</a>
    </div>

    ${sectionScores}
    ${sectionPlugins}
    ${sectionPerfDetails}
    ${sectionSEO}
    ${sectionSecurity}
    ${sectionLegal}
    ${sectionUX}
    ${sectionWP}
    ${sectionAnalytics}
    ${sectionWCAG}
    ${notes}
    ${sectionBacklog}

    <div class="footer">
      Gemaakt met de audit pipeline. Kleuren volgen drempelwaarden uit <code>audit/thresholds.yaml</code>.
    </div>
  </div>
</body>
</html>`;

  fs.writeFileSync(paths.out, html, 'utf-8');
  console.log(`✅ Rapport gegenereerd: ${paths.out}`);
}

main();
