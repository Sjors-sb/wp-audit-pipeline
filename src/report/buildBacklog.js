export function buildBacklog(raw) {
  const backlog = [];

  // Content Security Policy
  if (!raw.headers?.contentSecurityPolicy) {
    backlog.push({
      id: 'security_csp',
      title: 'Voeg Content-Security-Policy header toe',
      why: 'Beschermt tegen XSS en andere aanvallen.',
      how: `
Start met een report-only policy.
Whitelist alleen eigen domeinen/CDN.
Zet daarna na validatie in force modus.
Voorbeeld:
Content-Security-Policy: default-src 'self'
      `,
      severity: 'high',
    });
  }

  // Permissions Policy
  if (!raw.headers?.permissionsPolicy) {
    backlog.push({
      id: 'security_permissions',
      title: 'Voeg Permissions-Policy header toe',
      why: 'Beperk toegang tot features zoals camera, geolocatie, microfoon.',
      how: `
Bepaal welke features je site nodig heeft.
Schakel de rest uit met de Permissions-Policy header.
Voorbeeld:
Permissions-Policy: geolocation=(), camera=()
      `,
      severity: 'medium',
    });
  }

  // Accessibility voorbeeld
  if (raw.a11y?.summary?.violations > 0) {
    backlog.push({
      id: 'a11y_issues',
      title: 'Los toegankelijkheidsproblemen (WCAG) op',
      why: 'Verbeter gebruikservaring en voldoe aan wetgeving (WCAG 2.1 AA).',
      how: 'Zie lijst met gevonden WCAG-issues in het auditrapport en los deze stapsgewijs op.',
      severity: 'high',
    });
  }

  return backlog;
}
