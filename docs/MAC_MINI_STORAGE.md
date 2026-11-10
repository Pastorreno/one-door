# Mac mini storage repair — pending deployment

One Door is a commercial digital profile/EPK service for people, nonprofits,
pastors and churches. Each customer needs their own profile and share link.
Church visitor forms may integrate with the existing visitor follow-up system
only after explicit visitor consent and a verified integration contract.

## Architecture

- Source: Pastorreno/one-door on GitHub.
- Frontend and rendering: existing one-door Vercel project.
- Customer records and rendered cards: Mac mini, ~/storage/one-door.
- Storage server: scripts/mac-storage.mjs, Node, loopback port 8794 by default.
- Vercel variables: ONE_DOOR_STORAGE_URL (dedicated HTTPS endpoint ending in /)
  and ONE_DOOR_STORAGE_TOKEN (same strong secret as the Mac storage service).
- No Vercel Blob storage. No Vercel API token or deployment per customer card.

## Current state and remaining setup

Repair is not live. Local build and original logic tests pass. API flow tests
cover draft isolation, owner-only publishing, public card reads, preserved links
when another card is created, and contact consent using the local disk adapter.
Remote Mac storage and the deployed flow still require verification.

Before activation: back up relevant configuration, select an unused loopback port,
register the isolated service, and configure a dedicated authenticated HTTPS tunnel
route. Do not attach a customer-facing storage endpoint to Melvin's private tool
API. Set matching secrets securely without printing them. Test unauthorized calls,
save/reload, publish, contact download, and persistence across service restart.
Keep existing Mac services and customer data intact.

Draft ownership currently uses a secure HTTP-only browser cookie. This is an
interim testing mechanism, not customer account management. Customer accounts,
recovery and cross-device access must be implemented before a paid launch.
Published HTML excludes contact fields unless enabled by the customer. The
private profile JSON is never accessible through the public card route.

Vercel production protection also needs a scoped configuration allowing intended
public cards while customer management remains authenticated. Do not remove
protection from the prototype before customer authentication is ready.

## Tests

npm run build
node scripts/test-one-door.cjs
# Start npm run dev -- --hostname 127.0.0.1 --port 3101 first:
node scripts/test-card-flow.mjs

## Rollback

Keep this repair on its branch until infrastructure and customer authentication
are ready. Reverting the app does not delete Mac mini records. Preserve the
storage directory and backups across all deploys.
