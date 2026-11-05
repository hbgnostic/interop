import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { paymentMatrix, PAYMENT_PROFILE } from '../src/payment-journeys.mjs';
import { ROOT, readJson } from '../src/core.mjs';

test('payment coverage retains both directions, independent self-pairs and every failure variant', () => {
  const profile = readJson(path.join(ROOT, PAYMENT_PROFILE));
  const matrix = paymentMatrix(profile);
  const receivers = profile.wallets.filter(wallet => wallet.role !== 'external-sender');
  const expected = profile.journeys.reduce((count, journey) => count + journey.variants.length *
    (journey.actors === 'ordered-pair' ? profile.wallets.length * receivers.length : receivers.length), 0);
  assert.equal(matrix.summary.cells, expected);
  assert.equal(matrix.cells.length, new Set(matrix.cells.map(cell => cell.id)).size);
  for (const journey of profile.journeys) for (const variant of journey.variants) {
    const selected = matrix.cells.filter(cell => cell.journey === journey.id && cell.variant === variant);
    for (const receiver of receivers) {
      assert.ok(selected.some(cell => cell.sender === receiver.id && cell.receiver === receiver.id));
      if (journey.actors === 'ordered-pair') for (const sender of profile.wallets) {
        assert.ok(selected.some(cell => cell.sender === sender.id && cell.receiver === receiver.id));
      }
    }
  }
  assert.equal(matrix.claim, 'COVERAGE_PLAN_ONLY');
  assert.equal(matrix.summary.executed, 0);
  assert.ok(matrix.cells.every(cell => cell.outcome === 'BLOCKED' && cell.requiredRepetitions === 2 && cell.blockers.length));
  assert.ok(!matrix.cells.some(cell => cell.receiver === 'handcash-external'));
});

test('reported Windows identity-key paths stay visible without assigning a confirmed cause or compatibility', () => {
  const matrix = paymentMatrix();
  for (const sender of ['bsv-browser-android', 'bsv-browser-ios', 'handcash-external']) {
    assert.ok(matrix.cells.some(cell => cell.journey === 'PAY-01' && cell.sender === sender &&
      cell.receiver === 'metanet-client-windows11' && cell.priority === 'reported-path'));
  }
  assert.deepEqual(paymentMatrix(), matrix);
});

test('coverage rejects duplicate target IDs, duplicate cases, omitted steps and unknown actor scopes', () => {
  const original = readJson(path.join(ROOT, PAYMENT_PROFILE));
  for (const mutation of [
    p => p.wallets.push(p.wallets[0]), p => p.journeys.push(p.journeys[0]),
    p => p.journeys[0].actors = 'all-wallets-pass', p => p.journeys[0].steps = [],
    p => p.journeys[0].variants.push(p.journeys[0].variants[0]), p => p.status = 'CERTIFIED'
  ]) {
    const changed = structuredClone(original); mutation(changed);
    assert.throws(() => paymentMatrix(changed));
  }
});
