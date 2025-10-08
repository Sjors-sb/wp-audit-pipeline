import puppeteer from 'puppeteer';

/**
 * Legal / GDPR baseline check using Puppeteer.
 * - Loads the URL without interacting with consent.
 * - Captures cookies and 3rd-party requests.
 * - Tries to detect presence of a cookie banner.
 * Returns a compact object for scoring & backlog.
 */
export async function collectLegalCookies(url) {
  const browser = await puppeteer.launch({
    args: ['--no-sandbox','--disable-setuid-sandbox'],
    headless: 'new',
  });
  const page = await browser.newPage();

  const requests = [];
  page.on('requestfinished', req => {
    try {
      const u = new URL(req.url());
      requests.push({ url: u.href, host: u.host });
    } catch {}
  });

  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    // Detect simple banners (common selectors / keywords)
    const bannerDetected = await page.evaluate(() => {
      const kw = ['cookie', 'cookies', 'privacy', 'consent', 'tracking'];
      const text = document.body.innerText.toLowerCase();
      const hasKw = kw.some(k => text.includes(k));
      const selHit = !!document.querySelector([
        '#cookie',
        '#cookies',
        '.cookie',
        '.cookies',
        '[id*="cookie"]',
        '[class*="cookie"]',
        'iframe[src*="consent"]'
      ].join(','));
      return hasKw || selHit;
    });

    const cookies = await page.cookies();

    // Heuristic vendor detection
    const VENDORS = [
      'googletagmanager.com','google-analytics.com','doubleclick.net',
      'facebook.com','connect.facebook.net','hotjar.com','clarity.ms',
      'matomo','piwik','snapads','ttq','twitter.com','linkedin.com',
      'adservice.google.com','stats.g.doubleclick.net'
    ];
    const thirdParty = requests.filter(r => VENDORS.some(v => r.host.includes(v)));

    await browser.close();
    return {
      bannerDetected,
      cookies: cookies.map(({name, domain, path, expires, httpOnly, secure, sameSite}) =>
        ({ name, domain, path, expires, httpOnly, secure, sameSite })
      ),
      thirdPartyRequests: thirdParty,
      totalRequests: requests.length
    };
  } catch (e) {
    await browser.close();
    return { error: e?.message || String(e) };
  }
}
