import fs from 'fs';
import yaml from 'js-yaml';

/**
 * Compute chapter scores (0–10) based on collected raw results.
 * thresholds.yaml kan extra drempels bevatten voor techniek/marketing etc.
 */
export function computeScores(raw, thresholdsFile) {
  let thresholds = {};
  try {
    thresholds = yaml.load(fs.readFileSync(thresholdsFile, 'utf8'));
  } catch {
    console.warn('⚠ thresholds.yaml niet gevonden, gebruik defaults');
  }

  const scores = {};

  // ------------------ TECHNIEK ------------------
  const mobile = raw.pagespeed?.mobile?.performanceScore ?? 0;
  const desktop = raw.pagespeed?.desktop?.performanceScore ?? 0;
  const perf = Math.round(((mobile + desktop) / 2) * 10);

  scores.techniek = {
    score: perf,
    color: perf >= 7 ? 'green' : perf >= 4 ? 'orange' : 'red'
  };

  // ------------------ VEILIGHEID ------------------
  let securityScore = 10;
  if (raw.headers?.missing?.includes('content-security-policy')) {
    securityScore -= 3;
  }
  if (!raw.headers?.ipv6) {
    securityScore -= 2;
  }
  if (securityScore < 0) securityScore = 0;

  scores.veiligheid = {
    score: securityScore,
    color: securityScore >= 8 ? 'green' : securityScore >= 5 ? 'orange' : 'red'
  };

  // ------------------ LEGAL ------------------
  let legalScore = 9;
  if (raw.cookies?.error) {
    legalScore = 6;
  } else {
    const thirdParty = raw.cookies?.thirdPartyRequests?.length || 0;
    const firstParty = raw.cookies?.cookies?.length || 0;
    if (thirdParty > 5 || firstParty > 10) legalScore = 4;
    else if (thirdParty > 0) legalScore = 6;
    else legalScore = 9;
  }

  scores.legal = {
    score: legalScore,
    color: legalScore >= 8 ? 'green' : legalScore >= 5 ? 'orange' : 'red'
  };

  // ------------------ GEBRUIKSVRIENDELIJKHEID ------------------
  let a11yScore = 7;
  if (raw.a11y?.error) {
    a11yScore = 7;
  } else {
    const total = raw.a11y?.total || 0;
    if (total === 0) a11yScore = 10;
    else if (total <= 10) a11yScore = 7;
    else a11yScore = 3;
  }

  scores.gebruikersvriendelijkheid = {
    score: a11yScore,
    color: a11yScore >= 8 ? 'green' : a11yScore >= 5 ? 'orange' : 'red'
  };

  // ------------------ MARKETING ------------------
  let marketingScore = 7;
  if (raw.gsc?.error) {
    marketingScore = 6;
  } else if (raw.gsc?.trend === 'up') {
    marketingScore = 8;
  } else if (raw.gsc?.trend === 'down') {
    marketingScore = 5;
  }
  // structured data aanwezig?
  if (!raw.structuredData?.found) marketingScore -= 2;
  if (marketingScore < 0) marketingScore = 0;

  scores.marketing = {
    score: marketingScore,
    color: marketingScore >= 8 ? 'green' : marketingScore >= 5 ? 'orange' : 'red'
  };

  return { scores };
}
