# M5 Triage Checklist

Generated: 2026-04-27T13:03:32.281Z
Articles audited: 20 of 21 (20 changed)
Cost: $0.3825 · prompt=107027 completion=4097

**Mark each finding** as TP (true positive), FP (false positive), or AMB (ambiguous).
Add a one-line reason.

## P0 Issues (5)

### P0-1: The support article states users can only deposit USDT, but the guides state both BTC and USDT are …

- **Verdict:** [ ] TP   [ ] FP   [ ] AMB
- **Reason:** _____
- Severity: P0 · Confidence: 0.82 · Owner: Support
- Support: https://deltaexchange.freshdesk.com/support/solutions/articles/80001014618
- SoT: https://guides.delta.exchange/delta-exchange-user-guide/trading-guide/trade-life-cycle
- Support quote: `Users can only deposit USDT into their accounts. USDT deposits are supported through the following networks: BEP20 (BNB Smart Chain), ERC20 (Ethereum Network)`
- SoT quote: `Delta Exchange has two funding currencies - BTC and USDT. This means that you can deposit either bitcoins or Tether (USDT) to your Delta wallet`

### P0-2: The support article implies only Bitcoin deposits are relevant and warns only about Bitcoin address…

- **Verdict:** [ ] TP   [ ] FP   [ ] AMB
- **Reason:** _____
- Severity: P0 · Confidence: 0.75 · Owner: Support
- Support: https://deltaexchange.freshdesk.com/support/solutions/articles/80001014610
- SoT: https://guides.delta.exchange/delta-exchange-user-guide/trading-guide/trade-life-cycle
- Support quote: `Delta Exchange has two funding currencies - BTC and USDT. This means that you can deposit either bitcoins or Tether (USDT)`
- SoT quote: `Delta Exchange has two funding currencies - BTC and USDT. This means that you can deposit eithe bitcoins or Tether (USDT) to your Delta wallet and withdraw only bitcoins or USDT from your Delta wallet.`

### P0-3: The support article states only USDT deposits are supported, but the guides state both BTC and USDT…

- **Verdict:** [ ] TP   [ ] FP   [ ] AMB
- **Reason:** _____
- Severity: P0 · Confidence: 0.75 · Owner: Support
- Support: https://deltaexchange.freshdesk.com/support/solutions/articles/80001014611
- SoT: https://guides.delta.exchange/delta-exchange-user-guide/trading-guide/trade-life-cycle
- Support quote: `Currently, USDT deposits are supported only via the following networks: ERC20, BEP20 (BSC). No other networks are supported at this time.`
- SoT quote: `Delta Exchange has two funding currencies - BTC and USDT. This means that you can deposit either bitcoins or Tether (USDT) to your Delta wallet`

### P0-4: The support article frames the limitation as 'portfolio margin on a single coin per account', but t…

- **Verdict:** [ ] TP   [ ] FP   [ ] AMB
- **Reason:** _____
- Severity: P0 · Confidence: 0.72 · Owner: Support
- Support: https://deltaexchange.freshdesk.com/support/solutions/articles/80001140477
- SoT: https://guides.delta.exchange/delta-exchange-user-guide/trading-guide/margin-explainer
- Support quote: `Portfolio margin can be enabled only on a single coin per account/ sub-account.`
- SoT quote: `Margin mode is an account level property. Therefore, for a given account/ subaccount, you can select only one margin mode.`

### P0-5: The support article lists withdrawals for ETH, SENSE, DETO, XRP, USDC, SUN and BTC, but the guides …

- **Verdict:** [ ] TP   [ ] FP   [ ] AMB
- **Reason:** _____
- Severity: P0 · Confidence: 0.65 · Owner: Support
- Support: https://deltaexchange.freshdesk.com/support/solutions/articles/80001014611
- SoT: https://guides.delta.exchange/delta-exchange-user-guide/trading-guide/trade-life-cycle
- Support quote: `For all other users, there is a flat withdrawal fee for each coin... BTCBTC0.001 BTC0.002 BTC`
- SoT quote: `Delta Exchange has two funding currencies - BTC and USDT. This means that you can deposit either bitcoins or Tether (USDT) to your Delta wallet and withdraw only bitcoins or USDT from your Delta wallet.`

## P1 Issues (4)

### P1-1: The support article describes Phase 3 (Post Only Mode) as occurring 'before each planned maintenanc…

- **Verdict:** [ ] TP   [ ] FP   [ ] AMB
- **Reason:** _____
- Severity: P1 · Confidence: 0.85 · Owner: Support
- Support: https://deltaexchange.freshdesk.com/support/solutions/articles/80001014518
- SoT: https://guides.delta.exchange/delta-exchange-user-guide/exchange-sop-and-policies/market-disruption
- Support quote: `This phase is generally active for 5 - 10 minutes before each planned maintenance.`
- SoT quote: `Step 1: Market is put into post-only mode. Traders are able to post and/ or cancel limit orders. However, at time time, orders are not matched.`

### P1-2: The support article states users cannot cancel open positions during Phase 3 (Post Only Mode), but …

- **Verdict:** [ ] TP   [ ] FP   [ ] AMB
- **Reason:** _____
- Severity: P1 · Confidence: 0.72 · Owner: Support
- Support: https://deltaexchange.freshdesk.com/support/solutions/articles/80001014518
- SoT: https://docs.delta.exchange/#auction-started
- Support quote: `However, they cannot:
1) Cancel any open positions`
- SoT quote: `In post only mode, you can post new orders, cancel exisiting orders, add more margin to open positions. No matching happens in this mode.`

