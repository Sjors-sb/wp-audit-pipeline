// Basic SEO crawler: crawls same-origin pages, checks titles, meta descriptions, H1s, and broken links.
import axios from 'axios';
import * as cheerio from 'cheerio';

/**
 * Crawl up to `maxPages` on the same origin and compute simple SEO signals.
 * - Missing/duplicate <title>
 * - Missing meta description
 * - H1 count per page
 * - Broken internal links (limited check per page to keep it fast)
 */
export async function collectSeoCrawl(startUrl, { maxPages = 50, perPageLinkChecks = 20 } = {}) {
  const origin = new URL(startUrl).origin;
  const queue = [startUrl];
  const visited = new Set();
  const pages = [];
  const brokenLinksSet = new Set();

  async function fetchHtml(url) {
    const res = await axios.get(url, { timeout: 20000, maxRedirects: 5, validateStatus: () => true });
    return { status: res.status, html: res.data, finalUrl: res.request?.res?.responseUrl || url };
  }

  function toAbsLink(base, href) {
    try {
      if (!href) return null;
      // ignore mailto/tel/javascript
      if (/^(mailto:|tel:|javascript:)/i.test(href)) return null;
      const abs = new URL(href, base).toString().split('#')[0];
      return abs;
    } catch { return null; }
  }

  function sameOrigin(url) {
    try { return new URL(url).origin === origin; }
    catch { return false; }
  }

  while (queue.length && visited.size < maxPages) {
    const url = queue.shift();
    if (!url || visited.has(url)) continue;
    visited.add(url);

    try {
      const { status, html, finalUrl } = await fetchHtml(url);
      if (status >= 400) {
        brokenLinksSet.add(`${url} → HTTP ${status}`);
        continue;
      }

      const $ = cheerio.load(html);
      const title = ($('title').first().text() || '').trim();
      const metaDesc = ($('meta[name="description"]').attr('content') || '').trim();
      const h1Count = $('h1').length;

      // Extract links
      const rawLinks = $('a[href]').map((_, a) => $(a).attr('href')).get();
      const absLinks = rawLinks
        .map(h => toAbsLink(finalUrl, h))
        .filter(Boolean);

      // Enqueue new same-origin pages
      for (const l of absLinks) {
        if (sameOrigin(l) && !visited.has(l) && !queue.includes(l)) queue.push(l);
      }

      // Broken link spot-check (limit per page to keep it fast)
      const toCheck = absLinks.slice(0, perPageLinkChecks);
      await Promise.allSettled(toCheck.map(async (l) => {
        try {
          const r = await axios.head(l, { timeout: 15000, validateStatus: () => true });
          if (r.status >= 400) brokenLinksSet.add(`${l} → HTTP ${r.status}`);
        } catch (e) {
          brokenLinksSet.add(`${l} → ${e?.message || 'request error'}`);
        }
      }));

      pages.push({
        url: finalUrl,
        title,
        metaDescriptionPresent: !!metaDesc,
        metaDescriptionLength: metaDesc.length,
        h1Count
      });
    } catch (e) {
      brokenLinksSet.add(`${url} → ${e?.message || 'fetch error'}`);
    }
  }

  // Duplicate titles
  const titleMap = new Map();
  for (const p of pages) {
    const key = (p.title || '').toLowerCase();
    titleMap.set(key, (titleMap.get(key) || 0) + 1);
  }
  const duplicates = Array.from(titleMap.entries())
    .filter(([, count]) => count > 1)
    .map(([title]) => title)
    .filter(t => t);

  // Aggregate
  const missingTitles = pages.filter(p => !p.title).length;
  const missingMetas = pages.filter(p => !p.metaDescriptionPresent).length;
  const manyH1Issues = pages.filter(p => p.h1Count !== 1).length;
  const brokenLinks = Array.from(brokenLinksSet);

  // Simple health score (0-10)
  let health = 10;
  health -= Math.min(3, Math.floor(missingTitles / 5));   // -1 per 5 pages missing titles
  health -= Math.min(3, Math.floor(missingMetas / 5));
  health -= Math.min(3, Math.floor(brokenLinks.length / 10));
  if (duplicates.length > 3) health -= 2;
  if (manyH1Issues > 5) health -= 1;
  if (health < 0) health = 0;

  return {
    crawledPages: pages.length,
    pages,
    duplicates,
    missingTitles,
    missingMetas,
    manyH1Issues,
    brokenLinks,
    healthScore: health
  };
}
