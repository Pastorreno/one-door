import { session } from "@/lib/one-door-session";
import { NextRequest, NextResponse } from "next/server";
import { getCardHtml, validCardId } from "@/lib/one-door-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Serves a saved One Door card page. This is the card's own address on
 * this app (private until the card is published to Vercel). No
 * same-origin guard here on purpose: the page is meant to be opened by
 * the person the link is shared with.
 */
export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!validCardId(id)) {
    return new NextResponse("Card not found.", { status: 404 });
  }
  const html = await getCardHtml(id, session(_req).owner);
  if (!html) {
    return new NextResponse("Card not found.", { status: 404 });
  }
  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

