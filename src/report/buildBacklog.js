// src/report/buildBacklog.js
/**
 * Zet ruwe audit-resultaten om naar een geprioriteerde backlog.
 * Formaat:
 * [
 *   { id, title, why, impact, how, owner, priority, chapter, tags }
 * ]
 *
 * Prioriteiten:
 * - P1 = basis/veiligheid/wet → direct
 * - P2 = prestatie/SEO die merkbaar effect heeft
 * - P3 = nice-to-have of na basis
 */
export function buildBacklog(raw) {
  const items = [];
  const add = (partial) => items.push({
    owner: 'Dev',
    tags: [],
    ...partial,
  });

  // -------- Veiligheid --------
  const missing = raw.headers?.missing || [];
  if (missing.includes('content-security-policy')) {
    add({
      id: 'sec_csp',
      title: 'Voeg Content-Security-Policy (CSP) header toe',
      why: 'CSP voorkomt XSS en mitigates clickjacking/inline scripts. Ontbreekt nu.',
      impact: 'Verkleint aanvalsoppervlak; voldoet aan best practices security headers.',
      how: 'Start met een report-only policy, whitelist eigen domeinen/CDN, en zet na validatie enforce modus. Voorbeeld:
' +
           "default-src 'self'; img-src 'self' data: https:; script-src 'self' https://www.googletagmanager.com 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https:; connect-src 'self' https:; frame-ancestors 'self'; base-uri 'self';",
      priority: 'P1',
      chapter: 'Veiligheid',
      tags: ['headers','csp']
    });
  }

  if (!raw.headers?.ipv6) {
    add({
      id: 'sec_ipv6',
      title: 'Activeer IPv6 voor het hoofddomein',
      why: 'Beter bereik/latency en moderne netwerk-compatibiliteit.',
      impact: 'Performance en betrouwbaarheid wereldwijd.',
      how: 'Voeg AAAA records toe in DNS, zorg dat hosting IPv6 ondersteunt.',
      priority: 'P2',
      chapter: 'Veiligheid',
      tags: ['ipv6','dns']
    });
  }

  // -------- Legal / Cookies --------
  if (raw.cookies?.error) {
    add({
      id: 'legal_cookie_scan_fail',
      title: 'Herstel cookie scan (Puppeteer) – site niet geladen of geblokkeerd',
      why: 'Automatische legal-check faalt; geen betrouwbaar beeld van tracking/cookies.',
      impact: 'Onzekerheid over AVG/CMP naleving.',
      how: 'Controleer blocking/anti-bot, laad homepage zonder interactie, draai scan opnieuw.',
      priority: 'P1',
      chapter: 'Legal',
      tags: ['cookies','cmp']
    });
  } else {
    const third = raw.cookies?.thirdPartyRequests?.length || 0;
    if (third > 0) {
      add({
        id: 'legal_consent_blocking',
        title: 'Zorg dat 3rd‑party scripts pas laden na consent (CMP)',
        why: `Er zijn ${third} third‑party calls gedetecteerd voor consent.`,
        impact: 'AVG naleving, boete‑risico reductie, dataminimalisatie.',
        how: 'Implementeer Consent Mode (v2) in GTM. Zet alle marketingtags achter consent triggers; blokkeer default zonder toestemming.',
        priority: 'P1',
        chapter: 'Legal',
        tags: ['cmp','gtm','consent-mode']
      });
    }
    const first = raw.cookies?.cookies?.length || 0;
    if (first > 10) {
      add({
        id: 'legal_cookie_hygiëne',
        title: 'Verminder aantal first‑party cookies (>10 gedetecteerd)',
        why: 'Onnodig veel cookies kunnen onder AVG onderbouwd moeten worden.',
        impact: 'Betere compliance en minder data-opslag.',
        how: 'Opschonen legacy cookies, reduceer expiries, bundel voorkeuren in 1 cookie.',
        priority: 'P2',
        chapter: 'Legal',
        tags: ['cookies']
      });
    }
  }

  // -------- Techniek / Performance --------
  const mobile = raw.pagespeed?.mobile?.performanceScore ?? null;
  const desktop = raw.pagespeed?.desktop?.performanceScore ?? null;
  const LCP = raw.pagespeed?.mobile?.metrics?.LCP ?? raw.pagespeed?.desktop?.metrics?.LCP ?? null;

  if (mobile !== null && mobile < 0.5) {
    add({
      id: 'perf_mobile_lcp',
      title: 'Verlaag LCP op mobiel (hero-media & critical CSS)',
      why: `Mobiele Lighthouse score ${mobile}; LCP ~${Math.round((LCP||0)/100)/10}s.`,
      impact: 'Snellere laadtijd → hogere conversie en SEO ranking.',
      how: 'Optimaliseer hero-afbeelding (WebP/AVIF, dimensions), preload critical assets, reduceer render-blocking, gebruik lazy‑loading voor onder‑the‑fold media, zet edge‑cache/CDN.',
      priority: 'P2',
      chapter: 'Techniek',
      tags: ['lcp','images','critical-css']
    });
  }

  // -------- Marketing / GSC --------
  if (raw.gsc?.error) {
    add({
      id: 'gsc_access',
      title: 'Geef service account toegang tot GSC property',
      why: 'GSC-data ontbreekt → geen trendinzichten en indexatie-signalen.',
      impact: 'Minder zicht op organische performance.',
      how: 'Voeg het service account mailadres toe als gebruiker (Volledig) op domain/url‑prefix property.',
      priority: 'P1',
      chapter: 'Marketing',
      tags: ['gsc','api']
    });
  } else {
    if (raw.gsc?.trend === 'down') {
      add({
        id: 'gsc_trend_down',
        title: 'Herstel organische trend (content & tech)',
        why: 'GSC trend: down (laatste 90 dagen).',
        impact: 'Meer organisch verkeer op middellange termijn.',
        how: 'Verbeter E-E-A-T, interne links, update top 10 landingspagina’s, fix 404/redirects, optimaliseer titles/meta.',
        priority: 'P2',
        chapter: 'Marketing',
        tags: ['seo','content']
      });
    }
    if (raw.structuredData && !raw.structuredData.found) {
      add({
        id: 'seo_schema',
        title: 'Voeg passende structured data toe',
        why: 'Geen schema gedetecteerd; rich results kansen onbenut.',
        impact: 'Hogere CTR in SERP; betere context voor zoekmachines.',
        how: 'Implementeer JSON-LD per paginatype (Organization, WebSite, Article/Product/FAQ). Valideer met Rich Results Test.',
        priority: 'P2',
        chapter: 'Marketing',
        tags: ['schema','seo']
      });
    }
  }

  // -------- Uptime --------
  if (raw.uptime?.error) {
    add({
      id: 'uptime_monitoring',
      title: 'Koppel site aan Better Uptime/Pingdom monitor',
      why: 'Geen monitor gevonden of API key ontbreekt.',
      impact: 'Snellere detectie van storingen, SLA‑borging.',
      how: 'Maak HTTP monitor voor de homepage aan; zet alerts naar support‑mail/Slack.',
      priority: 'P2',
      chapter: 'Techniek',
      tags: ['uptime','monitoring']
    });
  } else if (raw.uptime?.status && raw.uptime.status !== 'up') {
    add({
      id: 'uptime_incidents',
      title: 'Analyseer recente incidenten en herstel oorzaak',
      why: `Monitor status: ${raw.uptime.status}.`,
      impact: 'Minder downtime, hogere betrouwbaarheid.',
      how: 'Controleer logs/hosting; zet healthchecks en auto‑restarts; verhoog alerting.',
      priority: 'P1',
      chapter: 'Techniek',
      tags: ['incidents','sla']
    });
  }

  // -------- Cleanup & volgorde --------
  const priorityOrder = { P1: 1, P2: 2, P3: 3 };
  items.sort((a, b) => {
    const p = (priorityOrder[a.priority] || 9) - (priorityOrder[b.priority] || 9);
    if (p !== 0) return p;
    return (a.chapter || '').localeCompare(b.chapter || '');
  });

  return items;
}
