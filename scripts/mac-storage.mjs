/** Run behind an authenticated HTTPS tunnel; listens on loopback only. */
import http from 'node:http';
import { timingSafeEqual, randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
const token = process.env.ONE_DOOR_STORAGE_TOKEN;
if (!token || token.length < 32) throw new Error('Set a strong ONE_DOOR_STORAGE_TOKEN.');
const root = process.env.ONE_DOOR_DATA_DIR || join(homedir(), 'storage/one-door');
await mkdir(root, { recursive: true, mode: 0o700 });
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
http.createServer(async (req, res) => {
 const reply = (status, body) => { res.writeHead(status, {'Content-Type':'application/json','Cache-Control':'no-store'}); res.end(JSON.stringify(body)); };
 const supplied = Buffer.from(req.headers.authorization || '');
 const expected = Buffer.from(`Bearer ${token}`);
 if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return reply(401, {error:'Unauthorized'});
 const path = new URL(req.url, 'http://localhost').pathname;
 try {
  if (req.method === 'GET' && path === '/health') return reply(200, {ok:true});
  if (req.method === 'GET' && path === '/cards') return reply(200, (await readdir(root)).filter(f => f.endsWith('.json') && uuid.test(f.slice(0,-5))).map(f => f.slice(0,-5)));
  const id = path.startsWith('/cards/') ? path.slice(7) : '';
  if (!uuid.test(id)) return reply(404, {error:'Not found'});
  const file = join(root, `${id}.json`);
  if (req.method === 'GET') return reply(200, JSON.parse(await readFile(file,'utf8')));
  if (req.method !== 'PUT') return reply(405, {error:'Method not allowed'});
  const chunks = []; let size = 0;
  for await (const chunk of req) { size += chunk.length; if (size > 10000000) return reply(413,{error:'Too large'}); chunks.push(chunk); }
  const card = JSON.parse(Buffer.concat(chunks).toString());
  if (card.id !== id || !/^[a-f0-9]{64}$/.test(card.owner) || typeof card.html !== 'string' || !card.profile) return reply(400,{error:'Invalid card'});
  const tmp = join(root, `${id}.${randomUUID()}.tmp`);
  await writeFile(tmp, JSON.stringify(card), {mode:0o600});
  await rename(tmp,file);
  reply(200,{ok:true});
 } catch (error) { reply(error.code === 'ENOENT' ? 404 : 500, {error:'Storage request failed'}); }
}).listen(Number(process.env.PORT || 8794), '127.0.0.1', () => console.log('One Door storage listening on loopback.'));
