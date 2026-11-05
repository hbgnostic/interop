# Vela 0.1.0 vendor candidate

Status: **vendor-submitted candidate; registered; technical intake open**.

Vela is a BRC-100 wallet that runs as a local service in a single OCI image. The wallet answers the
BRC-100 HTTP interface on port 3321, and a dashboard on port 3400 manages app access, spending budgets
and setup. Wallet records are kept on a remote BRC-100 storage server (`@bsv/wallet-toolbox`
StorageServer) named by configuration; the image contains no database. The publisher describes Vela
as an experimental wallet built for learning rather than as a consumer product.

Bridget Doran submitted the image and accepted the [vendor submission terms](../../legal/ARTIFACT-SUBMISSION-AGREEMENT.md)
version 2.2.0 in the pull request that added this record. The submission is the built image only;
the source repository is not public. Vendor documentation is in
[vela-0.1.0-README.md](vela-0.1.0-README.md).

The [retained acceptance](../../journals/submission-acceptance/2026-11-04/vela-0.1.0/acceptance.json)
binds the original [PR14 submission](https://github.com/p2ppsr/interop/pull/14), its image-index digest
and the exact accepted terms.

## Artifact

| Field | Value |
| --- | --- |
| Image | `ghcr.io/hbgnostic/vela-wallet:0.1.0-ff2dbe1` (public) |
| Image index | `sha256:b62bef87363ca58ae1f7add6bc43d7e22a55f2aaccfa5ca0b085e9628495c47b` |
| linux/amd64 manifest | `sha256:e15e2e432b23b5fb464d8d148d45c7183ba11e90d34f6b0f3f7a558102a9c322` |
| linux/arm64 manifest | `sha256:7ad4a6961f6060a7752275344e51f9c9d34f6d206a23cf0bc7a345bbc10c98a6` |
| Wallet libraries | `@bsv/sdk` 4.0.1, `@bsv/wallet-toolbox` 2.15.1 |
| Base image | `node:22-slim` (Debian) |

The image bundles 298 npm packages: 286 under permissive licenses (MIT, ISC, BSD-2-Clause,
BSD-3-Clause, Apache-2.0, BlueOak-1.0.0) and 12 under the Open BSV License (`@bsv/*` packages under
version 6, `@bopen-io/templates` under version 4). Debian base-image packages carry their own
licenses.

Registry metadata was read anonymously on November 4, 2026 (Pacific time). The index and selected
manifests match their SHA-256 identities; the image configuration blobs independently identify
the same architectures. The [verification record](../../journals/submission-acceptance/2026-11-04/vela-0.1.0/registry-verification.json)
retains the scope. Image layers, signatures, dependency licenses and runtime behavior remain
unverified. The initial platform-label mismatch is preserved in
[the correction record](../../journals/submission-acceptance/2026-11-04/vela-0.1.0/original-platform-failure.json).
Laboratory execution must select this index or the selected platform digest, rather than `latest`.

## Configuration and initialization

| Setting | Purpose |
| --- | --- |
| `WALLET_STORAGE_URL` | Required. The BRC-100 storage server. Vela refuses to start without it and has no local-storage fallback. |
| `VELA_DASHBOARD_KEY` | Required. Gates the dashboard and setup page (`?key=` or `x-api-key`). |
| `WALLET_SEED` | Optional. A 64-hex seed; when set, setup is skipped for unattended runs. |
| `CHAIN` | `main` (default) or `test`. |

Without `WALLET_SEED`, the setup page on port 3400 offers ordinary initialization: create a wallet
(a 24-word recovery phrase from 32 bytes of entropy) or restore one from 24 words or a 64-hex seed.
The seed is stored encrypted in the `/data` volume (scrypt, AES-256-GCM) and unlocked by password at
each start. The root key is `HMAC-SHA256(seed, "IDENTITY_KEY_V1")`; the recovery phrase restores
in Vela and derives a different identity in wallets that use another derivation.

## Permissions

Vela shows no permission prompts. Every app request is evaluated against rules set in advance:

- An app connects only after its exact web origin is added under App Access; other origins receive
  no CORS grant and are recorded as blocked.
- An app spends only within a monthly BRC-73 spending authorization; other spends are refused.
- Signing requests under the protocols that lock the wallet's coins (BRC-29 payments and 1Sat
  ordinals) are refused unless the origin is on the spend allowlist (`WALLET_SUBSTRATE_ORIGINS`,
  empty by default); a spending authorization does not enable them.
- The `default` basket and admin-reserved baskets and labels are not readable by apps.

Each request, allowed or refused, is recorded in the dashboard's App Activity log with its shape and
outcome, without payload values. An automated driver can apply the same rules through the dashboard
API, authenticated with `x-api-key`:

| Endpoint | Body | Effect |
| --- | --- | --- |
| `POST /api/access/add` | `{"origin":"https://app.example"}` | Allows an origin to connect |
| `POST /api/access/remove` | `{"origin":"https://app.example"}` | Removes it |
| `POST /api/permissions/grant` | `{"origin":"https://app.example","monthlyBudgetSats":10000}` | Grants or updates a monthly budget |
| `GET /api/permissions` | | Lists budgets and spending this month |

## Publisher observations

The publisher ran earlier builds of Vela 0.1.0 against a pricing BRC-100 storage server and
reported:

- build `0.1.0-e0b9abe` on Linux (amd64): wallet creation through the setup page, password unlock
  after a restart, and the ToDo web root used by ISI-4 (`todo-ts-236733c-webroot.tgz`,
  `sha256:b3c41dc6…`) refused before its origin was allowed, then a task created, listed after
  reload, and redeemed within a budget;
- build `0.1.0-d58a657` on macOS (arm64): wallet creation, restore from 24 words to the same identity
  and balance, budgets restored with the wallet on a second machine, and a budget granted for a full
  web address.

The submitted image differs from `0.1.0-d58a657` in dashboard wording, recording of refused
connection attempts in App Activity, and JSON error responses to malformed requests. These are
vendor observations, not laboratory results.

## Known limitations

- No built-in PeerPay or MessageBox inbox. Incoming BRC-29 payments are internalized through the
  dashboard's deposit claim or by an external client calling `internalizeAction`.
- The App Access list and per-app identity choices are kept in the local `/data` volume and do not
  follow the wallet to another machine; budgets do.

## Admission

Not admitted. Candidate registration verifies registry metadata and retains submission acceptance.
The [production SUT intake process](../../docs/intake.md) still requires artifact layers, dependency
and permission review, service boundaries, isolated initial state, observation coverage, clean reset
and repeated runtime evidence. The generic HTTP driver is an engineering tool; it does not establish
an admitted OCI lane or implement Vela's app-access and budget lifecycle. No Vela laboratory result
has been recorded.
