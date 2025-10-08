import { google } from 'googleapis';
import dotenv from 'dotenv';
dotenv.config();

/**
 * GSC Search Analytics met service account.
 * Geen vaste GSC_SITE_URL nodig: we leiden de property af van de ingevoerde URL.
 * - Probeert eerst domain property:  sc-domain:<host>
 * - Valt terug op url-prefix:       https://<host>/
 * Je kunt nog steeds GSC_SITE_URL zetten om te overriden.
 */
export async function collectGSC(inputUrl) {
  const clientEmail = process.env.GSC_CLIENT_EMAIL;
  let privateKey = process.env.GSC_PRIVATE_KEY;

  if (!clientEmail || !privateKey) {
    return { error: 'Missing GSC env (GSC_CLIENT_EMAIL, GSC_PRIVATE_KEY)' };
  }
  if (privateKey.includes('\\n') && !privateKey.includes('\n')) {
    privateKey = privateKey.replace(/\\n/g, '\n');
  }

  let siteOverride = process.env.GSC_SITE_URL; // optioneel
  let host = null;
  try { host = new URL(inputUrl).hostname; } catch { /* noop */ }

  const candidates = [];
  if (siteOverride) candidates.push(siteOverride);
  if (host) {
    candidates.push(`sc-domain:${host}`);                 // domain property
    candidates.push(`https://${host}/`);                  // url-prefix property
  }

  const jwt = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
  });
  const webmasters = google.webmasters({ version: 'v3', auth: jwt });

  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 90);
  const dateToStr = (d) => d.toISOString().slice(0,10);

  async function query(siteUrl) {
    const { data } = await webmasters.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate: dateToStr(start),
        endDate: dateToStr(end),
        dimensions: ['date'],
        rowLimit: 25000,
      },
    });
    const rows = data.rows || [];
    const totalClicks = rows.reduce((s, r) => s + (r.clicks || 0), 0);
    const totalImpr   = rows.reduce((s, r) => s + (r.impressions || 0), 0);
    const avgCtr      = rows.length ? (rows.reduce((s, r) => s + (r.ctr || 0), 0) / rows.length) : 0;
    const firstHalf   = rows.slice(0, Math.floor(rows.length/2));
    const secondHalf  = rows.slice(Math.floor(rows.length/2));
    const clicks1     = firstHalf.reduce((s, r) => s + (r.clicks || 0), 0);
    const clicks2     = secondHalf.reduce((s, r) => s + (r.clicks || 0), 0);
    const trend       = clicks2 > clicks1 * 1.05 ? 'up' : (clicks2 < clicks1 * 0.95 ? 'down' : 'flat');
    return { siteUrl, periodDays: rows.length, totals: { clicks: totalClicks, impressions: totalImpr, avgCtr }, trend, sample: rows.slice(-14) };
  }

  // Probeer in volgorde tot er eentje werkt
  const errors = [];
  for (const site of candidates) {
    try { return await query(site); }
    catch (e) { errors.push({ site, error: e?.response?.data?.error?.message || e?.message || String(e) }); }
  }

  return { error: 'No accessible GSC property for this URL', tried: errors };
}
