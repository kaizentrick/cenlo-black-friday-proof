const minimumComparableWindows = 3;

function matchesSignal(observed, historical) {
  return historical >= observed * 0.75 && historical <= observed * 1.25;
}

export function estimateDemand(target, history) {
  if (target.whatsappIntents === 0 || target.metaClicks === 0) return null;

  const comparableOrders = history
    .filter(window =>
      window.sku === target.sku &&
      window.startsAt < target.startsAt &&
      window.availableThroughout &&
      matchesSignal(target.whatsappIntents, window.whatsappIntents) &&
      matchesSignal(target.metaClicks, window.metaClicks)
    )
    .map(window => window.observedOrders);

  if (comparableOrders.length < minimumComparableWindows) return null;

  return {
    low: Math.min(...comparableOrders),
    high: Math.max(...comparableOrders),
    comparableWindows: comparableOrders.length,
  };
}

export function assessVariant(observation, stockEvents, history) {
  // Reconcile by the stock source's revision for this SKU and observation window.
  const stock = stockEvents.reduce((latest, event) => {
    if (event.sku !== observation.sku || event.windowId !== observation.id) return latest;
    return latest === null || event.revision > latest.revision ? event : latest;
  }, null);

  const result = {
    sku: observation.sku,
    observedOrders: observation.observedOrders,
    stockRevision: stock?.revision ?? null,
    estimatedDemand: null,
    adRecommendation: null,
  };

  if (stock?.sellableUnits == null) {
    return { ...result, availability: 'unknown', recommendation: 'verify-availability' };
  }

  if (stock.sellableUnits === 0) {
    const estimatedDemand = estimateDemand(observation, history);
    return {
      ...result,
      availability: 'out-of-stock',
      estimatedDemand,
      recommendation: estimatedDemand ? 'review-reorder' : 'review-stockout',
      adRecommendation: 'review-shift-from-unavailable-variant',
    };
  }

  return {
    ...result,
    availability: 'in-stock',
    recommendation: observation.observedOrders === 0 && observation.marketplaceVisits > 0
      ? 'review-offer'
      : 'monitor',
  };
}
