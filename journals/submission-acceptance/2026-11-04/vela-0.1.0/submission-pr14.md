# Vendor submission source

Source: https://github.com/p2ppsr/interop/pull/14

Author: @hbgnostic. Original submission head: `5a534299632c2ab2febec101da65270ed23ad18f`.

The following is the original pull-request description captured during intake registration. Later maintainer corrections to platform bindings do not change the accepted image-index identity.

---

This adds Vela 0.1.0 as a vendor-submitted ISI-4 candidate. Vela is my experimental BRC-100 wallet, packaged as one OCI image: the wallet on port 3321, a dashboard on 3400, and records on a BRC-100 storage server.

**Artifact:** `ghcr.io/hbgnostic/vela-wallet:0.1.0-ff2dbe1` (public), image index `sha256:b62bef87363ca58ae1f7add6bc43d7e22a55f2aaccfa5ca0b085e9628495c47b`, for linux/amd64 and linux/arm64.

**Acceptance:** I, Bridget Doran, accept the TPNIL vendor submission terms version 2.2.0 for this artifact, identified by the image index digest above.

**Dependency licenses:** 298 npm packages: 286 permissive, 12 under the Open BSV License (`@bsv/*` v6, `@bopen-io/templates` v4). The Debian base image packages carry their own licenses. No activation or entitlement limits; Vela needs a BRC-100 storage server, set by `WALLET_STORAGE_URL`.

**Files**
- `suts/candidates/vela-0.1.0.md`: candidate record
- `suts/candidates/vela-0.1.0.json`: machine-readable record
- `suts/candidates/vela-0.1.0-README.md`: vendor documentation, submitted under the submission terms (not an Apache-2.0 contribution)

**Notes for the lab:** Vela has no permission prompts, since apps are allowed in and given budgets in the dashboard, and the record lists the endpoints a driver can use for both. It runs as a container rather than an extension or desktop app. It has no built-in PeerPay inbox yet. Outside Vela I run my own MessageBox server and PeerPay send/receive tooling, and building receive into Vela is next.


