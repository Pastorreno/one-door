# One Door

One-link digital presence cards — a **GGI Hub** product.

One app that builds a one-link page for a person: a digital business card,
a Linktree-style link hub, a musician EPK (Electronic Press Kit), or a
one-page presence for a preacher without a website. Black-and-gold card
design, Save to Contacts, QR code, tap-to-call/email. Phone and email stay
off a card unless the maker checks the show-toggle.

## Quick start

```bash
npm install
npm run dev        # http://localhost:3000
```

Verify:

```bash
node scripts/test-one-door.cjs
npx tsc --noEmit
npm run build
```

## How it works

1. Pick a page type (Business card / Link hub / Musician EPK / Preacher page).
2. Fill in the details — name, roles, signature line, bio, photo (≤2 MB),
   up to 12 links.
3. **Preview** renders the finished page without saving. **Save** stores
   the card and returns a private link + QR code.
4. **Publish to Vercel** deploys the page to the `one-door-cards` Vercel
   project and returns a public link; the QR code encodes that public URL.

Cards are stored as plain files under `<data>/cards/<uuid>/`
(`profile.json`, `index.html`, `meta.json`) — no database to set up.

## Environment

| Variable | Required | Purpose |
|---|---|---|
| `ONE_DOOR_DATA_DIR` | No | Card storage dir (default `~/storage/one-door`) |
| `ONE_DOOR_VERCEL_TOKEN` | For public links | Vercel account token with deployment scope |
| `ONE_DOOR_VERCEL_PROJECT` | For public links | Vercel project name (default `one-door-cards`) |

Without a token, cards still save and preview; Publish answers 503 with
setup instructions.

## Product name

The working name is **One Door**, defined in exactly one place:
`PRODUCT_NAME` in `src/lib/one-door.ts`. Change it there and the card
pages, the maker panel, and the site header follow.

## Structure

- `src/lib/one-door.ts` — validation, vCard, card-page renderer (pure logic)
- `src/lib/one-door-store.ts` — file storage for saved cards
- `src/lib/one-door-publish.ts` — Vercel REST deploy client
- `src/app/api/one-door/` — preview/create/publish, card, vCard, card page
- `src/app/OneDoorPanel.tsx` — the maker panel (home page)
- `docs/ONE_DOOR.md` — full product doc: files, publishing, going live, verification
- `docs/ggi-design-os.md` — the GGI house style (Kingdom Tech mode)

## History

Re-homed 2026-11-09 from the Melvin One card maker (branch
`melvin-one-card-maker`, draft PR #1 in Pastorreno/melvin-pro). Lawarn
decided the maker is not a Melvin product — it is its own standalone thing
under GGI Hub. Base: the GGI App Starter template (Next.js 16, React 19,
Tailwind v4, Supabase). See `docs/ONE_DOOR.md` and `CHANGELOG.md`.
