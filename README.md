# WP Audit Starter (Single-site)

Minimale set om **één** JSON → **één** HTML-rapport te genereren. Later uitbreiden naar multi-site.

## Structuur
```
wp-audit-starter/
├─ audit/
│  └─ thresholds.yaml
├─ data/
│  └─ audit.json
├─ public/
│  └─ report.css
├─ scripts/
│  └─ generate-report.js
└─ package.json
```

## Installatie
```bash
npm init -y
npm i js-yaml
```

## Gebruik
1. Vul/overschrijf `data/audit.json` met jullie actuele resultaten.
2. Pas indien nodig `audit/thresholds.yaml` aan voor kleurgrenzen.
3. Genereer het rapport:
   ```bash
   node scripts/generate-report.js
   ```
4. Bekijk het resultaat in `dist/report.html` (commit dit in je repo of publiceer via je CI).

## JSON-schema (kort)
`data/audit.json` voorbeeld staat meegeleverd (datum: 2025-10-09). Belangrijkste velden:
- `site.name`, `site.url`
- `auditDate` (YYYY-MM-DD)
- `brand.logo`, `brand.fontFamily`, `brand.brandColor`, `brand.ctaColor`
- `scores.performance`, `mobile_performance`, `seo`, `accessibility`, `best_practices` (0-100)
- `checks.plugins.total`, `outdated`, `inactive`
- `checks.uptime.last30d` (percentage), `incidents`, `provider`
- `checks.wcag[]` met `criterion` en `status` (`pass|warn|fail`)

## Uitbreidingspad (later)
- Multi-site: map `data/sites/*.json` → meerdere HTML’s.
- PowerPoint export (bijv. via `puppeteer`/`reveal.js` of server-side slide generator).
- Automatische data-inname vanuit jullie tooling (CI job).


---

## Eén commando voor de hele flow
Voer dit uit in de projectmap:
```bash
npm i
node scripts/run-all.js --siteName "Voorbeeldsite" --siteUrl "https://www.voorbeeld.nl"
```
Dit zal collectors draaien → partials mergen → `data/audit.json` schrijven → `dist/report.html` genereren.

### Collectors (plug-in laag)
Zet je eigen dataverzameling als Node-scripts in `scripts/collectors/`. Iedere `.js` in die map wordt automatisch uitgevoerd.
Laat elke collector een partial JSON wegschrijven naar `data/partials/*.json` met één of meer van de keys:
`site`, `brand`, `scores`, `checks`, `notes`.

Voorbeeldcollector staat toegevoegd in:
- `scripts/collectors/scores.js`
- `scripts/collectors/wp.js`

---

## CI (GitHub Actions) voorbeeld
`.github/workflows/audit.yml` draait de flow en uploadt `dist/report.html` als artifact.

