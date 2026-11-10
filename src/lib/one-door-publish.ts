/**
 * One Door publishing — puts a finished card page on Vercel so it has a
 * public, shareable link. Uses the Vercel REST API directly with a token
 * from the server environment (ONE_DOOR_VERCEL_TOKEN). The token is never
 * logged, never returned to the browser, and never written to git.
 *
 * The card's public URL is stable by design: every card lives at
 *   https://<project>.vercel.app/cards/<slug>/
 * so the QR code printed on the card can be generated for the final URL
 * before the first deploy. After deploying, the route verifies that URL
 * responds; if the project alias is not live yet, it re-renders once with
 * the deployment URL Vercel returned and deploys again.
 */

export function vercelProjectName(): string {
  return (process.env.ONE_DOOR_VERCEL_PROJECT || "one-door-cards").trim() || "one-door-cards";
}

export function vercelToken(): string {
  return (process.env.ONE_DOOR_VERCEL_TOKEN || "").trim();
}

export function cardPublicUrl(project: string, slug: string): string {
  return `https://${project}.vercel.app/cards/${slug}/`;
}

export type VercelDeploymentFile = {
  file: string;
  data: string;
  encoding: "base64";
};

export function buildDeploymentPayload(project: string, slug: string, html: string): {
  name: string;
  target: string;
  projectSettings: { framework: null };
  files: VercelDeploymentFile[];
} {
  return {
    name: project,
    target: "production",
    projectSettings: { framework: null },
    files: [
      {
        file: `cards/${slug}/index.html`,
        data: Buffer.from(html, "utf8").toString("base64"),
        encoding: "base64",
      },
    ],
  };
}

export type VercelDeployResult =
  | { ok: true; deploymentUrl: string; aliasUrl: string }
  | { ok: false; error: string };

export async function deployToVercel(args: {
  token: string;
  project: string;
  slug: string;
  html: string;
  timeoutMs?: number;
}): Promise<VercelDeployResult> {
  const payload = buildDeploymentPayload(args.project, args.slug, args.html);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), args.timeoutMs ?? 30000);
  try {
    const res = await fetch("https://api.vercel.com/v13/deployments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${args.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const data: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      const message =
        data && typeof data === "object" && "error" in data && (data as { error?: { message?: string } }).error?.message
          ? String((data as { error: { message: string } }).error.message)
          : `Vercel returned HTTP ${res.status}`;
      return { ok: false, error: message };
    }
    const url = data && typeof data === "object" && "url" in data ? String((data as { url: unknown }).url) : "";
    if (!url) return { ok: false, error: "Vercel did not return a deployment URL." };
    const alias =
      data && typeof data === "object" && "alias" in data && Array.isArray((data as { alias: unknown }).alias)
        ? String(((data as { alias: unknown[] }).alias[0] as string) || "")
        : "";
    return { ok: true, deploymentUrl: `https://${url}`, aliasUrl: alias ? `https://${alias}` : "" };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Vercel deploy failed." };
  } finally {
    clearTimeout(timer);
  }
}

/** Cheap liveness check: does the public URL answer 200? */
export async function verifyPublicUrl(url: string, timeoutMs = 8000): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method: "GET", signal: controller.signal, redirect: "follow" });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

