import path from 'node:path';
import { ROOT, readJson, unique } from './core.mjs';
import { hashJson } from './json.mjs';

export const PAYMENT_PROFILE = 'programs/ISI-4/proposals/payment-journeys/0.1.0/profile.json';

// Coverage inventory only. Generating a cell neither admits nor executes a SUT.
export function paymentMatrix(profile = readJson(path.join(ROOT, PAYMENT_PROFILE))) {
  if (profile.schema !== 'tpnil-payment-journeys@0.1.0' || profile.status !== 'PROPOSED')
    throw new Error('Unsupported payment journey profile');
  unique(profile.wallets.map(wallet => wallet.id), 'payment wallet target');
  unique(profile.journeys.map(journey => journey.id), 'payment journey');
  if (!profile.wallets.length || !profile.journeys.length) throw new Error('Empty payment coverage');
  const cells = [];
  for (const journey of profile.journeys) {
    if (!['ordered-pair', 'single-wallet'].includes(journey.actors)) throw new Error('Invalid payment actor scope');
    if (!journey.steps.length || !journey.oracles.length || !journey.variants.length)
      throw new Error(`Incomplete journey: ${journey.id}`);
    unique(journey.variants, 'journey variant');
    for (const sender of profile.wallets) {
      // External sender candidates remain visible in pair cells, but are not
      // represented as BRC-100 application hosts or compatible receivers.
      if (journey.actors === 'single-wallet' && sender.role === 'external-sender') continue;
      for (const receiver of journey.actors === 'ordered-pair' ? profile.wallets.filter(wallet => wallet.role !== 'external-sender') : [sender]) {
        for (const variant of journey.variants) {
          const id = `${journey.id}/${sender.id}/${receiver.id}/${variant}`;
          cells.push({
            id, journey: journey.id, surface: journey.surface,
            sender: sender.id, receiver: receiver.id, variant,
            priority: receiver.id === 'metanet-client-windows11' &&
              ['bsv-browser-android', 'bsv-browser-ios', 'handcash-external'].includes(sender.id) ? 'reported-path' : 'coverage',
            requiredRepetitions: 2,
            outcome: 'BLOCKED',
            blockers: [...new Set([...sender.blockers, ...receiver.blockers, ...profile.executionBlockers])]
          });
        }
      }
    }
  }
  unique(cells.map(cell => cell.id), 'payment matrix cell');
  return {
    schema: 'tpnil-payment-matrix@0.1.0', claim: 'COVERAGE_PLAN_ONLY',
    profileHash: hashJson(profile), profile: profile.id,
    summary: {
      wallets: profile.wallets.length, journeys: profile.journeys.length,
      cells: cells.length, executed: 0, passed: 0, blocked: cells.length,
      reportedPathCells: cells.filter(cell => cell.priority === 'reported-path').length
    },
    cells
  };
}
