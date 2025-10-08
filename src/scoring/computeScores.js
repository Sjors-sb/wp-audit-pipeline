import fs from 'fs';
import yaml from 'js-yaml';

export function colorFromScore(s) {
  if (s >= 9) return 'groen';
  if (s >= 7.5) return 'geel';
  if (s >= 5.0) return 'oranje';
  return 'rood';
}

export function computeScores(data, thresholdsPath) {
  const config = yaml.load(fs.readFileSync(thresholdsPath, 'utf8'));

  const mob = data.pagespeed.mobile?.performanceScore ?? 0;
  const desk = data.pagespeed.desktop?.performanceScore ?? 0;
  const perf10 = ((mob + desk) / 2) * 10;

  const headersPresent = Object.keys(data.headers.present || {}).length;
  const headersRatio = Math.min(headersPresent / 12, 1) * 10;

  const techScore = Number(((perf10 * 0.7) + (headersRatio * 0.3)).toFixed(1));

  const missing = data.headers.missing?.length ?? 0;
  const secScore = Number((Math.max(0, 10 - missing * 1.5)).toFixed(1));

  const legalScore = 5.0;

  const vio = data.a11y.summary?.violations ?? 0;
  const uxScore = Number(Math.max(0, 10 - vio * 1.2).toFixed(1));

  const sd = data.structuredData.found ? 8.0 : 5.0;
  const marketingScore = sd;

  const scores = {
    techniek: techScore,
    veiligheid: secScore,
    legal: legalScore,
    gebruikersvriendelijkheid: uxScore,
    marketing: marketingScore
  };

  const colors = Object.fromEntries(
    Object.entries(scores).map(([k, v]) => [k, colorFromScore(v)])
  );

  return { scores, colors };
}
