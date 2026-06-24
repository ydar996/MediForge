#!/usr/bin/env node
/**
 * Lightweight interop gateway load smoke test (Phase 8.8).
 * Usage: node scripts/load-test-interop.mjs [count] [gatewayUrl]
 */
const count = Number(process.argv[2] || 20);
const gatewayUrl =
  process.argv[3] ||
  process.env.INTEROP_GATEWAY_URL ||
  'http://localhost:8888/.netlify/functions/interop-gateway';

const sampleHl7 =
  'MSH|^~\\&|OLIS|LAB|MEDIFORGE|CLINIC|20260622120000||ORU^R01|LOAD-TEST|P|2.5\\rOBX|1|NM|GLU^Glucose||5.1|mmol/L';

async function oneRequest(i) {
  const started = Date.now();
  const res = await fetch(gatewayUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'parseOru', rawHl7: sampleHl7, correlationId: `load-${i}` })
  });
  const ms = Date.now() - started;
  const ok = res.ok;
  return { i, ok, ms, status: res.status };
}

const results = [];
for (let i = 0; i < count; i += 1) {
  results.push(await oneRequest(i + 1));
}

const okCount = results.filter((r) => r.ok).length;
const avgMs = Math.round(results.reduce((s, r) => s + r.ms, 0) / results.length);
const maxMs = Math.max(...results.map((r) => r.ms));

console.log(JSON.stringify({ gatewayUrl, count, okCount, avgMs, maxMs, sample: results.slice(0, 3) }, null, 2));
process.exit(okCount === count ? 0 : 1);
