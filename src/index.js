import 'dotenv/config';
import { saveJson } from './utils/saveJson.js';
import { collectPageSpeed } from './collectors/pagespeed.js';
import { collectHeaders } from './collectors/headers.js';
import { collectA11y } from './collectors/a11y-axe.js';
import { collectStructuredData } from './collectors/structuredData.js';
import { computeScores } from './scoring/computeScores.js';
import { buildBacklog } from './report/buildBacklog.js';

const args = Object.fromEntries(process.argv.slice(2).map(a => a.split('=')));
const url = (args['--url'] || args.url);
if (!url) {
  console.error('Gebruik: npm run audit -- --url=https://voorbeeld.nl');
  process.exit(1);
}

console.log('▶ Audit start:', url);

async function main() {
  const [pagespeed, headers, a11y, structuredData] = await Promise.all([
    collectPageSpeed(url).catch(e => ({ error: e.message })),
    collectHeaders(url).catch(e => ({ error: e.message, present: {}, missing: [] })),
    collectA11y(url).catch(e => ({ error: e.message })),
    collectStructuredData(url).catch(e => ({ error: e.message, found: false, items: [] }))
  ]);

  const raw = { site: url, pagespeed, headers, a11y, structuredData };
  const scored = computeScores(raw, 'src/scoring/thresholds.yaml');
  const backlog = buildBacklog(raw);

  const results = { ...raw, ...scored, backlog };
  saveJson('dist/results.json', results);
  console.log('✅ Klaar: dist/results.json');
}

main();
