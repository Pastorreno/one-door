/**
 * One Door verification — unit tests for the pure maker logic and the
 * file store. Run: node scripts/test-one-door.cjs
 *
 * Covers: profile validation (including the phone/email consent rules),
 * vCard output, card HTML rendering and escaping, slug rules, the file
 * store round-trip, and the Vercel deployment payload shape.
 * Live Vercel deploys are NOT tested here: they need the server token and
 * are verified on the Mac mini after install (see docs/ONE_DOOR.md).
 */
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "one-door-test-"));
process.env.ONE_DOOR_DATA_DIR = path.join(temp, "data");

function compile(relPath) {
  const src = fs.readFileSync(path.join(root, relPath), "utf8");
  const out = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  // .js (not .cjs): the store requires "./one-door" extensionless, and
  // Node only resolves .js/.json/.node that way. package.json has no
  // "type": "module", so .js stays CommonJS.
  const dest = path.join(temp, path.basename(relPath, ".ts") + ".js");
  fs.writeFileSync(dest, out);
  return dest;
}

const lib = require(compile("src/lib/one-door.ts"));
const store = require(compile("src/lib/one-door-store-local.ts"));
const publish = require(compile("src/lib/one-door-publish.ts"));

const validProfile = {
  name: "Mareneo Flournoy",
  roles: ["Founder", "Motivational Speaker"],
  tagline: "There's purpose in your pain — embrace the process.",
  bio: "Christian leader and coach.",
  phone: "(941) 479-8708",
  email: "admin@jgcommunity.org",
  showPhone: true,
  showEmail: true,
  links: [
    { id: "l1", label: "Website", url: "https://jgmovement.com", kind: "website" },
    { id: "l2", label: "Listen", url: "https://example.org/music", kind: "music" },
  ],
  template: "business",
};

/* ---- validation ---- */
let v = lib.validateProfile(validProfile);
assert.equal(v.ok, true, "valid profile passes");
assert.equal(v.profile.roles.length, 2);
assert.equal(v.profile.template, "business");

assert.equal(lib.validateProfile({ ...validProfile, name: "" }).ok, false, "name required");
assert.equal(lib.validateProfile({ ...validProfile, name: "x".repeat(81) }).ok, false, "name too long");
assert.equal(lib.validateProfile({ ...validProfile, roles: [] }).ok, false, "roles required");
assert.equal(lib.validateProfile({ ...validProfile, roles: ["a", "b", "c", "d", "e", "f"] }).ok, false, "max 5 roles");
assert.equal(
  lib.validateProfile({ ...validProfile, links: [{ id: "x", label: "Bad", url: "not-a-url", kind: "website" }] }).ok,
  false,
  "link must be http(s)",
);
assert.equal(
  lib.validateProfile({ ...validProfile, showPhone: true, phone: "" }).ok,
  false,
  "showPhone without a phone number fails",
);
assert.equal(
  lib.validateProfile({ ...validProfile, showEmail: true, email: "" }).ok,
  false,
  "showEmail without an email address fails",
);
assert.equal(
  lib.validateProfile({ ...validProfile, showPhone: false, showEmail: false }).ok,
  true,
  "phone/email may be present but hidden",
);
assert.equal(
  lib.validateProfile({ ...validProfile, photoDataUrl: "data:image/gif;base64,AAAA" }).ok,
  false,
  "GIF photos are rejected",
);
assert.equal(
  lib.validateProfile({ ...validProfile, logoDataUrl: "data:image/gif;base64,AAAA" }).ok,
  false,
  "GIF logos are rejected",
);
assert.equal(
  lib.validateProfile({ ...validProfile, logoDataUrl: "data:image/png;base64,iVBORw0KGgo=" }).ok,
  true,
  "PNG logo passes",
);
assert.equal(
  lib.validateProfile({ ...validProfile, template: "nonsense" }).profile.template,
  "business",
  "unknown template falls back to business",
);

/* ---- vCard ---- */
const vcf = lib.buildVCard(v.profile);
assert.match(vcf, /^BEGIN:VCARD\r\nVERSION:3\.0\r\nFN:Mareneo Flournoy\r\n/);
assert.match(vcf, /TEL;TYPE=CELL:\(941\) 479-8708/);
assert.match(vcf, /EMAIL:admin@jgcommunity\.org/);
assert.match(vcf, /URL:https:\/\/jgmovement\.com/);
assert.match(vcf, /END:VCARD\r\n$/);
const hidden = lib.validateProfile({ ...validProfile, showPhone: false, showEmail: false }).profile;
const hiddenVcf = lib.buildVCard(hidden);
assert.doesNotMatch(hiddenVcf, /TEL/);
assert.doesNotMatch(hiddenVcf, /EMAIL/);

