# One Door — one-link digital presence cards

A **GGI Hub** product. Added 2026-11-09 as a standalone app on branch
`one-door-launch` in the `one-door` repo. Not live until it is deployed to
Vercel and reviewed (see "Going live").

Re-homed from the Melvin One card maker (branch `melvin-one-card-maker`,
draft PR #1 in Pastorreno/melvin-pro, 2026-11-09). Lawarn decided the
maker is not a Melvin product — it is its own thing under GGI Hub, where
all of his business stuff goes. The code was moved here, Melvin branding
and Melvin-specific wiring removed, and the product renamed to the
provisional name **One Door**. The name is a single constant —
`PRODUCT_NAME` in `src/lib/one-door.ts` — change it there and the card
pages, the maker panel, and the site header follow.

## What it is

One app that builds a one-link page that works as:

- a digital business card (photo, name, roles, tap-to-call/email, save-contact),
- a Linktree-style link hub (all links on one page),
- a musician EPK (bio, photo, music, video, shows, booking),
- a one-page presence for a preacher without a website (sermons, where they
  are preaching, giving, how to invite them).

The card design is the light card: white card on a soft grey page, red
accent bar across the top, brand mark above a photo-and-name header, black
Save Contact button, Call / Text / Email actions, contact lines, link rows,
and a QR / Share footer. The house style is GGI's "Kingdom Tech" mode
(see `docs/ggi-design-os.md`); the red accent comes from the card owner's
own brand mark.

## How it works, end to end

1. Open the app — the maker is the home page, not a drawer inside another
   product.
2. Pick a page type (Business card / Link hub / Musician EPK / Preacher page).
3. Enter the person's details: name, roles, signature line, short bio,
   photo (upload, JPEG/PNG/WebP, under 2 MB), links (up to 12, each with a
   kind: website, social, music, video, booking, sermon, giving, other).
4. Phone and email are **off by default**. Each has a checkbox — "Show the
   phone number on the card" / "Show the email address on the card". The
   card, the vCard, and the API all refuse to publish a number or address
   unless its box is checked. Nothing is published without the maker
   saying so.
5. **Preview** renders the finished page (server-side, no save) in the
   panel. **Save** stores the card and returns a private link on this app
   plus a QR code.
6. **Publish to Vercel** deploys the page to the `one-door-cards` Vercel
   project and returns a public link. The page's QR code encodes that
   public link. See "Publishing" below.

## Files

- `src/lib/one-door.ts` — pure logic: profile type, validation, vCard
  builder, card-page renderer (light card, red accent, inline
  Save-to-Contacts via an embedded vCard, QR image). No I/O, no secrets.
  All user text is HTML-escaped, and values embedded in the inline script
  are unicode-escaped so a name can never break out of the script block.
  Holds `PRODUCT_NAME` — the single source of truth for the product name.
- `src/lib/one-door-store.ts` — file storage under the One Door data dir
  (`<data>/cards/<uuid>/{profile.json,index.html,meta.json}`),
  mode 0700 dirs / 0600 files. Deliberately NOT a database table: a card
  is a folder, so the maker works with no database to set up and nothing
  to migrate.
- `src/lib/one-door-publish.ts` — Vercel REST API client: stable public
  URL `https://<project>.vercel.app/cards/<slug>/`, deployment payload
  builder, deploy call, public-URL liveness check. The token comes from
  the server environment only.
- `src/app/api/one-door/route.ts` — GET lists saved cards; POST
  `preview` / `create` / `publish`. Same-origin guarded, 3.5 MB body cap.
- `src/app/api/one-door/[id]/route.ts` — GET one card; `?download=vcf`
  returns the contact file.
- `src/app/api/one-door/cards/[id]/route.ts` — serves a saved card page
  as HTML. No same-origin guard on purpose: the page is meant to be opened
  by the person the link is shared with (still private until published
  to Vercel).
- `src/app/OneDoorPanel.tsx` — the maker panel: type picker, details
  form, photo upload, consent toggles, link editor, live preview, save,
  publish, and the saved-cards list.
- `src/app/page.tsx` — the home page: product header and the maker panel.
- `src/app/globals.css` — Tailwind v4 + `.od-*` panel styles in the
  GGI Kingdom Tech palette (charcoal, white, gold).
- `scripts/test-one-door.cjs` — unit tests (validation, consent rules,
  vCard, rendering/escaping, slugs, store round-trip, deploy payload).
- `package.json` — adds `qrcode` (QR generation, server-side) and
  `@types/qrcode` (dev), on the GGI App Starter base (Next.js 16, React 19,
  Tailwind v4, Supabase client included by the template — not used by the
  card maker yet).

## Publishing

Public links need a Vercel account token with deployment scope:

```
ONE_DOOR_VERCEL_TOKEN=<token>        # secret — server .env.local only, never git
ONE_DOOR_VERCEL_PROJECT=one-door-cards
```

Without the token, cards still save and preview, and Publish answers 503
with setup instructions. The publish flow deploys the page with a QR code
for the stable project URL, checks that the URL answers, and if the
project alias is not live yet re-renders once with the deployment URL and
deploys again. The first publish creates the `one-door-cards` project.

## Going live

This repo is standalone — deploy it like any Next.js app on Vercel:

1. Create the Vercel project from this repo (import `Pastorreno/one-door`,
   branch `one-door-launch` once reviewed, or `main` after merge).
2. Set environment variables in Vercel: `ONE_DOOR_VERCEL_TOKEN` and
   `ONE_DOOR_VERCEL_PROJECT=one-door-cards` (for public links).
3. Deploy, then run the verification below against the deployed URL.
4. Publish one test card and open its public link from a device that has
   never seen the app, to confirm it loads.

## Rollback

The maker is the whole app — there is nothing to roll back to except the
GGI App Starter template. Saved cards live in `<data>/one-door/` and are
untouched by a code rollback — delete that folder only if the cards
themselves should go. No database migration is involved.

## Verification (this branch, 2026-11-09)

- `node scripts/test-one-door.cjs` — all assertions pass (validation,
  phone/email consent rules, vCard, HTML escaping incl. a script-breakout
  attempt in the name field, slugs, store round-trip, deploy payload).
- `npx tsc --noEmit` — exit 0.
- `npm run build` — exit 0; routes `/api/one-door`,
  `/api/one-door/[id]`, `/api/one-door/cards/[id]` registered.
- Live API check against an isolated ONE_DOOR_DATA_DIR on a local
  `next start`: preview → 200, create → 201, card page → 200 HTML,
  vCard download → 200 text/vcard, card list → 200,
  publish with no token → 503 with setup instructions. Consent check:
  a phone sent with its show-toggle off is stripped from the card and
  the vCard (no `tel:` link, no `TEL` line). Path-traversal and unknown
  card ids → 404. Card files land as `profile.json` / `index.html` /
  `meta.json` under `<data>/one-door/cards/<uuid>/`.
- Not verified here (needs his call): a live Vercel deploy with a real
  token, and a public link opened outside the app.

## Open decisions for Lawarn

- The name "One Door" is provisional; confirm it or pick another — it is
  one constant, `PRODUCT_NAME` in `src/lib/one-door.ts`.
- Vercel token: add `ONE_DOOR_VERCEL_TOKEN` to enable public links, or
  keep cards private-only for now.
- His own card: the panel takes an uploaded photo — his profile photo is
  not bundled into the repo.
