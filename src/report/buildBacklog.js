export function buildBacklog(data) {
  const items = [];

  if ((data.headers.missing || []).length) {
    items.push({
      title: 'Security headers configureren (HSTS, CSP, X-Frame-Options, etc.)',
      why: 'Vermindert XSS/Clickjacking/MiTM risico; betere veiligheidsbeoordeling.',
      impact: 'High', effort: 'Low', priority: 'P1'
    });
  }
  if (!data.structuredData.found) {
    items.push({
      title: 'Structured data toevoegen (Org/WebSite/Product/Article)',
      why: 'Grotere kans op rich results en hogere CTR in Google.',
      impact: 'Medium', effort: 'Low', priority: 'P1'
    });
  }
  if ((data.pagespeed.mobile?.performanceScore ?? 1) < 0.6) {
    items.push({
      title: 'Mobiele performance verbeteren (LCP, TTFB, INP)',
      why: 'Betere Core Web Vitals → hogere gebruikers- en SEO-score.',
      impact: 'High', effort: 'Medium', priority: 'P2'
    });
  }

  items.push({
    title: 'Cookie consent blokkeren vóór tracking (CMP configureren)',
    why: 'AVG-compliance, juiste dataverzameling met Consent Mode.',
    impact: 'High', effort: 'Low', priority: 'P1'
  });

  return items;
}
