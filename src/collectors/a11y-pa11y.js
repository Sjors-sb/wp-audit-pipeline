import pa11y from 'pa11y';

/**
 * Runs a WCAG 2.1 AA scan using pa11y on the given URL.
 * Returns a compact list of issues.
 */
export async function collectA11y(url) {
  try {
    const result = await pa11y(url, {
      standard: 'WCAG2AA',
      timeout: 30000,
      includeNotices: true,
      includeWarnings: true
    });

    const issues = (result.issues || []).map(i => ({
      type: i.type,               // error | warning | notice
      code: i.code,               // WCAG rule / axe code
      message: i.message,
      selector: i.selector
    }));

    const severities = {
      error: issues.filter(i => i.type === 'error').length,
      warning: issues.filter(i => i.type === 'warning').length,
      notice: issues.filter(i => i.type === 'notice').length
    };

    return { total: issues.length, severities, issues };
  } catch (e) {
    return { error: e?.message || String(e) };
  }
}
