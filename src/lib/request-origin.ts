import type { NextRequest } from "next/server";

export function allowedOrigin(req: NextRequest): boolean {
  if (req.headers.get("sec-fetch-site") === "cross-site") return false;
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    const url = new URL(origin);
    return ["http:", "https:"].includes(url.protocol) && url.host === req.headers.get("host");
  } catch { return false; }
}
