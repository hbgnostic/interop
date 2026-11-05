# Wallet payment journeys

Version 0.1.0, **PROPOSED**. This optional ISI-4 extension defines payment
delivery, recovery and usability criteria across wallet implementations.
The [profile](profile.json) is a machine-readable coverage inventory. The
adopted ISI-4 1.0.0 vectors retain their existing meanings and results.

## User tasks and protocol boundaries

A user must be able to identify a recipient, understand the amount and fees,
confirm once, see a truthful payment state, receive the funds and use them.
If an operation fails, the user must retain a discoverable recovery path.
Application success messages and healthy HTTP endpoints establish neither
delivery nor ownership of spendable funds.

The reference set is BRCs revision
`42ceeb219e686e41a6b7fb85be1231c44b2e2a73`:

| Boundary | Frozen reference | Scope |
| --- | --- | --- |
| Payment construction and remittance | [BRC-29](https://github.com/bsv-blockchain/BRCs/blob/42ceeb219e686e41a6b7fb85be1231c44b2e2a73/payments/0029.md) | Recipient-derived outputs and metadata needed to internalize them |
| Wallet application calls | [BRC-100](https://github.com/bsv-blockchain/BRCs/blob/42ceeb219e686e41a6b7fb85be1231c44b2e2a73/wallet/0100.md) | Creation, permission decisions, signing, internalization and read-back |
| Relay semantics | [BRC-33](https://github.com/bsv-blockchain/BRCs/blob/42ceeb219e686e41a6b7fb85be1231c44b2e2a73/peer-to-peer/0033.md) | Send, list and acknowledge; acknowledgment deletes a message |
| Historical host discovery | [BRC-34](https://github.com/bsv-blockchain/BRCs/blob/42ceeb219e686e41a6b7fb85be1231c44b2e2a73/peer-to-peer/0034.md) | Authorized host advertisements and interconnection |
| Payment request entry | [BRC-125](https://github.com/bsv-blockchain/BRCs/blob/42ceeb219e686e41a6b7fb85be1231c44b2e2a73/payments/0125.md) | Identity-key URI parsing and explicit confirmation before broadcast |

These are separate contracts. BRC-125 does not establish delivery or define
fund recovery after a relay failure. Each artifact's intake must identify its
actual host discovery/anointment, authenticated transport, payment envelope,
inbox convention and acknowledgment behavior. BRC-33's `payment_inbox` example
alone does not define a complete cross-wallet payment protocol. Differences
between the pinned standards and deployed dependencies remain explicit findings.

The criteria below are proposed laboratory requirements, including additional
durability and UX expectations. They are not represented as an already adopted
ecosystem standard. Unsupported guarantees block the affected task.

## Proposed funds-safety contract

| State or operation | Required evidence and behavior |
| --- | --- |
| Request and confirmation | Validate the recipient and integer amount; display the intended recipient, amount and fees. URI opening, scanning or pasting cannot authorize broadcast. |
| Discovery | Bind the recipient identity, authorized destination host, inbox and discovery result. Exercise missing, wrong, stale and unauthorized advertisements. A hard-coded sender host does not establish receiver reachability. |
| Preparation | Record one durable payment intent and its recovery context before a destructive step. Preserve the exact subject transaction, output index, sender identity and derivation metadata once created. |
| Submission | Verify transaction ancestry, signatures, input spend state, outputs and value conservation independently. Transaction acceptance and notification delivery have distinct states. |
| Relay delivery | Retain a durable server receipt and list/read-back under the intended recipient and inbox. A live WebSocket callback or successful send return cannot stand in for durable storage. |
| Ambiguous acknowledgment | After store-then-timeout, HTTP fallback or restart, retry delivery of the original payment. Recreating the payment transaction is a duplicate funding debit, not a transport retry. |
| Receiving | Validate the exact payment, internalize once, verify durable wallet read-back and recovery metadata, then acknowledge the inbox message. A failed internalization preserves the message and the retry path. |
| Completion | Retain the recipient's accepted spend of the received output and both wallets' fee/balance projections. Sender and recipient UIs distinguish pending, delivered, received and failed states. |
| Cancellation or rejection | Before signing, cancellation creates no payment debit. After signing/submission, preserve the actual state. Acknowledging a small rejected payment is distinct from a refund. A failed acceptance cannot authorize refunding from unrelated wallet funds. |
| Recovery | Reconnect or restore using the declared wallet recovery mechanism. A sender cannot be assumed able to reclaim an output locked to the recipient. Unsupported reclaim remains blocked; metadata retention, safe redelivery and proven refunds are evaluated separately. |

No criterion requires a new backend, public history stream or a particular
durable-store product. Existing wallet records and supported storage may fulfill
the contract. Retention and recovery must be demonstrated through failures;
application browser state cannot be the only copy of essential payment metadata.

## Coverage and starting states

| Journey | Task and faults |
| --- | --- |
| PAY-01 | Send, receive, accept, restart and spend in all four native/PeerPay sender/receiver combinations |
| PAY-02 | Offline recipient; returning-user Receive and explicit refresh |
| PAY-03 | Missing, wrong, stale or unauthorized receiving-host advertisement |
| PAY-04 | WebSocket/HTTP fallback, lost acknowledgment, transport outage and duplicate delivery |
| PAY-05 | Direct and signable transaction byte representations, legacy BEEF and malformed payload rejection |
| PAY-06 | Permission denial, cancellation, failed internalization, mixed bulk acceptance and rejection/refund policy |
| PAY-07 | Typed identity, PeerPay URI, QR request, invalid inputs and separately confirmed repeat payments |
| MNT-01 | Fresh/returning Receive, saved addresses, free selection and truthful discovery state |
| MNT-02 | Deposit, detect, import and spend, including an empty destination wallet and earlier saved address |
| MNT-03 | Expired receiving, historical coin access, cleared app data, clean-device wallet restore and partial discovery failure |
| MNT-04 | Spent requested/added inputs, exit after signing, ambiguous submission and missing/stale headers |

The matrix contains every ordered pair of target wallet contexts, including
self-pairs using **two independent fixture identities**. Native-to-PeerPay and
PeerPay-to-native are distinct tasks. A family name does not qualify all its
platforms. Windows 11 Metanet Client identity-key receiving from BSV Browser and
an external HandCash sender has priority for reproduction; the sender OS and
exact artifacts require intake. The report's proposed transport explanation is
not a confirmed cause.

HandCash is an external sender candidate; its BRC-29 compatibility and available
integration paths require verification. It is not assigned BRC-100 application
host or receiving capabilities. Vela remains a headless candidate; native UI
tasks require an actual UI. Missing publishers, unsupported methods, unavailable
OSs and unknown capabilities remain visible blockers. A future exclusion requires
a reason and a separately versioned coverage change.

Each admitted cell freezes exact artifacts, dependency locks, OS/patch and
architecture, browser/WebView engine, substrate, origin, locale, permissions,
network/service configuration, fault schedule, deadlines and expected outcomes.
Run fresh and returning states where declared. Establish the isolated wallet,
app and service baseline before each of two clean repetitions; returning-user
steps preserve only their named state. Compare semantic results while retaining
randomized raw bytes and each failed attempt. Fixtures use independently verified
Teranode-mined funding ancestry and externally verified whole-process network
closure. Personal accounts and public-mainnet spending are outside this profile.

## Functional and UX acceptance

The protocol oracle verifies serialized transactions, remittance context,
authenticated routing, server storage/read-back, wallet records, acknowledgment
ordering, input spend state, conservation and an actual recipient spend.
Fault cases must preserve the complete recovery path and detect duplicate debit
or credit. Missing evidence yields BLOCKED/INCONCLUSIVE; an observed violation
yields FAIL. A subsequent repair creates a new attempt with a link to the failure.

The UX observer retains ordinary user actions, native prompts, screenshots or
video and timing through refresh, restart and recovery. Record whether an
uncoached user can find Send/Receive, recognize the recipient/amount/fees,
understand pending versus received, cancel, and recover without technical
instruction. Exercise keyboard/focus, accessible names, error recovery and the
declared phone/desktop layout on the actual platform. Freeze task/time criteria
before an assessed run. Synthetic personas are hypotheses; a usability claim
requires observed user-task evidence. Functional and UX findings are reported
separately and both are required for journey acceptance.

## Execution available now

`node bin/tpnil.mjs payment-matrix --summary` summarizes the unexecuted inventory;
omit `--summary` for every cell and its blockers. The output is always
`COVERAGE_PLAN_ONLY`. It allocates no device capacity and issues no SUT result.
The [source regression guide](../../../../../docs/payment-journeys.md) runs
existing application tests through the laboratory's component qualification
runner, including named byte-compatibility and Mountaintops recovery regressions.

Native payment UI drivers, frozen compiled app artifacts, controlled Message Box
discovery/delivery/fault services, complete independent outcome oracles and
per-wallet payment-profile admission remain open. Source tests cannot close any
native matrix cell. Qualification should begin with the reported Windows path
and one costed, reproducible controlled-service work order; this inventory is
not an instruction to lease the full matrix.
