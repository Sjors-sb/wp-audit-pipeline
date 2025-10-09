#!/usr/bin/env node
/**
 * Single-site report generator
 * - Input:   data/audit.json
 * - Config:  audit/thresholds.yaml
 * - Output:  dist/report.html
 *
 * Gebruik: node scripts/generate-report.js
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

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

function loadYaml(p) {
  return yaml.load(fs.readFileSync(p, 'utf-8'));
}

function readCss(p) {
  return fs.readFileSync(p, 'utf-8');
}

function colorFor(value, scale) {
  // scale heeft keys: green, orange, red met min values
  if (value >= (scale.green?.value ?? 0)) return 'ok';
  if (value >= (scale.orange?.value ?? 0)) return 'warn';
  return 'bad';
}

function pct(n, digits=1) {
  return `${(n).toFixed(digits)}%`;
}

function ratio(part, total) {
  return total > 0 ? (part / total) * 100 : 0;
}

function escapeHtml(str='') {
  return String(str).replace(/[&<>"']/g, (m) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  })[m]);
}

function renderBadge(label, color) {
  return `<span class="badge ${color}">${label}</span>`;
}

function render() {
  const data = loadJson(paths.input);
  const t = loadYaml(paths.thresholds);
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

  const blocks = [
    {
      title: 'Prestatie scores',
      content: `
        <div class="grid">
          ${['performance','mobile_performance','seo','accessibility','best_practices'].map(key => {
            const val = s[key] ?? 0;
            const col = colorFor(val, t[key]);
            const label = key.replace('_',' ').replace('_',' ');
            return `<div class="card">
              <div class="kv"><span class="k">${escapeHtml(label)}</span> ${renderBadge(col === 'ok' ? 'Goed' : col === 'warn' ? 'Aandacht' : 'Actie', col)}</div>
              <div class="score">${val}<small class="muted">/100</small></div>
            </div>`;
          }).join('')}
        </div>
      `
    },
    {
      title: 'Plugins & onderhoud',
      content: `
        <div class="grid">
          <div class="card">
            <div class="kv"><span class="k">Totaal plugins</span><strong>${plugins.total ?? 0}</strong></div>
            <hr/>
            <div class="kv"><span class="k">Verouderd</span>
              <span>${plugins.outdated ?? 0} (${pct(outdatedRatio)})</span>
            </div>
            <div style="margin-top:8px;">${renderBadge(
              pct(outdatedRatio),
              colorFor(outdatedRatio, t.plugins_outdated_ratio)
            )}</div>
          </div>
          <div class="card">
            <div class="kv"><span class="k">Gedeactiveerd</span>
              <span>${plugins.inactive ?? 0} (${pct(inactiveRatio)})</span>
            </div>
            <div style="margin-top:8px;">${renderBadge(
              pct(inactiveRatio),
              colorFor(inactiveRatio, t.inactive_plugins_ratio)
            )}</div>
          </div>
          <div class="card">
            <div class="kv"><span class="k">Uptime (30 dagen)</span>
              <span>${uptime.last30d != null ? pct(uptime.last30d) : '—'}</span>
            </div>
            <div style="margin-top:8px;">${renderBadge(
              uptime.last30d != null ? pct(uptime.last30d) : '—',
              colorFor(uptime.last30d ?? 0, t.uptime_30d)
            )}</div>
            <small class="muted">Bron: ${escapeHtml(uptime.provider || '—')}</small>
          </div>
        </div>
      `
    },
    {
      title: 'WCAG 2.1 AA overzicht',
      content: `
        <div class="card">
          <div class="kv"><span class="k">Slagingspercentage</span>
            <strong>${pct(wcagPass)}</strong>
          </div>
          <div style="margin:8px 0;">${renderBadge(
            pct(wcagPass),
            colorFor(wcagPass, t.wcag_pass_ratio)
          )}</div>
          <table class="table">
            <thead><tr><th>Succescriterium</th><th>Status</th></tr></thead>
            <tbody>
              ${wcag.map(row => {
                const map = { pass: 'ok', warn: 'warn', fail: 'bad' };
                const color = map[row.status] || 'warn';
                return `<tr>
                  <td>${escapeHtml(row.criterion)}</td>
                  <td>${renderBadge(row.status.toUpperCase(), color)}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
          <p><small class="muted">
            Tip: bundel per onderwerp en verwijs naar officiële 
            <a class="link" href="https://www.w3.org/TR/WCAG21/">WCAG 2.1 documentatie</a> voor details.
          </small></p>
        </div>
      `
    }
  ];

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

    ${blocks.map(b => `
      <div class="card">
        <div class="h2">${escapeHtml(b.title)}</div>
        ${b.content}
      </div>
    `).join('')}

    <div class="footer">
      Gemaakt met jullie audit pipeline. Kleuren volgen drempelwaarden uit <code>audit/thresholds.yaml</code>.
    </div>
  </div>
</body>
</html>`;

  return html;
}

function main() {
  ensureDirs();
  const html = render();
  fs.writeFileSync(paths.out, html, 'utf-8');
  console.log(`✅ Rapport gegenereerd: ${paths.out}`);
}

main();
