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
import {
  createCard,
  getCard,
  listCards,
  updateCardHtml,
  updateCardMeta,
  validCardId,
} from "@/lib/one-door-store";
import {
  cardPublicUrl,
  deployToVercel,
  vercelProjectName,
  vercelToken,
  verifyPublicUrl,
} from "@/lib/one-door-publish";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
};

function appOrigin(req: NextRequest): string {
  const host = req.headers.get("host") || "";
  return host ? `https://${host}` : "";
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
    return NextResponse.json({ cards: listCards() }, { headers });
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
    const card = getCard(id);
    if (!card) return NextResponse.json({ error: "Card not found." }, { status: 404, headers });
    const token = vercelToken();
    if (!token) {
      return NextResponse.json(
        {
          error:
            "Vercel publishing is not set up yet. Add ONE_DOOR_VERCEL_TOKEN to the server environment (.env.local), then try again. The card itself is saved and the private link still works.",
        },
        { status: 503, headers },
      );
    }
    const project = vercelProjectName();
    const intendedUrl = cardPublicUrl(project, card.slug);
    try {
      // First deploy: the QR on the page encodes the stable public URL.
      const firstQr = await qrFor(intendedUrl);
      const firstHtml = renderCardHtml(card.profile, { pageUrl: intendedUrl, qrDataUrl: firstQr });
      const first = await deployToVercel({ token, project, slug: card.slug, html: firstHtml });
      if (!first.ok) {
        return NextResponse.json({ error: `Vercel deploy failed: ${first.error}` }, { status: 502, headers });
      }
      if (await verifyPublicUrl(intendedUrl)) {
        updateCardHtml(id, firstHtml);
        const meta = updateCardMeta(id, { publishedUrl: intendedUrl });
        return NextResponse.json(
          { publishedUrl: intendedUrl, deploymentUrl: first.deploymentUrl, qrDataUrl: firstQr, card: meta },
          { headers },
        );
      }
      // The project alias is not live yet: re-render with the deployment URL and deploy once more.
      const fallbackQr = await qrFor(first.deploymentUrl);
      const fallbackHtml = renderCardHtml(card.profile, { pageUrl: first.deploymentUrl, qrDataUrl: fallbackQr });
      const second = await deployToVercel({ token, project, slug: card.slug, html: fallbackHtml });
      if (!second.ok) {
        return NextResponse.json(
          { error: `Vercel deploy failed on retry: ${second.error}`, deploymentUrl: first.deploymentUrl },
          { status: 502, headers },
        );
      }
      updateCardHtml(id, fallbackHtml);
      const meta = updateCardMeta(id, { publishedUrl: first.deploymentUrl });
      return NextResponse.json(
        { publishedUrl: first.deploymentUrl, deploymentUrl: first.deploymentUrl, qrDataUrl: fallbackQr, card: meta },
        { headers },
      );
    } catch {
      return NextResponse.json({ error: "Publishing failed. The saved card is unaffected." }, { status: 503, headers });
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

    const pageUrl = cardAppUrl(req, provisionalId);
    const qrDataUrl = await qrFor(pageUrl);
    const html = renderCardHtml(profile, { pageUrl, qrDataUrl });
    const card = createCard(profile, html, provisionalId);
    return NextResponse.json(
      {
        id: card.id,
        slug: card.slug,
        previewUrl: pageUrl,
        qrDataUrl,
        vcf: buildVCard(profile),
        card: {
          id: card.id,
          slug: card.slug,
          name: card.name,
          template: card.template,
          createdAt: card.createdAt,
          updatedAt: card.updatedAt,
          publishedUrl: card.publishedUrl,
        },
      },
      { status: 201, headers },
    );
  } catch {
    return NextResponse.json({ error: "The card could not be built." }, { status: 503, headers });
  }
}

