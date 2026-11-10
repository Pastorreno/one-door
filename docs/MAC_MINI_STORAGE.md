# One Door storage repair

## Scope
Keep the existing digital business card / link-hub code and design. Finish saving
and sharing. No n8n, visitor follow-up, subscriptions, customer account system, or
new product features are included in this repair.

## Architecture
Source remains Pastorreno/one-door on GitHub. Vercel renders the app. The Mac mini
stores records and card HTML under ~/storage/one-door. The dedicated storage
server is scripts/mac-storage.mjs, bound only to 127.0.0.1:8794 by default.
Its API requires a strong ONE_DOOR_STORAGE_TOKEN for every request. Writes are
atomic and files have mode 0600. No credentials are stored in GitHub.
Vercel needs ONE_DOOR_STORAGE_URL (HTTPS URL ending in /) and the matching secret.
No Blob storage or per-card Vercel deployments are used.

## Publishing and privacy
Each card keeps its own stable app URL. Only Publish makes its rendered HTML
public. Draft listing, raw profiles, and publishing require the creator browser's
HTTP-only owner cookie. Keep that cookie to retain management access. This is a
simple card maker, not an account/subscription service. Contact fields appear in
HTML and vCards only when their visibility toggles are enabled.

Preview links are not offered for sharing before save. Saved page downloads and
QR codes reference the saved card's real ID, not the preview's provisional ID.

## Verified
TypeScript, production build, original unit tests and local API tests pass.
The full API flow also passes using the separate HTTP storage server, including
unauthorized storage rejection and persistence after restarting that server.
Live Vercel-to-Mac testing remains pending network setup.

## Pending activation
The Mac mini is online; port 8794 was unused. Automatic approval review rejected
creating a new Cloudflare tunnel without specific approval for that connection.
Proposed dedicated endpoint: one-door-storage.macminhub.com, protected by the
storage bearer secret. No existing Melvin tunnel/service should be altered.
After approval, create a separate tunnel and service, set encrypted Vercel
variables, run health checks, deploy and test the real flow. Configure production
access so published cards can be opened outside Vercel while retaining preview
protection and application draft ownership checks.

## Rollback
Roll back Vercel to the previous deployment if needed. Stop only the new isolated
storage service and tunnel; retain Mac records and backups. Do not delete data.
