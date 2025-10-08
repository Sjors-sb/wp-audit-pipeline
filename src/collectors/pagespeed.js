import { fetchJson } from '../utils/fetchJson.js';
import dotenv from 'dotenv';
dotenv.config();

const API = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';

async function runOne(url, strategy = 'mobile') {
  const params = new URLSearchParams({
    url,
    strategy,
    category: 'performance',
  });
  if (process.env.PSI_API_KEY) params.set('key', process.env.PSI_API_KEY);
  const full = `${API}?${params.toString()}`;
  const json = await fetchJson(full);
  const lighthouse = json.lighthouseResult || {};
  return {
    strategy,
    performanceScore: lighthouse.categories?.performance?.score ?? null,
    metrics: {
      LCP: lighthouse.audits?.['largest-contentful-paint']?.numericValue ?? null,
      CLS: lighthouse.audits?.['cumulative-layout-shift']?.numericValue ?? null,
      INP: lighthouse.audits?.['experimental-interaction-to-next-paint']?.numericValue ?? null,
      TTFB: lighthouse.audits?.['server-response-time']?.numericValue ?? null,
    }
  };
}

export async function collectPageSpeed(url) {
  const [mobile, desktop] = await Promise.all([
    runOne(url, 'mobile'),
    runOne(url, 'desktop')
  ]);
  return { mobile, desktop };
}
