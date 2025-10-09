#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const outDir = path.join(process.cwd(), 'data', 'partials');
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, 'wp.json');

const payload = {
  checks: {
    plugins: { total: 22, outdated: 3, inactive: 2 },
    uptime: { provider: "ManageWP", last30d: 99.82, incidents: 1 },
    wcag: [
      {"criterion": "1.1.1 Non-text content", "status": "pass"},
      {"criterion": "1.3.1 Info and relationships", "status": "warn"},
      {"criterion": "1.4.3 Contrast (minimum)", "status": "fail"}
    ]
  }
};

fs.writeFileSync(out, JSON.stringify(payload, null, 2));
console.log('✓ Partial geschreven:', path.relative(process.cwd(), out));
