import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyVitestPaymentResults, verifyTapPaymentResults } from '../src/payment-source-results.mjs';

test('source gates reject skipped, pending, missing and false aggregate success reports', () => {
  const good = { success: true, numTotalTests: 1, numPassedTests: 1,
    testResults: [{ assertionResults: [{ title: 'required payment', status: 'passed' }] }] };
  assert.equal(verifyVitestPaymentResults(good, ['required payment']), 1);
  for (const mutate of [r => r.success = false, r => r.numTotalTests = 2,
    r => r.numPassedTests = 0, r => r.testResults = [],
    r => r.testResults[0].assertionResults[0].title = 'unrelated test']) {
    const bad = structuredClone(good); mutate(bad);
    assert.throws(() => verifyVitestPaymentResults(bad, ['required payment']));
  }
  for (const status of ['failed', 'pending', 'skipped', 'todo']) {
    const bad = structuredClone(good); bad.testResults[0].assertionResults[0].status = status;
    assert.throws(() => verifyVitestPaymentResults(bad, ['required payment']));
  }
});

test('TAP gates require named passing assertions, zero omissions and matching counts', () => {
  const good = 'ok 1 - payment\n# tests 1\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n';
  assert.equal(verifyTapPaymentResults(good, ['payment']), 1);
  for (const bad of [good.replace('ok 1', 'not ok 1'), good.replace('payment', 'another'),
    good.replace('# tests 1', '# tests 2'), good.replace('# pass 1', '# pass 0'),
    ...['fail', 'cancelled', 'skipped', 'todo'].map(key => good.replace(`# ${key} 0`, `# ${key} 1`)),
    good.replace('ok 1 - payment', 'ok 1 - payment # SKIP')]) {
    assert.throws(() => verifyTapPaymentResults(bad, ['payment']));
  }
});
