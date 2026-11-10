/** Mac mini is the source of truth. Vercel never stores customer files locally. */
import { randomUUID } from "node:crypto";
import * as local from "./one-door-store-local";
import { cardSlug, type OneDoorProfile, type OneDoorCardRecord } from "./one-door";
export const validCardId = local.validCardId;
type Stored = OneDoorCardRecord & { html: string; owner: string };
const remote = () => Boolean(process.env.ONE_DOOR_STORAGE_URL);
function checkStorage() { if (process.env.VERCEL && !remote()) throw new Error("Connect Mac mini storage."); }
async function storage(path: string, body?: unknown) {
  const base = process.env.ONE_DOOR_STORAGE_URL;
  const token = process.env.ONE_DOOR_STORAGE_TOKEN;
  if (!base || !token) throw new Error("Mac mini storage is not configured.");
  const result = await fetch(new URL(path, base), {
    method: body ? "PUT" : "GET", cache: "no-store", redirect: "error",
    signal: AbortSignal.timeout(15000),
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (result.status === 404) return null;
  if (!result.ok) throw new Error("Mac mini storage unavailable.");
  return result.json();
}
async function read(id: string): Promise<Stored | null> {
  if (!validCardId(id)) return null;
  checkStorage();
  if (remote()) return storage(`cards/${id}`);
  const card = local.getCard(id);
  if (!card) return null;
  const fs = await import("node:fs/promises");
  const owner = await fs.readFile(`${local.cardsDir()}/${id}/owner`, "utf8").catch(() => "");
  return { ...card, html: local.getCardHtml(id) || "", owner };
}
async function write(card: Stored) {
  if (remote()) await storage(`cards/${card.id}`, card);
  else {
    local.updateCardHtml(card.id, card.html);
    local.updateCardMeta(card.id, { publishedUrl: card.publishedUrl });
  }
}
export async function createCard(profile: OneDoorProfile, html: string, owner: string) {
  checkStorage();
  const id = randomUUID(), now = new Date().toISOString();
  const card: Stored = { id, slug: cardSlug(profile.name, id), name: profile.name, template: profile.template, createdAt: now, updatedAt: now, publishedUrl: "", profile, html, owner };
  if (!remote()) {
    local.createCard(profile, html, id);
    const fs = await import("node:fs/promises");
    await fs.writeFile(`${local.cardsDir()}/${id}/owner`, owner, { mode: 0o600 });
  }
  await write(card);
  return card;
}
export async function getCard(id: string, owner: string) {
  const card = await read(id);
  return card && owner && card.owner === owner ? card : null;
}
export async function listCards(owner: string) {
  if (!owner) return [];
  checkStorage();
  let ids: string[] = [];
  if (remote()) ids = await storage("cards");
  else ids = local.listCards().map(c => c.id);
  const cards = await Promise.all(ids.map(id => getCard(id, owner)));
  return cards.filter(c => c !== null).map(c => ({ id: c.id, slug: c.slug, name: c.name, template: c.template, createdAt: c.createdAt, updatedAt: c.updatedAt, publishedUrl: c.publishedUrl })).sort((a,b) => b.updatedAt.localeCompare(a.updatedAt));
}
export async function setCardPage(id: string, owner: string, html: string, publishedUrl?: string) {
  const card = await getCard(id, owner);
  if (!card) return null;
  card.html = html;
  if (publishedUrl !== undefined) card.publishedUrl = publishedUrl;
  card.updatedAt = new Date().toISOString();
  await write(card);
  return card;
}
export async function getCardHtml(id: string, owner: string) {
  const card = await read(id);
  return card && (card.publishedUrl || (owner && card.owner === owner)) ? card.html : null;
}
