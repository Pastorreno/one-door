# Changelog

## 0.1.0 — 2026-11-09

One Door as a standalone GGI Hub product, on branch `one-door-launch`.

Re-homed from the Melvin One card maker (branch `melvin-one-card-maker`,
draft PR #1 in Pastorreno/melvin-pro). All maker capabilities kept:
4 templates (business card, link hub, musician EPK, preacher page),
details form, photo upload (≤2 MB), links editor (≤12), preview, save,
publish to Vercel with public link + QR, vCard download, tap-to-call/email,
phone/email off by default.

What changed vs. the melvin-pro version:

- New home: standalone repo `Pastorreno/one-door`, on the GGI App Starter
  base (Next.js 16.2.1, React 19, Tailwind v4, Supabase template).
- Name: "Melvin One" → provisional **One Door**, as one constant
  (`PRODUCT_NAME` in `src/lib/one-door.ts`).
- No Melvin wiring: no Melvin brain, no bridge token, no tailnet-only
  assumptions. The maker is the app's home page, not a drawer panel inside
  the Melvin console; the "Back to Melvin" button is gone.
- Env vars renamed: `MELVIN_ONE_VERCEL_TOKEN` → `ONE_DOOR_VERCEL_TOKEN`,
  `MELVIN_ONE_VERCEL_PROJECT` → `ONE_DOOR_VERCEL_PROJECT`,
  `MELVIN_DATA_DIR` → `ONE_DOOR_DATA_DIR`. Card storage default
  `~/storage/one-door` (was `~/storage/melvin-pro/melvin-one`).
- Panel styles recolored from the Melvin console's blue theme to the GGI
  "Kingdom Tech" palette (deep charcoal, white, gold); class prefix
  `.mo-` / `.agent-` → `.od-`. The generated card pages keep their
  black-and-gold design.
- Card storage documented as files by design (no database, no migration);
  the live Melvin conversations database is no longer part of the story.

Verified: unit tests pass, `tsc --noEmit` exit 0, `npm run build` exit 0,
live API smoke test (preview 200, create 201, card page 200, vCard 200,
list 200, publish-no-token 503). See `docs/ONE_DOOR.md`.

Not live. Needs Lawarn: final name, Vercel token for public links vs
private-only, review/merge, deploy.
