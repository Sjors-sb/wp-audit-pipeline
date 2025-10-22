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

// --- helpers ---
function ensureDirs() { if (!fs.existsSync(paths.dist)) fs.mkdirSync(paths.dist, { recursive: true }); }
function loadJson(p) { return JSON.parse(fs.readFileSync(p, 'utf-8')); }
function loadYaml(p) { return yaml.load(fs.readFileSync(p, 'utf-8')); }
function readCss(p) { return fs.readFileSync(p, 'utf-8'); }
function colorFor(value, scale) {
  if (scale == null) return 'warn';
  if (value >= (scale?.green?.value ?? 0)) return 'ok';
  if (value >= (scale?.orange?.value ?? 0)) return 'warn';
  return 'bad';
}
function pct(n, d = 1) { return `${(n).toFixed(d)}%`; }
function ratio(part, total) { return total > 0 ? (part / total) * 100 : 0; }
function escapeHtml(s = '') {
  return String(s).replace(/[&<>"']/g, m =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[m]);
}
function renderBadge(label, color) { return `<span class="badge ${color}">${label}</span>`; }
function boolBadge(v) { return renderBadge(v ? 'JA' : 'NEE', v ? 'ok' : 'bad'); }
function n(v, f = '—') { return (v === 0 || v) ? v : f; }
function row(k, v) { return `<div class="kv"><span class="k">${escapeHtml(k)}</span><span>${v}</span></div>`; }
function numFrom(str) {
  if (str == null) return NaN;
  const s = String(str).replace(',', '.').replace(/[^\d.]/g, '');
  return parseFloat(s);
}

// --- explanations ---
function explainPerf(perf) {
  const tips = [];
  const lcp = numFrom(perf.lcp), cls = numFrom(perf.cls), inp = numFrom(perf.inp), ttfb = numFrom(perf.ttfb);
  if (!isNaN(lcp)) {
    if (lcp <= 2.5) tips.push('LCP: snel genoeg (≤2.5s).');
    else if (lcp <= 4) tips.push(`LCP: kan beter (~${perf.lcp}). Optimaliseer hero-afbeelding en gebruik fetchpriority="high".`);
    else tips.push(`LCP: traag (~${perf.lcp}). Optimaliseer afbeeldingen en activeer caching.`);
  }
  if (!isNaN(cls)) {
    if (cls <= 0.1) tips.push('CLS: stabiel (≤0.1).');
    else tips.push(`CLS: verschuivingen (~${perf.cls}). Reserveer ruimte voor afbeeldingen.`);
  }
  if (!isNaN(inp)) {
    if (inp <= 200) tips.push('INP: vlot (≤200ms).');
    else if (inp <= 500) tips.push(`INP: merkbaar traag (~${perf.inp}). Minimaliseer JS en 3rd-parties.`);
    else tips.push(`INP: traag (~${perf.inp}). Verwijder zware scripts.`);
  }
  if (!isNaN(ttfb)) {
    if (ttfb <= 200) tips.push('TTFB: snel (≤200ms).');
    else if (ttfb <= 500) tips.push(`TTFB: oké (~${perf.ttfb}). Caching of CDN helpt.`);
    else tips.push(`TTFB: traag (~${perf.ttfb}). Check hosting of DB-indexen.`);
  }
  return tips;
}

function wcagTips(w) {
  const tips = [];
  for (const r of (w || [])) {
    if (r.status === 'fail' || r.status === 'warn') {
      const c = (r.criterion || '').toLowerCase();
      if (c.includes('non-text')) tips.push('Alt-teksten toevoegen.');
      else if (c.includes('contrast')) tips.push('Verbeter kleurcontrast (min. 4.5:1).');
      else tips.push(`Controleer ${r.criterion}.`);
    }
  }
  return tips;
}

// --- main ---
function main() {
  ensureDirs();
  const data = loadJson(paths.input);
  const t = loadYaml(paths.thresholds) || {};
  const css = readCss(paths.css);

  const s = data.scores || {};
  const checks = data.checks || {};

  const perf = checks.performance_metrics || {};
  const wcag = Array.isArray(checks.wcag) ? checks.wcag : [];
  const wcagPass = wcag.length ? (wcag.filter(x => x.status === 'pass').length / wcag.length) * 100 : 0;

  // --- LEGAL block (unique!) ---
  const legal = checks.legal || {};
  const analytics = checks.analytics || {};
  let consentAssessment = '';
  if (legal.cookie_consent === false) {
    consentAssessment = renderBadge('Geen cookietoestemming → niet AVG-conform', 'bad');
  } else if (legal.cookie_consent === true && analytics.ga4 && analytics.consent_mode !== true) {
    consentAssessment = renderBadge('Consent Mode v2 ontbreekt bij GA4', 'warn');
  } else if (legal.cookie_consent === true) {
    consentAssessment = renderBadge('Consent aanwezig', 'ok');
  }

  const sectionLegal = (Object.keys(legal).length) ? `
    <div class="card section">
      <div class="h2">Legal & compliance</div>
      ${legal.cookie_consent != null ? row('Cookiemelding/consent', boolBadge(!!legal.cookie_consent)) : ''}
      ${legal.privacy_url ? row('Privacyverklaring', `<a href="${escapeHtml(legal.privacy_url)}">privacy</a>`) : ''}
      ${consentAssessment}
    </div>` : '';

  const sectionWCAG = wcag.length ? `
    <div class="card section">
      <div class="h2">WCAG 2.1 AA overzicht</div>
      <div class="kv"><span class="k">Slagingspercentage</span><strong>${wcagPass.toFixed(1)}%</strong></div>
      <table class="table"><thead><tr><th>Succescriterium</th><th>Status</th></tr></thead>
        <tbody>${wcag.map(r => `<tr><td>${escapeHtml(r.criterion)}</td><td>${r.status}</td></tr>`).join('')}</tbody>
      </table>
      ${wcagTips(wcag).length ? `<ul>${wcagTips(wcag).map(t => `<li>${escapeHtml(t)}</li>`).join('')}</ul>` : ''}
    </div>` : '';

  const html = `<!doctype html>
  <html lang="nl"><head><meta charset="utf-8"/><title>Audit</title>
  <style>${css}</style></head><body>
  <h1>Website Audit Rapport</h1>
  ${sectionLegal}
  ${sectionWCAG}
  </body></html>`;

  fs.writeFileSync(paths.out, html, 'utf-8');
  console.log(`✅ Rapport gegenereerd: ${paths.out}`);
}

main();
