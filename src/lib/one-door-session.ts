import { createHash, randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
const name = "one_door_owner";
export function session(req: NextRequest) {
  const existing = req.cookies.get(name)?.value;
  const token = existing && /^[a-f0-9]{64}$/.test(existing) ? existing : randomBytes(32).toString("hex");
  return { token, owner: createHash("sha256").update(token).digest("hex") };
}
export function withSession(response: NextResponse, token: string) {
  response.cookies.set(name, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
  return response;
}
