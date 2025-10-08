import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const API = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';

/**
 * Simple sleep helper
 */
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function callPSI(fullUrl, attempt = 1) {
  const TIMEOUT_MS = 60000; // 60s
  try {
    const { data } = await axios.get(fullUrl, { timeout: TIMEOUT_MS });
    return data;
  } catch (e) {
    if (attempt >= 2) { // two attempts total
      throw e;
    }
    // exponential-ish backoff
    await sleep(1500 * attempt);
    return callPSI(fullUrl, attempt + 1);
  }
}

async function runOne(url, strategy = 'mobile') {
  const params = new URLSearchParams({
    url,
    strategy,
    category: 'performance'
  });
  if (process.env.PSI_API_KEY) params.set('key', process.env.PSI_API_KEY);
  const full = `${API}?${params.toString()}`;

  const json = await callPSI(full);
  const lh = json.lighthouseResult || {};
  return {
    strategy,
    performanceScore: lh.categories?.performance?.score ?? null,
    metrics: {
      LCP: lh.audits?.['largest-contentful-paint']?.numericValue ?? null,
      CLS: lh.audits?.['cumulative-layout-shift']?.numericValue ?? null,
      INP: lh.audits?.['experimental-interaction-to-next-paint']?.numericValue ?? null,
      TTFB: lh.audits?.['server-response-time']?.numericValue ?? null,
    }
  };
}

export async function collectPageSpeed(url) {
  // Run mobile first; desktop second (serial can reduce PSI throttling)
  const mobile = await runOne(url, 'mobile').catch(e => ({ error: e?.message || String(e) }));
  // Only try desktop if mobile succeeded
  let desktop = { error: 'skipped due to mobile error' };
  if (!mobile.error) {
    desktop = await runOne(url, 'desktop').catch(e => ({ error: e?.message || String(e) }));
  }
  return { mobile, desktop };
}
