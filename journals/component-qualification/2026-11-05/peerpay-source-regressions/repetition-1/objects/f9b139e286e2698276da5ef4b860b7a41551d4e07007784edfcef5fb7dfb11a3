// Runs pinned application source tests. This is not a native wallet driver.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { verifyVitestPaymentResults, verifyTapPaymentResults } from '../../src/payment-source-results.mjs';

const lane = process.env.TPNIL_PAYMENT_LANE;
if (!['peerpay', 'mountaintops'].includes(lane)) throw new Error('Unknown payment source lane');
const frontend = path.join(process.cwd(), 'frontend');
const lock = fs.readFileSync(path.join(frontend, 'package-lock.json'));
const required = lane === 'peerpay' ? [
  'normalizes current Wallet Wire Uint8Array results for remittance and JSON transport',
  'recovers direct and signable transactions mangled by historical JSON wallets',
  'does not silently turn sparse or malformed wallet payloads into empty transactions',
  'upgrades a valid legacy BEEF payload to AtomicBEEF',
  'prunes unrelated historical BEEF branches from an AtomicBEEF envelope',
  'rejects malformed transaction bytes',
  'rejects unsafe, fractional, and negative values'
] : [
  'unsigned preparation and withheld signing precede one explicit sendWith',
  'a self-funded import avoids optional batch migration of an already-spent wallet coin',
  'first import funds an empty wallet without a prerequisite PushDrop fee',
  'fresh-device recovery blocks another payment while a submission is sending or unproven',
  'tagless wallet receipts remain recoverable and are scoped to each address',
  'unknown spend state is an error, never an empty balance',
  'retained pre-sunset coins recover using wallet BEEF and known-output checks only',
  'free session choices survive refresh, fresh sessions default deterministically, and expired choices fall back'
];

const execute = (args, command = 'npm') => {
  const run = spawnSync(command, args, { cwd: frontend, encoding: 'utf8', timeout: 240_000,
    maxBuffer: 16 * 1024 * 1024, env: { ...process.env, NO_COLOR: '1', CI: 'true' } });
  if (run.status !== 0 || run.error || run.signal) {
    process.stdout.write(run.stdout ?? '');
    process.stderr.write(run.stderr ?? '');
    throw new Error(`Payment source command failed: ${command} ${args.join(' ')}`);
  }
  return run;
};

// npm ci verifies the locked dependency closure on each run. Lifecycle scripts
// are unnecessary for these source tests and remain disabled.
execute(['ci', '--ignore-scripts', '--no-audit', '--no-fund']);
if (!fs.readFileSync(path.join(frontend, 'package-lock.json')).equals(lock)) throw new Error('Lockfile changed');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'tpnil-payment-source-'));
try {
  let count;
  if (lane === 'peerpay') {
    const report = path.join(temporary, 'vitest.json');
    execute(['test', '--', '--reporter=json', '--outputFile', report]);
    const result = JSON.parse(fs.readFileSync(report, 'utf8'));
    count = verifyVitestPaymentResults(result, required);
    process.stdout.write(JSON.stringify(result) + '\n');
  } else {
    const files = fs.readdirSync(path.join(frontend, 'test')).filter(name => name.endsWith('.test.mjs')).sort();
    const run = execute(['--test', '--experimental-strip-types', '--test-reporter=tap', ...files.map(name => `test/${name}`)], process.execPath);
    const output = run.stdout;
    count = verifyTapPaymentResults(output, required);
    process.stdout.write(output);
  }
  process.stdout.write(JSON.stringify({ claim: 'INFRASTRUCTURE_QUALIFICATION_ONLY', lane,
    tests: count, requiredRegressions: required, node: process.version,
    lockSha256: createHash('sha256').update(lock).digest('hex'), nativeWalletExecution: false }) + '\n');
  process.stdout.write(`TPNIL_PAYMENT_SOURCE_${lane.toUpperCase()}_PASS\n`);
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
