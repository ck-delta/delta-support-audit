# M5 Triage Checklist

Generated: 2026-04-27T13:19:07.454Z
Articles audited: 20 of 21 (20 changed)
Cost: $0.4641 · prompt=130067 completion=4924

**Mark each finding** as TP (true positive), FP (false positive), or AMB (ambiguous).
Add a one-line reason.

## P0 Issues (4)

### P0-1: Support says only USDT deposits are accepted; SoT still lists BTC as a valid funding/deposit curren…

- **Verdict:** [ ] TP   [ ] FP   [ ] AMB
- **Reason:** _____
- Severity: P0 · Confidence: 0.88 · Owner: Docs
- Support: https://deltaexchange.freshdesk.com/support/solutions/articles/80001014618
- SoT: https://guides.delta.exchange/delta-exchange-user-guide/trading-guide/trade-life-cycle
- Support quote: `Users can only deposit USDT into their accounts.`
- SoT quote: `Delta Exchange has two funding currencies - BTC and USDT. This means that you can deposit either bitcoins or Tether (USDT) to your Delta wallet.`

### P0-2: Support article states only USDT deposits are supported; SoT (Trade Life Cycle guide) still lists B…

- **Verdict:** [ ] TP   [ ] FP   [ ] AMB
- **Reason:** _____
- Severity: P0 · Confidence: 0.88 · Owner: Docs
- Support: https://deltaexchange.freshdesk.com/support/solutions/articles/80001014611
- SoT: https://guides.delta.exchange/delta-exchange-user-guide/trading-guide/trade-life-cycle
- Support quote: `currently we only support USDT deposits over a limited number of networks.`
- SoT quote: `Delta Exchange has two funding currencies - BTC and USDT. This means that you can deposit either bitcoins or Tether (USDT) to your Delta wallet.`

### P0-3: Support article restricts deposits/withdrawals to a specific limited set of currencies (implying US…

- **Verdict:** [ ] TP   [ ] FP   [ ] AMB
- **Reason:** _____
- Severity: P0 · Confidence: 0.72 · Owner: Docs
- Support: https://deltaexchange.freshdesk.com/support/solutions/articles/80001014604
- SoT: https://guides.delta.exchange/delta-exchange-user-guide/trading-guide/trade-life-cycle
- Support quote: `currently we only support Deposit and Withdrawal of the following currencies over a limited number of networks`
- SoT quote: `Delta Exchange has two funding currencies - BTC and USDT. This means that you can deposit either bitcoins or Tether (USDT) to your Delta wallet and withdraw only bitcoins or USDT from your Delta wallet.`

### P0-4: Support article implies only Bitcoin deposits are supported and warns against sending USDT, but SoT…

- **Verdict:** [ ] TP   [ ] FP   [ ] AMB
- **Reason:** _____
- Severity: P0 · Confidence: 0.72 · Owner: Docs
- Support: https://deltaexchange.freshdesk.com/support/solutions/articles/80001014610
- SoT: https://guides.delta.exchange/delta-exchange-user-guide/trading-guide/trade-life-cycle
- Support quote: `Please also ensure that you send only Bitcoin to your Delta Exchange deposit address. Litecoin, Bitcoin Cash and Tether networks accept Bitcoin addresses as valid.`
- SoT quote: `Delta Exchange has two funding currencies - BTC and USDT. This means that you can deposit either bitcoins or Tether (USDT) to your Delta wallet.`

## P1 Issues (3)

### P1-1: Support article states Post Only Mode is active '5-10 minutes before each planned maintenance', but…

- **Verdict:** [ ] TP   [ ] FP   [ ] AMB
- **Reason:** _____
- Severity: P1 · Confidence: 0.85 · Owner: Support
- Support: https://deltaexchange.freshdesk.com/support/solutions/articles/80001014518
- SoT: https://guides.delta.exchange/delta-exchange-user-guide/exchange-sop-and-policies/market-disruption
- Support quote: `Phase 3 - Post Only Mode ... This phase is generally active for 5 - 10 minutes before each planned maintenance.`
- SoT quote: `Step 1: Market is put into post-only mode. Traders are able to post and/ or cancel limit orders. However, at time time, orders are not matched.`

### P1-2: Support article says users cannot cancel/edit open positions in Phase 1 (Cancel Only Mode), but the…

- **Verdict:** [ ] TP   [ ] FP   [ ] AMB
- **Reason:** _____
- Severity: P1 · Confidence: 0.75 · Owner: Support
- Support: https://deltaexchange.freshdesk.com/support/solutions/articles/80001014518
- SoT: https://guides.delta.exchange/delta-exchange-user-guide/exchange-sop-and-policies/market-disruption
- Support quote: `However, they cannot:
1) Cancel/ Edit any open positions>`
- SoT quote: `Phase 1: Order book is put in cancel-only mode and no new orders are accepted. Thus, traders have the option to cancel any existing orders.`

### P1-3: Support article omits that users can also add more margin to open positions during Post Only Mode, …

- **Verdict:** [ ] TP   [ ] FP   [ ] AMB
- **Reason:** _____
- Severity: P1 · Confidence: 0.72 · Owner: Support
- Support: https://deltaexchange.freshdesk.com/support/solutions/articles/80001014518
- SoT: https://docs.delta.exchange/#auction-started
- Support quote: `In this phase users can ... Add new orders, however, orders will not be executed as matching of orders is not initiated
Cancel/ Edit their open orders`
- SoT quote: `In post only mode, you can post new orders, cancel exisiting orders, add more margin to open positions. No matching happens in this mode.`

## P2 Issues (0)

_(none)_

## Conflicts (1)

### Conflict-1: Guides describe two distinct pre-maintenance phases (cancel-only then fully frozen), while docs des…

- **Verdict:** [ ] TP   [ ] FP   [ ] AMB
- **Reason:** _____
- Severity: P1 · Confidence: 0.72
- Guides: https://guides.delta.exchange/delta-exchange-user-guide/exchange-sop-and-policies/market-disruption
- Guides quote: `Phase 1: Order book is put in cancel-only mode and no new orders are accepted. Thus, traders have the option to cancel any existing orders.
Phase 2: Order book is completely frozen and, new order or cancellations are ac…`
- Docs: https://docs.delta.exchange/#market-disruption
- Docs quote: `When markets are disrupted, orderbook enters into cancel only mode. You can refer to "trading_status" field in product info to determine this. In cancel only mode, you can only cancel your orders. No matching happens in…`

## Coverage Gaps (0)

_(none — coverage not run, or 0 gaps detected)_

## Triage tally

| Severity | Total | TP | FP | AMB | FP rate |
|---|---|---|---|---|---|
| P0 | 4 | _ | _ | _ | _% |
| P1 | 3 | _ | _ | _ | _% |
| P2 | 0 | _ | _ | _ | _% |
| Conflicts | 1 | _ | _ | _ | _% |
| Coverage | 0 | _ | _ | _ | _% |