/* ---- rendering + escaping ---- */
const nasty = lib.validateProfile({
  ...validProfile,
  name: 'Evil <script>alert("x")</script> Person',
  roles: ["Role & <b>bold</b>"],
  showPhone: false,
  showEmail: false,
}).profile;
const html = lib.renderCardHtml(nasty, {
  pageUrl: "https://example.org/cards/evil-12345678/",
  qrDataUrl: "data:image/png;base64,iVBORw0KGgo=",
});
assert.doesNotMatch(html, /<script>alert/);
assert.match(html, /Evil &lt;script&gt;/);
assert.match(html, /Role &amp; &lt;b&gt;bold&lt;\/b&gt;/);
assert.doesNotMatch(html, /tel:/, "phone hidden when showPhone is false");
assert.doesNotMatch(html, /mailto:/, "email hidden when showEmail is false");
assert.match(html, /data:image\/png;base64,iVBORw0KGgo=/, "QR image embedded");
assert.match(html, /Save Contact/);
assert.match(html, /data-qr-toggle/, "QR toggle present");
assert.match(html, /data-share/, "share control present");
assert.match(html, /Show QR Code/);
assert.match(html, /Share Card/);
assert.match(html, /https:\/\/example\.org\/music/, "music link present");
assert.doesNotMatch(html, /data-flip/, "no flip control in the new design");

const shown = lib.renderCardHtml(v.profile, {
  pageUrl: "https://example.org/cards/mareneo-12345678/",
  qrDataUrl: "data:image/png;base64,iVBORw0KGgo=",
});
assert.match(shown, /tel:9414798708/);
assert.match(shown, /sms:9414798708/, "text action uses sms:");
assert.match(shown, /mailto:admin@jgcommunity\.org/);
assert.match(shown, /Call/);
assert.match(shown, /Text/);
assert.match(shown, /Email/);

/* ---- title / roles split ---- */
const titled = lib.validateProfile({
  ...validProfile,
  roles: ["Chief Operating Officer", "Stepping Stone Empowerment Center", "Speaker", "Mentor", "Community Leader"],
}).profile;
const titledHtml = lib.renderCardHtml(titled, {
  pageUrl: "https://example.org/cards/x/",
  qrDataUrl: "data:image/png;base64,iVBORw0KGgo=",
});
assert.match(titledHtml, /Chief Operating Officer<br>Stepping Stone Empowerment Center/, "first two roles form the title block");
assert.match(titledHtml, /Speaker &middot; Mentor &middot; Community Leader/, "remaining roles form the grey line");

/* ---- logo ---- */
const withLogo = lib.renderCardHtml(
  lib.validateProfile({ ...validProfile, logoDataUrl: "data:image/png;base64,iVBORw0KGgo=" }).profile,
  {
    pageUrl: "https://example.org/cards/mareneo-12345678/",
    qrDataUrl: "data:image/png;base64,iVBORw0KGgo=",
  },
);
assert.match(withLogo, /class="od-logo"/, "logo renders when provided");
assert.doesNotMatch(shown, /class="od-logo"/, "no logo block without a logo");

/* ---- slugs ---- */
assert.equal(lib.slugifyName("Mareneo Flournoy"), "mareneo-flournoy");
assert.match(lib.cardSlug("Mareneo Flournoy", randomUUID()), /^mareneo-flournoy-[0-9a-f]{8}$/);
assert.equal(lib.initialsFor("Mareneo Flournoy"), "MF");

/* ---- store round-trip (isolated ONE_DOOR_DATA_DIR) ---- */
const created = store.createCard(v.profile, shown);
assert.equal(store.validCardId(created.id), true);
assert.match(created.slug, /^mareneo-flournoy-/);
const fetched = store.getCard(created.id);
assert.equal(fetched.profile.name, "Mareneo Flournoy");
assert.equal(store.getCardHtml(created.id), shown);
assert.equal(store.getCard("not-a-uuid"), null);
assert.equal(store.getCard(randomUUID()), null, "unknown id returns null");
assert.equal(store.listCards().length, 1);
const updated = store.updateCardMeta(created.id, { publishedUrl: "https://one-door-cards.vercel.app/cards/x/" });
assert.equal(updated.publishedUrl, "https://one-door-cards.vercel.app/cards/x/");
assert.equal(store.updateCardHtml(created.id, "<html>replaced</html>"), true);
assert.equal(store.getCardHtml(created.id), "<html>replaced</html>");
assert.equal(store.updateCardHtml("not-a-uuid", "x"), false);

/* ---- publish payload ---- */
assert.equal(publish.cardPublicUrl("one-door-cards", "reno-abc12345"), "https://one-door-cards.vercel.app/cards/reno-abc12345/");
assert.equal(publish.vercelProjectName(), "one-door-cards");
assert.equal(publish.vercelToken(), "", "no token in this test environment");
const payload = publish.buildDeploymentPayload("one-door-cards", "reno-abc12345", "<html>hi</html>");
assert.equal(payload.name, "one-door-cards");
assert.equal(payload.target, "production");
assert.equal(payload.files[0].file, "cards/reno-abc12345/index.html");
assert.equal(Buffer.from(payload.files[0].data, "base64").toString("utf8"), "<html>hi</html>");

console.log("one-door: all assertions passed");
console.log(`temp data dir: ${temp}`);

