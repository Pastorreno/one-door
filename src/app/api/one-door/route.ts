import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import QRCode from "qrcode";
import { allowedOrigin } from "@/lib/request-origin";
import {
  ONE_DOOR_LIMITS,
  buildVCard,
  renderCardHtml,
  validateProfile,
  type OneDoorProfile,
} from "@/lib/one-door";
import { createCard, getCard, listCards, setCardPage, validCardId } from "@/lib/one-door-store";
import { session, withSession } from "@/lib/one-door-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
};

function appOrigin(req: NextRequest): string {
  const host = req.headers.get("host") || "";
  return host ? `${process.env.NODE_ENV === "development" ? "http" : "https"}://${host}` : "";
}

function cardAppUrl(req: NextRequest, id: string): string {
  return `${appOrigin(req)}/api/one-door/cards/${id}`;
}

async function qrFor(url: string): Promise<string> {
  return QRCode.toDataURL(url, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 480,
    color: { dark: "#000000", light: "#ffffff" },
  });
}

export async function GET(req: NextRequest) {
  if (!allowedOrigin(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403, headers });
  }
  try {
    const { owner, token } = session(req);
    return withSession(NextResponse.json({ cards: await listCards(owner) }, { headers }), token);
  } catch {
    return NextResponse.json({ error: "Saved cards are temporarily unavailable." }, { status: 503, headers });
  }
}

export async function POST(req: NextRequest) {
  if (!allowedOrigin(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403, headers });
  }
  if (Number(req.headers.get("content-length") || 0) > ONE_DOOR_LIMITS.requestMaxBytes) {
    return NextResponse.json({ error: "Card request is too large." }, { status: 413, headers });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid card request." }, { status: 400, headers });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid card request." }, { status: 400, headers });
  }
  const value = body as Record<string, unknown>;
  const action = value.action === "publish" ? "publish" : value.action === "preview" ? "preview" : "create";

  /* ---------------- publish: needs only an id ---------------- */
  if (action === "publish") {
    const id = typeof value.id === "string" ? value.id : "";
    if (!validCardId(id)) return NextResponse.json({ error: "Unknown card." }, { status: 400, headers });
    const { owner } = session(req);
    try {
      const card = await getCard(id, owner);
      if (!card) return NextResponse.json({ error: "Card not found." }, { status: 404, headers });
      const publishedUrl = cardAppUrl(req, id);
      const qrDataUrl = await qrFor(publishedUrl);
      const html = renderCardHtml(card.profile, { pageUrl: publishedUrl, qrDataUrl });
      await setCardPage(id, owner, html, publishedUrl);
      return NextResponse.json({ publishedUrl, qrDataUrl }, { headers });
    } catch {
      return NextResponse.json({ error: "Publishing failed. Please try again." }, { status: 503, headers });
    }
  }

  /* ---------------- preview / create: need a profile ---------------- */
  const validation = validateProfile(value.profile);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.errors.join(" ") }, { status: 400, headers });
  }
  const profile: OneDoorProfile = validation.profile;

  const provisionalId =
    typeof value.provisionalId === "string" && validCardId(value.provisionalId)
      ? value.provisionalId
      : randomUUID();

  try {
    if (action === "preview") {
      const pageUrl = cardAppUrl(req, provisionalId);
      const qrDataUrl = await qrFor(pageUrl);
      const html = renderCardHtml(profile, { pageUrl, qrDataUrl });
      return NextResponse.json({ provisionalId, pageUrl, qrDataUrl, html, vcf: buildVCard(profile) }, { headers });
    }

    const { owner, token } = session(req);
    const card = await createCard(profile, "", owner);
    const pageUrl = cardAppUrl(req, card.id);
    const qrDataUrl = await qrFor(pageUrl);
    await setCardPage(card.id, owner, renderCardHtml(profile, { pageUrl, qrDataUrl }));
    return withSession(NextResponse.json({
      id: card.id, slug: card.slug, previewUrl: pageUrl, qrDataUrl, vcf: buildVCard(profile),
    }, { status: 201, headers }), token);

  } catch {
    return NextResponse.json({ error: "The card could not be built." }, { status: 503, headers });
  }
}

