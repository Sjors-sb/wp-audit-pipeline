import puppeteer from 'puppeteer';

/**
 * Basic cookie & tracking scan:
 * - loads the page without interacting with any banners
 * - collects document cookies (first party) and observed requests (3rd party)
 * This is a baseline for Legal/CMP checks.
 */
export async function collectCookies(url) {
  const browser = await puppeteer.launch({
    args: ['--no-sandbox','--disable-setuid-sandbox'],
    headless: 'new',
  });
  const page = await browser.newPage();

  const requests = [];
  page.on('requestfinished', req => {
    try {
      const u = new URL(req.url());
      requests.push({ url: u.href, host: u.host, initiator: req.initiator()?.type || 'unknown' });
    } catch {}
  });

  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    const cookies = await page.cookies();

    const vendors = ['googletagmanager.com','google-analytics.com','doubleclick.net','facebook.com','hotjar.com','clarity.ms','matomo','piwik'];
    const thirdParty = requests.filter(r => vendors.some(v => r.host.includes(v)));

    await browser.close();
    return {
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
