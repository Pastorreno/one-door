import { session } from "@/lib/one-door-session";
import { NextRequest, NextResponse } from "next/server";
import { allowedOrigin } from "@/lib/request-origin";
import { buildVCard } from "@/lib/one-door";
import { getCard, validCardId } from "@/lib/one-door-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
};

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!allowedOrigin(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403, headers });
  }
  const { id } = await context.params;
  if (!validCardId(id)) {
    return NextResponse.json({ error: "Unknown card." }, { status: 400, headers });
  }
  const card = await getCard(id, session(req).owner);
  if (!card) {
    return NextResponse.json({ error: "Card not found." }, { status: 404, headers });
  }
  if (req.nextUrl.searchParams.get("download") === "vcf") {
    return new NextResponse(buildVCard(card.profile), {
      headers: {
        ...headers,
        "Content-Type": "text/vcard; charset=utf-8",
        "Content-Disposition": `attachment; filename="${card.slug}.vcf"`,
      },
    });
  }
  return NextResponse.json(
    {
      card: {
        id: card.id,
        slug: card.slug,
        name: card.name,
        template: card.template,
        createdAt: card.createdAt,
        updatedAt: card.updatedAt,
        publishedUrl: card.publishedUrl,
        profile: card.profile,
      },
    },
    { headers },
  );
}

