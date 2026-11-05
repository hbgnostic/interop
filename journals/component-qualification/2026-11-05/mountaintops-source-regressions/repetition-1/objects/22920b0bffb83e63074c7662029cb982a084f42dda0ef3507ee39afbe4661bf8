export function verifyVitestPaymentResults(result, required) {
  const assertions = result.testResults.flatMap(file => file.assertionResults);
  if (!result.success || !assertions.length || assertions.some(assertion => assertion.status !== 'passed') ||
      result.numTotalTests !== assertions.length || result.numPassedTests !== assertions.length)
    throw new Error('Payment suite contains failed, skipped, pending or missing assertions');
  for (const title of required) {
    if (!assertions.some(assertion => assertion.title === title)) throw new Error(`Missing source regression: ${title}`);
  }
  return assertions.length;
}

export function verifyTapPaymentResults(output, required) {
  for (const title of required) {
    if (!output.split('\n').some(line => /^ok \d+ - /.test(line) && line.slice(line.indexOf(' - ') + 3) === title))
      throw new Error(`Missing or nonpassing source regression: ${title}`);
  }
  for (const key of ['fail', 'cancelled', 'skipped', 'todo']) {
    if (!new RegExp(`^# ${key} 0$`, 'm').test(output)) throw new Error(`Unqualified Node test summary: ${key}`);
  }
  const count = Number(/^# tests (\d+)$/m.exec(output)?.[1]);
  const passed = Number(/^# pass (\d+)$/m.exec(output)?.[1]);
  if (!Number.isSafeInteger(count) || count < required.length || count !== passed)
    throw new Error('Missing or inconsistent Node test count');
  return count;
}
