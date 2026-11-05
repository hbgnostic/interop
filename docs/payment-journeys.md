# Reproduce wallet payment regressions

The [proposed payment journeys](../programs/ISI-4/proposals/payment-journeys/0.1.0/README.md)
cover native Send/Receive, PeerPay delivery and Mountaintops recovery. Generate
the complete coverage inventory with:

```sh
node bin/tpnil.mjs payment-matrix --summary
node bin/tpnil.mjs payment-matrix > out/payment-matrix.json
```

The matrix reports unexecuted cells as BLOCKED. It is independent of the retained
eight-vector ToDo results and does not qualify any wallet for payments.

## Application source checks

Two source plans run actual application code and its existing source tests:

| Plan | Frozen source | Checked behavior |
| --- | --- | --- |
| `infra/plans/isi4-peerpay-source-regressions.json` | `p2ppsr/peerpay@bbb51f392be985e63780ff3ae1977b86cbf08f6c` | Direct/signable array, typed-array and historical numeric-object payment bytes; legacy BEEF; malformed bytes; integer amounts |
| `infra/plans/isi4-mountaintops-source-regressions.json` | `p2ppsr/mountaintops@73516ccc7e39b2451784167ae21c6979aceb8c66` | Deposit-funded import, stale optional inputs, withheld signing and one explicit send, unfinished-action recovery, retained receipts, free selection and sunset enforcement |

Use Node from `.nvmrc`. Obtain clean source checkouts of those exact revisions;
the component runner requires the plan's exact HTTPS `.git` origin URL. Public
source archives, locks and test fixtures have their original licenses. Each
execution performs a clean `npm ci --ignore-scripts`, runs the complete source
suite and rejects missing named tests, failures, skips and pending assertions.
Source test transaction funding is synthetic; it establishes no controlled
native-wallet funding ancestry or production network behavior.

For each lane, run twice in fresh output directories:

```sh
node bin/tpnil.mjs run-component-qualification infra/plans/isi4-peerpay-source-regressions.json /path/to/peerpay out/peerpay-1 local-operator
node bin/tpnil.mjs verify-component-qualification out/peerpay-1
node bin/tpnil.mjs run-component-qualification infra/plans/isi4-peerpay-source-regressions.json /path/to/peerpay out/peerpay-2 local-operator
node bin/tpnil.mjs verify-component-qualification out/peerpay-2
```

Use the Mountaintops plan and source path for the other lane. Output retains
the source identity, lock digest, pinned runner/verifier inputs, test report,
runtime, timestamps, outcomes and content-addressed objects. Failed source
attempts have their own records. The component replay recomputes process/output
assertions; the pinned source-report verifier checks named tests and complete
passing counts during execution. Replay validates retained evidence rather than
rerunning the application or independently proving the reporter truthful.

The `Payment source regressions` workflow runs both lanes twice on a hosted
Linux worker after relevant changes and retains evidence on failure. It uses
public source and no wallet or service credentials. The existing Foundation
checks validate matrix generation and the report parser's false-acceptance
regressions. Source findings are `INFRASTRUCTURE_QUALIFICATION_ONLY`.

The November 5 baseline retains two clean installs per application with matching
semantic summaries: PeerPay passes 16 tests per repetition and Mountaintops
passes 56. The records are
[PeerPay 1](../journals/component-qualification/2026-11-05/peerpay-source-regressions/repetition-1/record.json),
[PeerPay 2](../journals/component-qualification/2026-11-05/peerpay-source-regressions/repetition-2/record.json),
[Mountaintops 1](../journals/component-qualification/2026-11-05/mountaintops-source-regressions/repetition-1/record.json)
and [Mountaintops 2](../journals/component-qualification/2026-11-05/mountaintops-source-regressions/repetition-2/record.json).
They execute source fixtures on macOS arm64 with Node 24.22.1. The complete
native payment matrix remains unexecuted.

## Next native execution

The first work order should reproduce identity-key receiving in Metanet Client
on Windows 11, first from an admitted BSV Browser and then from the external
sender path if its protocol is supported. Retain the exact publisher artifacts
and actual host discovery, inbox storage, refresh and internalization boundaries
before choosing a root cause or a fix. Pin PeerPay's compiled root as a separate
application fixture. Add Mountaintops deposit/import and returning-user recovery
with the same wallet/platform identities. A fixture wallet or browser viewport
does not satisfy a native Windows or mobile test.

Admission follows [intake](intake.md), [evidence policy](evidence.md) and the
[shared infrastructure policy](shared-device-infrastructure.md). Record complete
costs, deadlines, cancellation and cleanup before device allocation. Retain
unknown costs as unknown. Start with offline source evidence and targeted
failure reproduction, then qualify the smallest affected native configuration.
