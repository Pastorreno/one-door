# One Door production deployment — November 10, 2026

This deployment record supersedes the pending-activation sections in MAC_MINI_STORAGE.md.

## Result

Live app: https://one-door-two.vercel.app/
Source: Pastorreno/one-door, main. Repair PR #2 merged at fc00f83f9ce781ea449338b04bd85e99321ec0ee.
Verified production deployment: dpl_Hjvy7AVTMPdxzFcv36KRHoQcZrDa (READY).
The existing card/link-hub UI and rendering were retained. No n8n or paid subscription features were added.

## Runtime layout

Vercel project one-door (prj_IAitsn963TjIBKD4cgikPsmkhvlk) belongs to pastorrenos-projects.
Vercel holds ONE_DOOR_STORAGE_URL and encrypted ONE_DOOR_STORAGE_TOKEN for production and preview.
The storage URL is https://one-door-storage.macminhub.com/; every endpoint requires its bearer secret.

Mac mini paths:
- Source: /Users/edwinrobinson/server/one-door
- Records: /Users/edwinrobinson/storage/one-door
- Private environment file: /Users/edwinrobinson/server/one-door-storage.env (0600)
- Logs: /Users/edwinrobinson/logs/one-door
- Tunnel configuration: /Users/edwinrobinson/.cloudflared/one-door.yml
- LaunchAgents: com.ggihub.one-door-storage and com.ggihub.one-door-tunnel under ~/Library/LaunchAgents
- Task-specific backups and archived smoke-test records: ~/backups/one-door

Storage runs scripts/mac-storage.mjs using /Users/edwinrobinson/server/node22/bin/node, listening on 127.0.0.1:8794 only. LaunchAgents use RunAtLoad and KeepAlive. The dedicated Cloudflare tunnel is one-door-storage, ID 746f86bd-0262-4685-85e3-0e2d157fddeb. Existing Melvin services/tunnel were not reconfigured or restarted. After reboot, LaunchAgents require the edwinrobinson login session, consistent with their user-agent installation.

## Verification

Production build and TypeScript passed. Live API tests against the public app passed: preview, save, draft isolation, owner-only publish, public card page without cookies, multiple-card preservation, and contact consent/vCard output. Both test card records were confirmed on the Mac mini and then archived. Direct storage requests return 401 without the token and 200 for authenticated health. Local HTTP-storage tests also verified persistence across storage restart. Browser testing verified the existing Link hub form, preview, link button and QR display. Production alias was already publicly accessible; no Vercel protection settings were changed.

## Usage and limitation

Preview -> Save -> Publish card. Published cards can be opened by anyone with the link. Drafts and raw profile data require the creator browser's HTTP-only owner cookie. Keep that browser's cookies to retain access to its saved-card list. No customer sign-in/recovery system or edit feature was added. The Mac mini and its internet connection must remain online to save or open cards.

## Recovery and maintenance

Keep credentials out of git and logs. To rotate the storage secret, update the private Mac environment file and encrypted Vercel variable together, restart only com.ggihub.one-door-storage, then redeploy Vercel. Never expose the loopback storage port directly.

Health: authenticated GET /health on the dedicated storage host must return {"ok":true}; unauthenticated calls must return 401. If needed, check only the two One Door LaunchAgents and their logs. Check DNS points the storage hostname to 746f86bd-0262-4685-85e3-0e2d157fddeb.cfargotunnel.com.

To roll back, select a prior Vercel deployment. Preserve all records and private backups. Stop only the two new One Door services if explicitly requested. Do not delete records or change existing Melvin services.
