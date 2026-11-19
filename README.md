# Cenlo Black Friday proof

This standalone example uses synthetic Mercado Libre México orders and stock reports, plus synthetic WhatsApp purchase questions and Meta Ads clicks. Two sizes show zero orders during the same Black Friday window. A later stock correction reveals that one size was unavailable while the other could still be purchased.

The first size gets a reorder review and an ad-spend review. The second gets an offer review. The decision keeps recorded orders and estimated demand in separate fields.

## Run the proof

Run this from the branch in the pull request with Node.js 22 or later.

```sh
node --test black-friday.test.mjs
```

The five tests cover a late stock correction, repeated and out-of-order stock reports, missing availability, limited demand history, and a masked historical period. The historical test holds back a known outcome and compares the estimate against a zero-demand baseline.

## How the example works

- Each stock report describes sellable units for one SKU and observation window. The latest source revision wins when reports arrive out of order.
- For an unavailable variant with buyer signals, the estimator uses at least three prior, fully in-stock windows for the same SKU. Both WhatsApp and Meta signals must be within 25 percent of the target window.
- The estimate is the minimum and maximum orders observed in those comparable windows. It is an illustrative range for human review.
- The example runs offline and keeps all proposed actions as recommendations.
