import assert from 'node:assert/strict';
import test from 'node:test';
import { assessVariant, estimateDemand } from './black-friday.mjs';

const windowStart = Date.parse('2026-11-27T15:00:00Z');
const size24 = {
  id: 'black-friday',
  sku: 'runner-24',
  startsAt: windowStart,
  observedOrders: 0,
  marketplaceVisits: 50,
  whatsappIntents: 8,
  metaClicks: 40,
};
const size25 = { ...size24, sku: 'runner-25', whatsappIntents: 1, metaClicks: 12 };

const comparableHistory = [6, 8, 10].map((observedOrders, index) => ({
  ...size24,
  startsAt: Date.parse('2026-11-06T15:00:00Z') + index * 7 * 24 * 60 * 60 * 1000,
  availableThroughout: true,
  observedOrders,
}));

const initialFeed = [
  { sku: size24.sku, windowId: size24.id, revision: 1, sellableUnits: 3 },
  { sku: size25.sku, windowId: size25.id, revision: 1, sellableUnits: 3 },
];
const stockout = { ...initialFeed[0], revision: 3, sellableUnits: 0 };
const expectedDemand = { low: 6, high: 10, comparableWindows: 3 };

test('a delayed stockout changes the business decision for only the affected size', () => {
  assert.equal(assessVariant(size24, initialFeed, comparableHistory).recommendation, 'review-offer');
  const corrected = [...initialFeed, stockout];
  const soldOut = assessVariant(size24, corrected, comparableHistory);
  const stillAvailable = assessVariant(size25, corrected, comparableHistory);

  assert.deepEqual(soldOut, {
    sku: 'runner-24',
    observedOrders: 0,
    stockRevision: 3,
    availability: 'out-of-stock',
    estimatedDemand: expectedDemand,
    recommendation: 'review-reorder',
    adRecommendation: 'review-shift-from-unavailable-variant',
  });
  assert.deepEqual(stillAvailable, assessVariant(size25, initialFeed, comparableHistory));
  assert.equal(stillAvailable.recommendation, 'review-offer');
  assert.equal(stillAvailable.observedOrders, 0);
});

test('older and duplicate snapshots leave the decision and recorded orders intact', () => {
  const delayed = { ...initialFeed[0], revision: 2, sellableUnits: 1 };
  const expected = assessVariant(size24, [...initialFeed, stockout], comparableHistory);

  for (const events of [
    [stockout, delayed, ...initialFeed, stockout],
    [...initialFeed, delayed, stockout, delayed],
  ]) {
    assert.deepEqual(assessVariant(size24, events, comparableHistory), expected);
  }
});

test('a missing stock observation leaves availability and demand unknown', () => {
  const anotherWindow = { ...stockout, windowId: 'prior-week' };
  const result = assessVariant(size24, [initialFeed[1], anotherWindow], comparableHistory);
  assert.equal(result.availability, 'unknown');
  assert.equal(result.recommendation, 'verify-availability');
  assert.equal(result.estimatedDemand, null);
  assert.equal(result.adRecommendation, null);
});

test('sparse in-stock history preserves the stockout without estimating a reorder range', () => {
  const result = assessVariant(size24, [stockout], comparableHistory.slice(0, 2));
  assert.equal(result.availability, 'out-of-stock');
  assert.equal(result.recommendation, 'review-stockout');
  assert.equal(result.estimatedDemand, null);
});

test('a masked in-stock period scores against held-out orders using only prior eligible windows', () => {
  const heldOut = { ...size24, availableThroughout: true, observedOrders: 8 };
  const { observedOrders: actualOrders, ...visibleSignals } = heldOut;
  const unavailableWindow = { ...comparableHistory[0], availableThroughout: false, observedOrders: 0 };
  const unrelatedVariant = { ...comparableHistory[1], sku: size25.sku, observedOrders: 30 };
  const futureWindow = { ...heldOut, startsAt: windowStart + 86400000, observedOrders: 50 };

  const range = estimateDemand(visibleSignals, [
    ...comparableHistory,
    unavailableWindow,
    unrelatedVariant,
    futureWindow,
  ]);
  assert.deepEqual(range, expectedDemand);
  assert.ok(actualOrders >= range.low && actualOrders <= range.high);

  const rangeMidpointError = Math.abs((range.low + range.high) / 2 - actualOrders);
  const zeroDemandBaselineError = Math.abs(0 - actualOrders);
  assert.ok(rangeMidpointError < zeroDemandBaselineError);
});
