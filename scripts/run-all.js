#!/usr/bin/env node
/**
 * Orchestrator met auto siteName detectie
 * - Vereist: --siteUrl
 * - Haalt siteName uit <meta property="og:site_name"> of <title>, anders hostname
 * - Draait collectors, mergen, validatie, rapport
 */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const { URL } = require('url');

const root = process.cwd();
const paths = {
  partials: path.join(root, 'data', 'partials'),
  auditJson: path.join(root, 'data', 'audit.json'),
  schema: path.join(root, 'audit', 'schema.json'),
  generator: path.join(root, 'scripts', 'generate-report.js'),
  dist: path.join(root, 'dist')
};

function ensureDir(p) { if (!fs.existsSync(p)) fs.mkdirSync(p, {recursive:true}); }
function jread(p) { return JSON.parse(fs.readFileSync(p, 'utf-8')); }
function jwrite(p, obj) { fs.writeFileSync(p, JSON.stringify(obj, null, 2)); }

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (let i=0;i<args.length;i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      const val = (i+1 < args.length && !args[i+1].startsWith('--')) ? args[++i] : true;
      out[key] = val;
    }
  }
  return out;
}

async function fetchHtml(url) {
  try {
    const res = await fetch(url, { redirect: 'follow' });
    const txt = await res.text();
    return txt;
  } catch (e) {
    console.warn('⚠️ Kon HTML niet ophalen voor siteName:', e.message);
    return '';
  }
}

function extractSiteName(html, siteUrl) {
  if (html) {
    const og = html.match(/<meta[^>]+property=["']og:site_name["'][^>]*content=["']([^"']+)["']/i);
    if (og && og[1]) return og[1].trim();
    const title = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (title && title[1]) return title[1].trim();
  }
  try {
    const u = new URL(siteUrl);
    return u.hostname.replace(/^www\./,'');
  } catch {
    return siteUrl;
  }
}

function runCollectors() {
  const dir = path.join(root, 'scripts', 'collectors');
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
  if (files.length === 0) return;

  console.log(`🔄 Collectors (${files.length}) starten...`);
  for (const file of files) {
    const full = path.join(dir, file);
    console.log(`→ node ${path.relative(root, full)}`);
    try {
      cp.execFileSync('node', [full], { stdio: 'inherit' });
    } catch (e) {
      console.warn(`⚠️ Collector '${file}' gaf een fout, ga door met overige...`);
    }
  }
}

function mergePartials({siteName, siteUrl}) {
  ensureDir(paths.partials);
  const partialFiles = fs.readdirSync(paths.partials).filter(f => f.endsWith('.json'));
  const merged = {
    site: { name: siteName, url: siteUrl },
    auditDate: new Date().toISOString().slice(0,10),
    brand: {},
    scores: {},
    checks: {}
  };

  for (const fname of partialFiles) {
    const p = path.join(paths.partials, fname);
    const data = jread(p);
    for (const k of ['site','brand','scores','checks','notes']) {
      if (data[k]) {
        if (typeof data[k] === 'object' && !Array.isArray(data[k])) {
          merged[k] = { ...(merged[k]||{}), ...data[k] };
        } else if (Array.isArray(data[k])) {
          merged[k] = (merged[k] || []).concat(data[k]);
        } else {
          merged[k] = data[k];
        }
      }
    }
  }

  if (fs.existsSync(paths.auditJson)) {
    try {
      const current = jread(paths.auditJson);
      const result = { ...current, ...merged, brand: { ...(current.brand||{}), ...(merged.brand||{}) },
        scores: { ...(current.scores||{}), ...(merged.scores||{}) },
        checks: { ...(current.checks||{}), ...(merged.checks||{}) } };
      jwrite(paths.auditJson, result);
      return result;
    } catch {
      jwrite(paths.auditJson, merged);
      return merged;
    }
  } else {
    jwrite(paths.auditJson, merged);
    return merged;
  }
}

function validateSchema(obj) {
  const ok = obj && obj.site && obj.site.name && obj.site.url && obj.auditDate && obj.scores && obj.checks;
  if (!ok) throw new Error('Schema validatie faalde: verplichte eigenschappen ontbreken.');
}

function buildReport() {
  console.log('🧱 Rapport genereren...');
  cp.execFileSync('node', [paths.generator], { stdio: 'inherit' });
  console.log('✅ Klaar. Zie dist/report.html');
}

async function main() {
  const args = parseArgs();
  if (!args.siteUrl) {
    console.error('❌ Gebruik: node scripts/run-all.js --siteUrl "https://voorbeeld.nl"');
    process.exit(1);
  }

  ensureDir(paths.dist);

  // Auto-detect siteName
  console.log('🔎 SiteName bepalen uit meta...');
  const html = await fetchHtml(args.siteUrl);
  const siteName = extractSiteName(html, args.siteUrl);
  console.log(`→ siteName: ${siteName}`);

  runCollectors();
  const merged = mergePartials({ siteName, siteUrl: args.siteUrl });
  validateSchema(merged);
  buildReport();
}

if (require.main === module) {
  // Node 18+ top-level await workaround
  main();
}
