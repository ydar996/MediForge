#!/usr/bin/env node
/**
 * MCEDT batch validation load smoke test (Phase 8.8).
 * Usage: node scripts/load-test-claims.mjs [count]
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const mcedt = require('../lib/billing/mcedt-format.js');

const count = Number(process.argv[2] || 50);

const sampleClaim = {
  claimReference: 'LOAD-TEST-1',
  serviceDate: '2026-06-22',
  patient: {
    phn: '1234567890',
    versionCode: 'AB',
    lastName: 'DOE',
    firstName: 'JANE',
    dob: '19800101',
    gender: 'F'
  },
  serviceLines: [{ lineNumber: 1, feeCode: 'A007A', diagnosticCode: '786', amount: 33.7, units: 1 }]
};

const submitter = { billingNumber: '123456', groupNumber: '0001', softwareVendor: 'MEDIFORGE' };

const results = [];
for (let i = 0; i < count; i += 1) {
  const started = Date.now();
  const batch = mcedt.buildMcedtBatch({
    claims: [{ ...sampleClaim, claimReference: `LOAD-${i + 1}` }],
    submitter
  });
  const validation = mcedt.validateClaimBatch(batch);
  const xml = mcedt.serializeBatchToXml(batch);
  const xmlValidation = mcedt.validateBatchXmlStructure(xml);
  const ms = Date.now() - started;
  results.push({
    i: i + 1,
    ok: validation.valid && xmlValidation.valid,
    ms,
    claimErrors: validation.errors?.length || 0,
    xmlErrors: xmlValidation.errors?.length || 0
  });
}

const okCount = results.filter((r) => r.ok).length;
const avgMs = Math.round(results.reduce((s, r) => s + r.ms, 0) / results.length);
const maxMs = Math.max(...results.map((r) => r.ms));

console.log(JSON.stringify({ count, okCount, avgMs, maxMs, sample: results.slice(0, 3) }, null, 2));
process.exit(okCount === count ? 0 : 1);
