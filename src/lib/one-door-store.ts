/**
 * One Door card storage — plain files under the One Door data directory.
 *
 * Deliberately NOT a database table: a card is a folder, so the maker
 * works with no database to set up and nothing to migrate:
 *   <data>/cards/<uuid>/profile.json
 *   <data>/cards/<uuid>/index.html   (rendered page)
 *   <data>/cards/<uuid>/meta.json    (id, slug, timestamps, publishedUrl)
 * <data> defaults to ~/storage/one-door (ONE_DOOR_DATA_DIR overrides it).
 * Directory mode 0700, files 0600.
 */

import { mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, chmodSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { randomUUID } from "node:crypto";
import type { OneDoorCardMeta, OneDoorCardRecord, OneDoorProfile } from "./one-door";
import { cardSlug } from "./one-door";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validCardId(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

export function oneDoorDataDir(): string {
  return process.env.ONE_DOOR_DATA_DIR || join(homedir(), "storage", "one-door");
}

export function cardsDir(): string {
  const dir = join(oneDoorDataDir(), "cards");
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  chmodSync(dir, 0o700);
  return dir;
}

function cardDir(id: string): string {
  return join(cardsDir(), id);
}

function writePrivate(path: string, contents: string): void {
  writeFileSync(path, contents, { encoding: "utf8", mode: 0o600 });
  chmodSync(path, 0o600);
}

export function createCard(profile: OneDoorProfile, html: string, id: string = randomUUID()): OneDoorCardRecord {
  if (!validCardId(id)) id = randomUUID();
  const now = new Date().toISOString();
  const meta: OneDoorCardMeta = {
    id,
    slug: cardSlug(profile.name, id),
    name: profile.name,
    template: profile.template,
    createdAt: now,
    updatedAt: now,
    publishedUrl: "",
  };
  const dir = cardDir(id);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  chmodSync(dir, 0o700);
  writePrivate(join(dir, "profile.json"), JSON.stringify(profile));
  writePrivate(join(dir, "index.html"), html);
  writePrivate(join(dir, "meta.json"), JSON.stringify(meta));
  return { ...meta, profile };
}

export function getCard(id: string): OneDoorCardRecord | null {
  if (!validCardId(id)) return null;
  const dir = cardDir(id);
  try {
    const meta = JSON.parse(readFileSync(join(dir, "meta.json"), "utf8")) as OneDoorCardMeta;
    const profile = JSON.parse(readFileSync(join(dir, "profile.json"), "utf8")) as OneDoorProfile;
    return { ...meta, profile };
  } catch {
    return null;
  }
}

export function getCardHtml(id: string): string | null {
  if (!validCardId(id)) return null;
  try {
    return readFileSync(join(cardDir(id), "index.html"), "utf8");
  } catch {
    return null;
  }
}

export function listCards(): OneDoorCardMeta[] {
  const dir = cardsDir();
  let ids: string[] = [];
  try {
    ids = readdirSync(dir);
  } catch {
    return [];
  }
  const cards: OneDoorCardMeta[] = [];
  for (const id of ids) {
    if (!validCardId(id)) continue;
    try {
      const meta = JSON.parse(readFileSync(join(dir, id, "meta.json"), "utf8")) as OneDoorCardMeta;
      cards.push(meta);
    } catch {
      // A half-written card folder is skipped; it never blocks the list.
    }
  }
  cards.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  return cards;
}

export function updateCardMeta(id: string, patch: Partial<Pick<OneDoorCardMeta, "publishedUrl">>): OneDoorCardMeta | null {
  const card = getCard(id);
  if (!card) return null;
  const meta: OneDoorCardMeta = {
    ...card,
    updatedAt: new Date().toISOString(),
    publishedUrl: patch.publishedUrl ?? card.publishedUrl,
  };
  writePrivate(join(cardDir(id), "meta.json"), JSON.stringify(meta));
  return meta;
}

export function updateCardHtml(id: string, html: string): boolean {
  if (!validCardId(id) || !existsSync(join(cardDir(id), "meta.json"))) return false;
  writePrivate(join(cardDir(id), "index.html"), html);
  const card = getCard(id);
  if (card) {
    writePrivate(
      join(cardDir(id), "meta.json"),
      JSON.stringify({ ...card, updatedAt: new Date().toISOString() }),
    );
  }
  return true;
}

