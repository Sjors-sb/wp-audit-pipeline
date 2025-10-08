import fs from 'fs';
import yaml from 'js-yaml';

export function computeScores(raw, thresholdsFile) {
  let thresholds = {};
  try {
    thresholds = yaml.load(fs.readFileSync(thresholdsFile, 'utf8'));
  } catch {
    console.warn('⚠ thresholds.yaml niet gevonden, gebruik defaults');
  }

  const scores = {};

  // Techniek
  const mobile = raw.pagespeed?.mobile?.performanceScore ?? 0;
  const desktop = raw.pagespeed?.desktop?.performanceScore ?? 0;
  const perfRaw = (mobile + desktop) / 2;
  const perf = Math.round(perfRaw * 10);
  const perfGreen = thresholds?.techniek?.performance?.green ?? 0.7;
  const perfOrange = thresholds?.techniek?.performance?.orange ?? 0.4;
  let techniekColor = 'red';
  if (perfRaw >= perfGreen) techniekColor = 'green';
  else if (perfRaw >= perfOrange) techniekColor = 'orange';
  scores.techniek = { score: perf, color: techniekColor };

  // Veiligheid
  let securityScore = 10;
  if (thresholds?.veiligheid?.require_csp && raw.headers?.missing?.includes('content-security-policy')) {
    securityScore -= 3;
  }
  if (thresholds?.veiligheid?.ipv6_required && !raw.headers?.ipv6) {
    securityScore -= 2;
  }
  if (securityScore < 0) securityScore = 0;
  scores.veiligheid = {
    score: securityScore,
    color: securityScore >= 8 ? 'green' : securityScore >= 5 ? 'orange' : 'red'
  };

  // Legal
  let legalScore = 9;
  if (raw.cookies?.error) {
    legalScore = 6;
  } else {
    const thirdParty = raw.cookies?.thirdPartyRequests?.length || 0;
    const firstParty = raw.cookies?.cookies?.length || 0;
    const maxGreenTP = thresholds?.legal?.third_party_max_green ?? 0;
    const maxOrangeTP = thresholds?.legal?.third_party_max_orange ?? 5;
    const maxGreenFP = thresholds?.legal?.first_party_max_green ?? 10;
    if (thirdParty > maxOrangeTP || firstParty > maxGreenFP) legalScore = 4;
    else if (thirdParty > maxGreenTP) legalScore = 6;
    else legalScore = 9;
  }
  scores.legal = {
    score: legalScore,
    color: legalScore >= 8 ? 'green' : legalScore >= 5 ? 'orange' : 'red'
  };

  // Gebruikersvriendelijkheid
  let a11yScore = 7;
  if (raw.a11y?.error) {
    a11yScore = 7;
  } else {
    const total = raw.a11y?.total || 0;
    const maxGreen = thresholds?.gebruikersvriendelijkheid?.a11y_issues_green ?? 0;
    const maxOrange = thresholds?.gebruikersvriendelijkheid?.a11y_issues_orange ?? 10;
    if (total <= maxGreen) a11yScore = 10;
    else if (total <= maxOrange) a11yScore = 7;
    else a11yScore = 3;
  }
  scores.gebruikersvriendelijkheid = {
    score: a11yScore,
    color: a11yScore >= 8 ? 'green' : a11yScore >= 5 ? 'orange' : 'red'
  };

  // Marketing
  let marketingScore = 7;
  // GSC trend weging
  if (raw.gsc?.error) {
    marketingScore = 6;
  } else {
    const bonus = thresholds?.marketing?.trend_up_bonus ?? 2;
    const penalty = thresholds?.marketing?.trend_down_penalty ?? -2;
    if (raw.gsc?.trend === 'up') marketingScore += bonus;
    else if (raw.gsc?.trend === 'down') marketingScore += penalty;
  }
  // Structured data
  if (thresholds?.marketing?.require_structured_data && !raw.structuredData?.found) {
    marketingScore -= 2;
  }
  // SEO crawl influence (free)
  const crawlHealth = raw.seoCrawl?.healthScore ?? null;
  const broken = raw.seoCrawl?.brokenLinks?.length ?? null;
  const crawlGreen = thresholds?.seo?.crawl_health?.green ?? 8;
  const crawlOrange = thresholds?.seo?.crawl_health?.orange ?? 6;
  const brokenGreen = thresholds?.seo?.broken_links?.green ?? 0;
  const brokenOrange = thresholds?.seo?.broken_links?.orange ?? 10;

  if (crawlHealth !== null) {
    if (crawlHealth >= crawlGreen) marketingScore += 1;
    else if (crawlHealth >= crawlOrange) marketingScore += 0;
    else marketingScore -= 1;
  }
  if (broken !== null) {
    if (broken > brokenOrange) marketingScore -= 2;
    else if (broken > brokenGreen) marketingScore -= 1;
  }

  if (marketingScore < 0) marketingScore = 0;
  if (marketingScore > 10) marketingScore = 10;
  scores.marketing = {
    score: marketingScore,
    color: marketingScore >= 8 ? 'green' : marketingScore >= 5 ? 'orange' : 'red'
  };

  return { scores };
}
