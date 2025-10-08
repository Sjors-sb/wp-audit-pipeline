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

// ---- CLI args verwerken ------------------------------------------------------
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

// ---- Helper: collectors met logging -----------------------------------------
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

// ---- Main --------------------------------------------------------------------
async function main() {
  // Collect
  const pagespeed = await runCollector('PageSpeed', () => collectPageSpeed(url));
  console.log('Pagespeed result (short):', {
    mobileScore: pagespeed?.mobile?.performanceScore,
    desktopScore: pagespeed?.desktop?.performanceScore,
    error: pagespeed?.error
  });

  const gsc = await runCollector('GSC (last 90d)', () => collectGSC(url));

  const headers = await runCollector('Headers', () => collectHeaders(url));
  console.log('Headers missing:', headers?.missing);

  const a11y = await runCollector('Accessibility (WCAG2AA)', () => collectA11y(url));
  console.log('WCAG issues:', a11y?.total);

  const structuredData = await runCollector('Structured Data', () => collectStructuredData(url));
  console.log('Structured data found/items:', structuredData?.found, structuredData?.items?.length || 0);

  const uptime = await runCollector('Uptime (BetterUptime)', () => collectUptime(url));
  console.log('Uptime status:', uptime?.status);

  const cookies = await runCollector('Cookies', () => collectCookies(url));
  console.log('Cookies found:', cookies?.cookies?.length, '3rd-party:', cookies?.thirdPartyRequests?.length);

  // Alles verzamelen in raw
  const raw = { site: url, pagespeed, headers, a11y, structuredData, gsc, uptime, cookies };

  // Score + backlog
  try {
    const scored = computeScores(raw, 'src/scoring/thresholds.yaml');
    const backlog = buildBacklog(raw);
    const results = { ...raw, ...scored, backlog };

    // Bestandsnaam met domein + datumstempel
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