### P1-3: The support article states users cannot cancel/edit open positions in Phase 1 (Cancel Only Mode), b…

- **Verdict:** [ ] TP   [ ] FP   [ ] AMB
- **Reason:** _____
- Severity: P1 · Confidence: 0.70 · Owner: Support
- Support: https://deltaexchange.freshdesk.com/support/solutions/articles/80001014518
- SoT: https://guides.delta.exchange/delta-exchange-user-guide/exchange-sop-and-policies/market-disruption
- Support quote: `However, they cannot:
1) Cancel/ Edit any open positions>`
- SoT quote: `Phase 1: Order book is put in cancel-only mode and no new orders are accepted. Thus, traders have the option to cancel any existing orders.`

### P1-4: The support article explicitly states liquidations and stop orders are not triggered during Phase 2…

- **Verdict:** [ ] TP   [ ] FP   [ ] AMB
- **Reason:** _____
- Severity: P1 · Confidence: 0.65 · Owner: Support
- Support: https://deltaexchange.freshdesk.com/support/solutions/articles/80001014518
- SoT: https://guides.delta.exchange/delta-exchange-user-guide/exchange-sop-and-policies/market-disruption
- Support quote: `Please also note that during this phase liquidations or stop orders are not triggered.`
- SoT quote: `Phase 2: Order book is completely frozen and, new order or cancellations are accepted and no matches occur.`

## P2 Issues (5)

### P2-1: The support article implies portfolio margin is coin-scoped (one coin per account), but the guides …

- **Verdict:** [ ] TP   [ ] FP   [ ] AMB
- **Reason:** _____
- Severity: P2 · Confidence: 0.75 · Owner: Support
- Support: https://deltaexchange.freshdesk.com/support/solutions/articles/80001140477
- SoT: https://guides.delta.exchange/delta-exchange-user-guide/trading-guide/margin-explainer
- Support quote: `Portfolio margin can be enabled only on a single coin per account/ sub-account. By leveraging the sub-accounts feature, portfolio margined positions can be run on multiple coins`
- SoT quote: `Only USDT settled futures, perpetuals and options on BTC and ETH support Portfolio Margin mode`

### P2-2: The support article claims spot market buying is disabled on the Global platform, but the guides in…

- **Verdict:** [ ] TP   [ ] FP   [ ] AMB
- **Reason:** _____
- Severity: P2 · Confidence: 0.72 · Owner: Support
- Support: https://deltaexchange.freshdesk.com/support/solutions/articles/80001014618
- SoT: https://guides.delta.exchange/delta-exchange-user-guide
- Support quote: `Additionally, spot market buying is currently disabled on the Global platform, so users will not be able to purchase assets through spot trading.`
- SoT quote: `Spot: Currently, we have seven pairs available in spot trading - DETO/USDT, BTC/USDT and ETH/USDT, SOL/USDT and USDC/USDT, with more markets in the offing.`

### P2-3: The support article warns users not to send Tether to the Bitcoin deposit address, but fails to men…

- **Verdict:** [ ] TP   [ ] FP   [ ] AMB
- **Reason:** _____
- Severity: P2 · Confidence: 0.72 · Owner: Support
- Support: https://deltaexchange.freshdesk.com/support/solutions/articles/80001014610
- SoT: https://guides.delta.exchange/delta-exchange-user-guide/trading-guide/trade-life-cycle
- Support quote: `Please also ensure that you send only Bitcoin to your Delta Exchange deposit address. Litecoin, Bitcoin Cash and Tether networks accept Bitcoin addresses as valid.`
- SoT quote: `Delta Exchange has two funding currencies - BTC and USDT. This means that you can deposit eithe bitcoins or Tether (USDT) to your Delta wallet`

### P2-4: The support article lists only BTC, ETH, and DETO as available spot assets for trading credits, omi…

- **Verdict:** [ ] TP   [ ] FP   [ ] AMB
- **Reason:** _____
- Severity: P2 · Confidence: 0.72 · Owner: Support
- Support: https://deltaexchange.freshdesk.com/support/solutions/articles/80001014520
- SoT: https://guides.delta.exchange/delta-exchange-user-guide
- Support quote: `Buy Bitcoin, Ethereum, DETO on Spot`
- SoT quote: `Currently, we have seven pairs available in spot trading - DETO/USDT, BTC/USDT and ETH/USDT, SOL/USDT and USDC/USDT, with more markets in the offing.`

### P2-5: The support article restricts DETO fee payment only for VIP Level 1+ users under the MSP program, b…

- **Verdict:** [ ] TP   [ ] FP   [ ] AMB
- **Reason:** _____
- Severity: P2 · Confidence: 0.72 · Owner: Support
- Support: https://deltaexchange.freshdesk.com/support/solutions/articles/80001014523
- SoT: https://guides.delta.exchange/delta-exchange-user-guide/market-makers-guide
- Support quote: `Users in VIP Level 1 or above will not be eligible for paying fees in DETO under MSP program.`
- SoT quote: `fees for fills where discounted trading fees or rebates are applied, are excluded from the scope of VIP program, referral program and other promotional schemes. Moreover, fees for these fills cannot be paid in DETO.`

## Conflicts (0)

_(none)_

## Coverage Gaps (0)

_(none — coverage not run, or 0 gaps detected)_

## Triage tally

| Severity | Total | TP | FP | AMB | FP rate |
|---|---|---|---|---|---|
| P0 | 5 | _ | _ | _ | _% |
| P1 | 4 | _ | _ | _ | _% |
| P2 | 5 | _ | _ | _ | _% |
| Conflicts | 0 | _ | _ | _ | _% |
| Coverage | 0 | _ | _ | _ | _% |
