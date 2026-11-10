"use client";
import { ChangeEvent, FormEvent, useCallback, useEffect, useState } from "react";
import {
  PRODUCT_NAME,
  ONE_DOOR_KIND_LABELS,
  ONE_DOOR_LINK_KINDS,
  ONE_DOOR_TEMPLATES,
  ONE_DOOR_TEMPLATE_META,
  type OneDoorCardMeta,
  type OneDoorLink,
  type OneDoorLinkKind,
  type OneDoorTemplate,
} from "../lib/one-door";

type SavedResult = {
  id: string;
  slug: string;
  previewUrl: string;
  qrDataUrl: string;
  vcf: string;
  publishedUrl: string;
};

type PreviewResult = {
  html: string;
  qrDataUrl: string;
  pageUrl: string;
};

const emptyLink = (): OneDoorLink => ({
  id: crypto.randomUUID(),
  label: "",
  url: "",
  kind: "website",
});

function downloadText(filename: string, text: string, mime: string) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 500);
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export default function OneDoorPanel() {
  const [cards, setCards] = useState<OneDoorCardMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [provisionalId] = useState(() => crypto.randomUUID());

  const [template, setTemplate] = useState<OneDoorTemplate>("business");
  const [name, setName] = useState("");
  const [rolesText, setRolesText] = useState("");
  const [tagline, setTagline] = useState("");
  const [bio, setBio] = useState("");
  const [photoDataUrl, setPhotoDataUrl] = useState("");
  const [photoName, setPhotoName] = useState("");
  const [phone, setPhone] = useState("");
  const [showPhone, setShowPhone] = useState(false);
  const [email, setEmail] = useState("");
  const [showEmail, setShowEmail] = useState(false);
  const [links, setLinks] = useState<OneDoorLink[]>([emptyLink()]);

  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [saved, setSaved] = useState<SavedResult | null>(null);

  const refreshCards = useCallback(async () => {
    try {
      const res = await fetch("/api/one-door", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Cards unavailable");
      setCards((data.cards || []) as OneDoorCardMeta[]);
    } catch {
      setError("Could not load saved cards.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshCards();
  }, [refreshCards]);

  function profilePayload() {
    return {
      name: name.trim(),
      roles: rolesText.split(",").map(r => r.trim()).filter(Boolean),
      tagline: tagline.trim(),
      bio: bio.trim(),
      photoDataUrl: photoDataUrl || undefined,
      phone: phone.trim(),
      email: email.trim(),
      showPhone,
      showEmail,
      links: links.filter(l => l.label.trim() && l.url.trim()),
      template,
    };
  }

  function onPhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Photo must be a JPEG, PNG, or WebP image.");
      return;
    }
    if (file.size > 2_000_000) {
      setError("Photo is too large. Keep it under 2 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setPhotoDataUrl(String(reader.result || ""));
      setPhotoName(file.name);
      setError("");
    };
    reader.onerror = () => setError("That photo could not be read. Try another file.");
    reader.readAsDataURL(file);
  }

  async function runPreview(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(""); setNotice(""); setSaved(null);
    try {
      const res = await fetch("/api/one-door", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "preview", profile: profilePayload(), provisionalId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Preview could not be built");
      setPreview({ html: data.html, qrDataUrl: data.qrDataUrl, pageUrl: data.pageUrl });
      setNotice("Preview is ready. Check it below, then save the card when it looks right.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Preview could not be built.");
    } finally {
      setBusy(false);
    }
  }

  async function saveCard() {
    if (busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const res = await fetch("/api/one-door", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", profile: profilePayload(), provisionalId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Card could not be saved");
      setSaved({
        id: data.id,
        slug: data.slug,
        previewUrl: data.previewUrl,
        qrDataUrl: data.qrDataUrl,
        vcf: data.vcf,
        publishedUrl: data.publishedUrl || "",
      });
      setNotice("Card saved on this browser. Publish it when you are ready to share.");
      void refreshCards();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Card could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function publishCard(id: string) {
    if (busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const res = await fetch("/api/one-door", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "publish", id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Publishing failed");
      setSaved(current => (current && current.id === id
        ? { ...current, publishedUrl: data.publishedUrl, qrDataUrl: data.qrDataUrl || current.qrDataUrl }
        : current));
      setNotice(`Published. Public link: ${data.publishedUrl}`);
      void refreshCards();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Publishing failed.");
    } finally {
      setBusy(false);
    }
  }

  function updateLink(id: string, patch: Partial<OneDoorLink>) {
    setLinks(values => values.map(l => (l.id === id ? { ...l, ...patch } : l)));
  }

  const shareUrl = saved?.publishedUrl || saved?.previewUrl || preview?.pageUrl || "";
  const shareQr = saved?.qrDataUrl || preview?.qrDataUrl || "";

  return <section className="od-panel" aria-label="One Door" aria-busy={loading}>
    <div className="od-hero">
      <div className="od-eyebrow"><span className="od-orb" /> PRODUCT STUDIO</div>
      <h1>{PRODUCT_NAME}</h1>
      <p>One link, everything about a person. A digital business card, a link hub, a musician press kit, or a one-page presence for a preacher without a website. You fill in the details, {PRODUCT_NAME} builds the page.</p>
    </div>

    {error && <p className="od-state od-error" role="alert">{error}</p>}
    {notice && <p className="od-state od-success" role="status">{notice}</p>}

    <form className="od-create" onSubmit={runPreview}>
      <div className="od-section-heading"><div><span className="od-eyebrow">STEP 1</span><h2>What kind of page?</h2></div></div>
      <div className="od-templates" role="group" aria-label="Card type">
        {ONE_DOOR_TEMPLATES.map(t => <button key={t} type="button" className={template === t ? "od-template active" : "od-template"} aria-pressed={template === t} onClick={() => setTemplate(t)}>
          <strong>{ONE_DOOR_TEMPLATE_META[t].label}</strong>
          <span>{ONE_DOOR_TEMPLATE_META[t].blurb}</span>
        </button>)}
      </div>

      <div className="od-section-heading"><div><span className="od-eyebrow">STEP 2</span><h2>Who is it for?</h2></div></div>
      <label>Name<input value={name} onChange={e => setName(e.target.value)} maxLength={80} required placeholder="Full name" /></label>
      <label>What they do — comma separated<input value={rolesText} onChange={e => setRolesText(e.target.value)} maxLength={200} required placeholder="Founder, Motivational Speaker, Life Coach" /></label>
      <label>Signature line — optional<input value={tagline} onChange={e => setTagline(e.target.value)} maxLength={160} placeholder="There's purpose in your pain — embrace the process." /></label>
      <label>Short bio — optional<textarea value={bio} onChange={e => setBio(e.target.value)} maxLength={280} rows={3} placeholder="Two or three sentences about the person and their work." /></label>
      <label>Photo — optional
        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={onPhotoChange} />
      </label>
      {photoDataUrl && <div className="od-photo-row">
        <img src={photoDataUrl} alt="Chosen card photo" />
        <span>{photoName}</span>
        <button type="button" onClick={() => { setPhotoDataUrl(""); setPhotoName(""); }}>Remove</button>
      </div>}
      {!photoDataUrl && <p className="od-form-note">No photo? The card shows initials instead, marked as a photo placeholder. Use the person&rsquo;s real photo whenever you have it.</p>}

      <div className="od-section-heading"><div><span className="od-eyebrow">STEP 3</span><h2>How can people reach them?</h2></div></div>
      <p className="od-form-note">Phone and email stay off the card unless you turn them on here. Nothing is published without you saying so.</p>
      <label>Phone number<input value={phone} onChange={e => setPhone(e.target.value)} maxLength={30} inputMode="tel" placeholder="(941) 555-0100" /></label>
      <label className="od-check"><input type="checkbox" checked={showPhone} onChange={e => setShowPhone(e.target.checked)} /><span>Show the phone number on the card</span></label>
      <label>Email address<input value={email} onChange={e => setEmail(e.target.value)} maxLength={120} inputMode="email" placeholder="name@example.org" /></label>
      <label className="od-check"><input type="checkbox" checked={showEmail} onChange={e => setShowEmail(e.target.checked)} /><span>Show the email address on the card</span></label>

      <div className="od-section-heading"><div><span className="od-eyebrow">STEP 4</span><h2>Links</h2></div></div>
      <div className="od-links-edit">
        {links.map(link => <div className="od-link-row" key={link.id}>
          <input value={link.label} onChange={e => updateLink(link.id, { label: e.target.value })} maxLength={40} placeholder="Label — e.g. Website" aria-label="Link label" />
          <input value={link.url} onChange={e => updateLink(link.id, { url: e.target.value })} inputMode="url" placeholder="https://…" aria-label="Link address" />
          <select value={link.kind} onChange={e => updateLink(link.id, { kind: e.target.value as OneDoorLinkKind })} aria-label="Link type">
            {ONE_DOOR_LINK_KINDS.map(kind => <option key={kind} value={kind}>{ONE_DOOR_KIND_LABELS[kind]}</option>)}
          </select>
          <button type="button" onClick={() => setLinks(values => values.filter(l => l.id !== link.id))} aria-label="Remove link">×</button>
        </div>)}
      </div>
      <button type="button" className="od-refresh" onClick={() => setLinks(values => [...values, emptyLink()])} disabled={links.length >= 12}>＋ Add a link</button>

      <button className="od-primary" type="submit" disabled={busy || !name.trim() || !rolesText.trim()}>
        {busy ? "Building preview…" : "Preview the card"}
      </button>
      <p className="od-form-note">Preview is free and private. Nothing is saved or published until you choose to save it.</p>
    </form>

    {preview && <section className="od-result" aria-label="Card preview">
      <div className="od-section-heading"><div><span className="od-eyebrow">PREVIEW</span><h2>How the card looks</h2></div></div>
      <iframe className="od-preview-frame" title={`${PRODUCT_NAME} card preview`} sandbox="allow-scripts" srcDoc={preview.html} />
      <div className="od-share">
        {shareQr && <img src={shareQr} alt="QR code for this card" />}
        <div>
          <p><strong>Link</strong></p>
          <p className="od-url">{shareUrl}</p>
          <div className="od-actions-row">
            <button type="button" className="od-refresh" onClick={() => void copyText(shareUrl).then(ok => setNotice(ok ? "Link copied." : "Copy did not work — long-press the link instead."))}>Copy link</button>
            <button type="button" className="od-refresh" onClick={() => downloadText(`${name.trim() || "one-door-card"}.html`, preview.html, "text/html")}>Download page</button>
          </div>
        </div>
      </div>
      <button className="od-primary" type="button" disabled={busy} onClick={() => void saveCard()}>
        {busy ? "Saving…" : "Save this card"}
      </button>
    </section>}

    {saved && <section className="od-result" aria-label="Saved card">
      <div className="od-section-heading"><div><span className="od-eyebrow">SAVED</span><h2>Your card is ready</h2></div></div>
      <div className="od-share">
        {saved.qrDataUrl && <img src={saved.qrDataUrl} alt="QR code for this card" />}
        <div>
          <p><strong>{saved.publishedUrl ? "Public link" : "Private link"}</strong></p>
          <p className="od-url">{saved.publishedUrl || saved.previewUrl}</p>
          <div className="od-actions-row">
            <button type="button" className="od-refresh" onClick={() => void copyText(saved.publishedUrl || saved.previewUrl).then(ok => setNotice(ok ? "Link copied." : "Copy did not work — long-press the link instead."))}>Copy link</button>
            <button type="button" className="od-refresh" onClick={() => downloadText(`${saved.slug}.vcf`, saved.vcf, "text/vcard")}>Download contact (.vcf)</button>
            {!saved.publishedUrl && <button type="button" className="od-refresh" disabled={busy} onClick={() => void publishCard(saved.id)}>Publish card</button>}
          </div>
          {!saved.publishedUrl && <p className="od-form-note">Drafts open only in this browser. Publish to let anyone with the link view the card. Keep this browser’s cookies to retain access to your saved cards.</p>}
        </div>
      </div>
    </section>}

    <div className="od-section-heading"><div><span className="od-eyebrow">YOUR CARDS</span><h2>Saved One Door pages</h2></div>
      <button className="od-refresh" disabled={loading} onClick={() => void refreshCards()}>{loading ? "Loading…" : "Refresh"}</button></div>
    {loading && <p className="od-state" role="status">Loading saved cards…</p>}
    {!loading && cards.length === 0 && <p className="od-state">No cards yet. Build your first one above.</p>}
    {!loading && <div className="od-grid">{cards.map(card => <article className="od-card" key={card.id}>
      <div className="od-card-top"><span className="od-index">{ONE_DOOR_TEMPLATE_META[card.template].label}</span><span className="od-status"><i /> {card.publishedUrl ? "PUBLIC" : "PRIVATE"}</span></div>
      <h3>{card.name}</h3><p>{new Date(card.updatedAt).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })} · {card.slug}</p>
      <div className="od-card-foot">
        <a className="od-card-link" href={`/api/one-door/cards/${card.id}`} target="_blank" rel="noreferrer">Open</a>
        {card.publishedUrl
          ? <a className="od-card-link" href={card.publishedUrl} target="_blank" rel="noreferrer">Public link</a>
          : <button type="button" className="od-card-link od-card-button" disabled={busy} onClick={() => void publishCard(card.id)}>Publish</button>}
      </div>
    </article>)}</div>}
    <p className="od-guardrail"><span>●</span> Guardrails active: cards are built from details you enter. Nothing is published to the public web until you tap Publish, and phone and email stay off a card unless you turn them on.</p>
  </section>;
}

