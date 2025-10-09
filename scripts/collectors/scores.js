#!/usr/bin/env node
// Example collector: schrijft scores partial op basis van fictieve input
const fs = require('fs');
const path = require('path');
const out = path.join(process.cwd(), 'data', 'partials', 'scores.json');
const payload = {
  scores: {
    performance: 78,
    mobile_performance: 65,
    seo: 72,
    accessibility: 86,
    best_practices: 80
  }
};
fs.writeFileSync(out, JSON.stringify(payload, null, 2));
console.log('✓ Partial geschreven:', path.relative(process.cwd(), out));
