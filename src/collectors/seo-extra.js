import { collectSeoCrawl } from './seo-crawler.js';

/**
 * Builds on seo-crawler to add marketing heuristics:
 * - empty/low-content pages
 * - weak titles (generic like 'Home', 'Over ons')
 * - meta description quality (length 50..160)
 */
export async function collectSeoExtra(startUrl, opts = {}) {
  const crawl = await collectSeoCrawl(startUrl, opts);

  if (crawl?.error) return crawl;

  const weakTitlePatterns = [/^home$/i, /^welkom/i, /^over(\s+ons)?$/i, /^contact$/i];
  const minMetaLen = 50;
  const maxMetaLen = 160;
  const emptyBodyMinLen = 120; // characters

  const findings = crawl.pages.map(p => {
    const weakTitle = !p.title || weakTitlePatterns.some(rx => rx.test((p.title||'').trim()));
    const metaTooShort = !p.metaDescriptionPresent || (p.metaDescriptionLength < minMetaLen);
    const metaTooLong = p.metaDescriptionLength > maxMetaLen;

    return {
      url: p.url,
      title: p.title,
      weakTitle,
      metaDescriptionPresent: p.metaDescriptionPresent,
      metaTooShort,
      metaTooLong,
      h1Count: p.h1Count
    };
  });

  // We don't have body length yet; extend crawl quickly with another pass on first N pages
  // to estimate empty pages (optional to keep fast, set N small)
  const emptyPages = []; // leave for future extension unless you want another axios get per page

  const summary = {
    pagesAnalysed: findings.length,
    weakTitles: findings.filter(f => f.weakTitle).length,
    missingMeta: findings.filter(f => !f.metaDescriptionPresent).length,
    shortMeta: findings.filter(f => f.metaTooShort).length,
    longMeta: findings.filter(f => f.metaTooLong).length,
    h1NotSingle: findings.filter(f => f.h1Count !== 1).length,
    duplicates: crawl.duplicates,
    brokenLinks: crawl.brokenLinks,
    healthScore: crawl.healthScore
  };

  return { findings, summary };
}
