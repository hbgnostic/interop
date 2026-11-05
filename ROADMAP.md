# Roadmap

[Implementation status](docs/implementation-status.md) records what has run and what remains unproven. This roadmap identifies the next work; individual profiles define their technical prerequisites. Failed or blocked assertions remain valid reported outcomes when the execution and evidence are sound.

## Complete public reproduction materials

- Review repository contents, release assets, workflow logs and artifacts for confidential or operational data for continuing public release maintenance.
- Assemble a public reproduction bundle for an existing result: exact binaries, laboratory source snapshots, dependency versions, fixtures, configuration, evidence and instructions. Verify it from a clean environment without company credentials.
- Record permissions for distributed artifacts under the [intake process](docs/intake.md). Original project contributions use Apache-2.0; vendor submissions use the [submission terms](legal/ARTIFACT-SUBMISSION-AGREEMENT.md). P2PPSR's Metanet Explorer acceptance is recorded; other submissions retain their own permission status.
- Verify the public contribution and native-runner access boundaries, and keep the getting-started documentation consistent with the verified setup.

P2PPSR authorizes public release under [governance](GOVERNANCE.md). The experimental release describes its actual coverage and limitations; completing every future profile or establishing certification is separate work.

## Extend production-wallet coverage

The Chromium, macOS and Android lanes are executable. Yours Wallet has two retained experimental runs with mixed passing, failing and blocked outcomes. Metanet Explorer's four controlled-WAB runs passed activation and reached transaction submission; the native wallet response and application task-visibility boundary remains unresolved. BSV Desktop has a qualified native baseline but still needs controlled-service integration. BSV Browser awaits a canonical publisher binary. See the [wallet records](suts/README.md) for evidence and scope.

Next steps:

- Reproduce missing identity-key payments on the reported Windows receiving path under the [payment journey proposal](programs/ISI-4/proposals/payment-journeys/0.1.0/README.md). Add native/PeerPay ordered-pair flows and Mountaintops deposit/import/recovery; retain transaction, discovery, inbox, internalization and UX observations independently. Source checks and an unexecuted matrix are available through the [operator guide](docs/payment-journeys.md).

- Diagnose the Metanet Explorer response boundary using the retained [storage and bridge observations](programs/ISI-4/decisions/0007-controlled-wallet-bridge-observation.md).
- Complete BSV Desktop's supported service configuration, fixture state and independent reconstruction lane.
- Expand the permission-denial, alternate-origin and broadcast/recovery assertions, remote-storage substitution and clause-level BRC-100 coverage. Preserve the existing results when new cases or corrected runs are added.
- Qualify additional platforms using their actual binaries, lawful installation environments and declared integration boundaries.

## Extend independent interoperability checks

Freeze overlay and storage HTTP contracts, add independent state oracles, and execute TypeScript/Go substitution matrices. Cover admission, lookup, synchronization, restart, idempotence, pending/proven/conflicted state, portability and data preservation. Record every tested cell and omission.

## Complete the integrated application scenario

The reference protocol and joined Teranode/Broadcaster/Merkle/ChainTracks transaction-service profile have retained qualifications. Complete the browser-delivered Synthesis Board and drive it through an admitted BRC-100 wallet so the application and wallet create the qualified board, UHRP and LCH transaction graph through their public interfaces. Repeat the profile and add independent component substitutions before reporting an ISI-1 SUT result.

[ISI-1 decision 0002](programs/ISI-1/decisions/0002-executable-profiles.md) describes the existing infrastructure boundary. A regtest service result and a production-wallet result retain their separate configurations and claims.

## Independent reproduction and future certification

An independently administered operator should reconstruct the environment, obtain the exact artifacts, repeat the selected profile and verify the evidence. Test archive retrieval, recovery and result challenges as part of that work.

Certification remains unavailable. A future program needs separately published criteria and independent review under [governance](GOVERNANCE.md). It does not add a membership or council requirement to ordinary use, contribution or experimental reporting.
