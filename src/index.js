import 'dotenv/config';
import { format } from 'date-fns';

import { saveJson } from './utils/saveJson.js';
import { collectPageSpeed } from './collectors/pagespeed.js';
import { collectHeaders } from './collectors/headers.js';
import { collectA11y } from './collectors/a11y-pa11y.js';
import { collectStructuredData } from './collectors/structuredData.js';
import { computeScores } from './scoring/computeScores.js';
import { buildBacklog } from './report/buildBacklog.js';
import { collectGSC } from './collectors/gsc-api.js';
import { collectUptime } from './collectors/uptime-betteruptime.js';
import { collectCookies } from './collectors/cookies.js';
import { collectSeoCrawl } from './collectors/seo-crawler.js';
import { collectLegalCookies } from './collectors/legal-cookies.js';
import { collectSeoExtra } from './collectors/seo-extra.js';

const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const [k, v] = a.split('=');
    return [k, v];
  })
);
const url = args['--url'] || args.url;

if (!url) {
  console.error('Gebruik: npm run audit -- --url=https://jouwsite.nl');
  process.exit(1);
}

console.log('▶ Audit pipeline start:', url);

async function runCollector(name, fn) {
  console.log(`→ ${name}…`);
  try {
    const res = await fn();
    console.log(`✓ ${name} klaar`);
    return res;
  } catch (e) {
    const msg = e?.response?.status
      ? `${e.response.status} ${e.response.statusText}`
      : (e?.message || String(e));
    console.error(`✗ ${name} fout:`, msg);
    return { error: msg };
  }
}

async function main() {
  const pagespeed = await runCollector('PageSpeed', () => collectPageSpeed(url));
  const gsc = await runCollector('GSC (last 90d)', () => collectGSC(url));
  const headers = await runCollector('Headers', () => collectHeaders(url));
  const a11y = await runCollector('Accessibility (WCAG2AA)', () => collectA11y(url));
  const structuredData = await runCollector('Structured Data', () => collectStructuredData(url));
  const uptime = await runCollector('Uptime (BetterUptime)', () => collectUptime(url));
  const cookies = await runCollector('Cookies', () => collectCookies(url));
  const seoCrawl = await runCollector('SEO Crawl (free)', () => collectSeoCrawl(url, { maxPages: 50 }));
  const legal = await runCollector('Legal (cookies/GDPR)', () => collectLegalCookies(url));
  const seoExtra = await runCollector('Marketing (SEO extra)', () => collectSeoExtra(url, { maxPages: 50 }));

  const raw = { site: url, pagespeed, headers, a11y, structuredData, gsc, uptime, cookies, seoCrawl, legal, seoExtra };

  try {
    const scored = computeScores(raw, 'src/scoring/thresholds.yaml');
    const backlog = buildBacklog(raw);
    const results = { ...raw, ...scored, backlog };

    const date = format(new Date(), 'yyyyMMdd-HHmm');
    const domain = url.replace(/^https?:\/\//, '').replace(/\W+/g, '_');
    const filename = `dist/results_${domain}_${date}.json`;

    saveJson(filename, results);
    console.log(`✅ Klaar: ${filename}`);
  } catch (e) {
    console.error('❌ Scoring/opslaan fout:', e?.message || e);
    process.exit(1);
  }
}

main();
