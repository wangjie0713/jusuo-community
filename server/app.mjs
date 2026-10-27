// SPDX-License-Identifier: MPL-2.0
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { createDemoAdapter, createHAAdapter, validateMap, UserError } from './adapters.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const COOKIE = 'jusuo_ce_session';
const MIME = { '.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.webmanifest':'application/manifest+json','.glb':'model/gltf-binary' };

export async function readConfig(env = process.env) {
  const mode = env.CE_MODE || 'demo';
  if (!['demo','home-assistant'].includes(mode)) throw new UserError('CE_MODE 只能是 demo 或 home-assistant。');
  const port = Number(env.CE_PORT || 4177), host = env.CE_HOST || '127.0.0.1';
  if (!Number.isInteger(port) || port < 1024 || port > 65535 || !['127.0.0.1','0.0.0.0'].includes(host)) throw new UserError('请检查 CE_PORT 和 CE_HOST。');
  const password = env.CE_PASSWORD || '';
  if (password.startsWith('REPLACE_')) throw new UserError('请把 CE_PASSWORD 占位符换成自己的长密码。');
  if ((mode !== 'demo' || host !== '127.0.0.1') && password.length < 16) throw new UserError('真实模式或局域网访问需要至少 16 位 CE_PASSWORD。');
  if (host !== '127.0.0.1' && !env.CE_PUBLIC_ORIGIN?.startsWith('https://')) throw new UserError('局域网部署需要 CE_PUBLIC_ORIGIN 指向可信 HTTPS 入口。');
  let publicOrigin = null;
  if (env.CE_PUBLIC_ORIGIN) {
    const url = new URL(env.CE_PUBLIC_ORIGIN);
    if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new UserError('CE_PUBLIC_ORIGIN 需要填写 HTTPS 根地址。');
    publicOrigin = url.origin;
  }
  let adapter;
  if (mode === 'demo') adapter = createDemoAdapter();
  else {
    if (!env.HA_TOKEN || env.HA_TOKEN.length < 16 || env.HA_TOKEN.startsWith('REPLACE_')) throw new UserError('请在服务器本地配置 HA_TOKEN。');
    let map; try { map = JSON.parse(await readFile(resolve(ROOT, 'config/entity-map.local.json'), 'utf8')); }
    catch { throw new UserError('请先创建有效的 config/entity-map.local.json。'); }
    adapter = createHAAdapter({ baseUrl: env.HA_BASE_URL, token: env.HA_TOKEN, devices: validateMap(map) });
  }
  return { mode, port, host, password, publicOrigin, adapter };
}

export function createApp({ mode = 'demo', password = '', publicOrigin = null, adapter = createDemoAdapter(), now = Date.now } = {}) {
  const sessions = new Map(), attempts = new Map(), inflight = new Map(), outcomes = new Map();
  const salt = randomBytes(16), passwordHash = password ? scryptSync(password, salt, 32) : null;
  function cleanup() {
    for (const [key, s] of sessions) if (s.expires <= now()) sessions.delete(key);
    for (const [key, s] of attempts) if (s.until <= now()) attempts.delete(key);
    for (const [key, s] of outcomes) if (s.expires <= now()) outcomes.delete(key);
  }
  function json(res, status, value) { res.writeHead(status, { 'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store' }); res.end(JSON.stringify(value)); }
  function session(req) {
    const match = String(req.headers.cookie || '').match(/(?:^|;\s*)jusuo_ce_session=([a-f0-9]{64})(?:;|$)/);
    return match ? sessions.get(match[1]) : null;
  }
  function newSession(req, res) {
    const previous = session(req); if (previous) sessions.delete(previous.id);
    if (sessions.size >= 100) sessions.delete(sessions.keys().next().value);
    const id = randomBytes(32).toString('hex'), csrf = randomBytes(24).toString('hex');
    const s = { id, csrf, expires: now() + 8 * 3600_000, requests: [] }; sessions.set(id, s);
    res.setHeader('Set-Cookie', `${COOKIE}=${id}; Path=/; HttpOnly; SameSite=Strict; Max-Age=28800${publicOrigin ? '; Secure' : ''}`);
    return s;
  }
  async function body(req) {
    if (String(req.headers['content-type'] || '').split(';')[0].trim() !== 'application/json') throw new UserError('请使用 JSON 请求。',415);
    let raw = ''; for await (const chunk of req) { raw += chunk; if (Buffer.byteLength(raw) > 8192) throw new UserError('请求内容过大。',413); }
    let value; try { value = JSON.parse(raw); } catch { throw new UserError('请求格式不正确。'); }
    if (!value || Array.isArray(value) || typeof value !== 'object') throw new UserError('请求格式不正确。');
    return value;
  }
  const server = createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options','nosniff'); res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('X-Frame-Options','DENY');
    // ImageBitmapLoader decodes the GLB's embedded PNG through a local blob fetch.
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' blob:; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
    if (publicOrigin) res.setHeader('Strict-Transport-Security','max-age=31536000');
    cleanup();
    try {
      const port = server.address()?.port;
      const allowedHosts = publicOrigin ? [new URL(publicOrigin).host] : [`127.0.0.1:${port}`,`localhost:${port}`];
      if (!allowedHosts.includes(req.headers.host)) throw new UserError('访问地址不受信任。',403);
      const origin = publicOrigin || `http://${req.headers.host}`;
      const url = new URL(req.url, origin);
      if (req.method !== 'GET' && req.headers.origin !== origin) throw new UserError('请从居所页面发起操作。',403);
      if (url.pathname === '/api/session' && req.method === 'GET') {
        const s = session(req) || (!passwordHash && mode === 'demo' ? newSession(req,res) : null);
        return json(res,200,{ mode, authenticated: Boolean(s), ...(s ? { csrf:s.csrf } : {}), version:'0.1.0-preview.3' });
      }
      if (url.pathname === '/api/login' && req.method === 'POST') {
        const key = req.socket.remoteAddress, entry = attempts.get(key) || { count:0, until:now()+300_000 };
        if (entry.count >= 5) throw new UserError('尝试次数较多，请 5 分钟后再试。',429);
        entry.count++; if (attempts.size >= 1000) attempts.delete(attempts.keys().next().value); attempts.set(key,entry);
        const input = await body(req);
        if (Object.keys(input).length !== 1 || typeof input.password !== 'string' || input.password.length > 256 || !passwordHash || !timingSafeEqual(scryptSync(input.password,salt,32),passwordHash)) throw new UserError('密码不正确，请检查本机 CE_PASSWORD。',401);
        attempts.delete(key); const s = newSession(req,res); return json(res,200,{ authenticated:true, csrf:s.csrf, mode });
      }
      if (url.pathname.startsWith('/api/')) {
        const s = session(req); if (!s) throw new UserError('请先登录居所。',401,'login_required');
        if (req.method !== 'GET' && req.headers['x-ce-csrf'] !== s.csrf) throw new UserError('页面会话已改变，请刷新后重试。',403);
        if (url.pathname === '/api/logout' && req.method === 'POST') {
          sessions.delete(s.id); res.setHeader('Set-Cookie',`${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${publicOrigin ? '; Secure' : ''}`); return json(res,200,{ ok:true });
        }
        if (url.pathname === '/api/home' && req.method === 'GET') return json(res,200,{ mode, ...(await adapter.snapshot()) });
        if (url.pathname === '/api/control' && req.method === 'POST') {
          s.requests = s.requests.filter(t => t > now()-60_000); if (s.requests.length >= 30) throw new UserError('操作有些频繁，请稍等再试。',429); s.requests.push(now());
          const input = await body(req);
          if (Object.keys(input).some(k => !['request_id','device_key','command'].includes(k)) || !/^[0-9a-f-]{36}$/.test(input.request_id || '') || !/^[a-z][a-z0-9-]{1,47}$/.test(input.device_key || '')) throw new UserError('操作格式不正确。');
          const id = `${s.id}:${input.request_id}`, fingerprint = JSON.stringify(input);
          const cached = outcomes.get(id);
          if (cached) {
            if (cached.fingerprint !== fingerprint) throw new UserError('请求编号已被使用，请刷新状态。',409);
            const answer = await cached.promise; return json(res,answer.status,answer.body);
          }
          if (inflight.has(input.device_key)) throw new UserError('设备仍在处理上一条操作，请稍等。',409);
          inflight.set(input.device_key,true);
          const promise = (async () => {
            try { const device = await adapter.control(input.device_key,input.command); return { status:200, body:{ device, verified:true, mode } }; }
            catch(error) { return { status:error instanceof UserError ? error.status : 503, body:{ error:error instanceof UserError ? error.message : '操作暂时未完成，请刷新状态查看。', code:error instanceof UserError ? error.code : 'unavailable' } }; }
            finally { inflight.delete(input.device_key); }
          })();
          if (outcomes.size >= 500) outcomes.delete(outcomes.keys().next().value);
          outcomes.set(id,{ fingerprint, promise, expires:now()+300_000 });
          const answer = await promise; return json(res,answer.status,answer.body);
        }
        throw new UserError('这个接口不在社区版中。',404);
      }
      if (req.method !== 'GET') throw new UserError('不支持此请求。',405);
      const decoded = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
      if (decoded.split('/').some(s => s.startsWith('.') || s.includes('\\')) || !MIME[extname(decoded)]) throw new UserError('没有这个页面。',404);
      const file = resolve(ROOT,'public',`.${decoded}`);
      if (!file.startsWith(resolve(ROOT,'public') + '/')) throw new UserError('没有这个页面。',404);
      let data; try { data = await readFile(file); } catch { throw new UserError('没有这个页面。',404); }
      res.writeHead(200,{ 'Content-Type':MIME[extname(decoded)],'Cache-Control':'no-cache' }); res.end(data);
    } catch(error) { json(res,error instanceof UserError ? error.status : 500,{ error:error instanceof UserError ? error.message : '服务暂时不可用，请检查本机配置。', code:error instanceof UserError ? error.code : 'unavailable' }); }
  });
  server.requestTimeout = 15000; server.headersTimeout = 10000;
  return server;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const config = await readConfig();
    const server = createApp(config);
    server.on('error', () => { console.error('启动失败：端口可能已被占用，请设置另一个 CE_PORT。'); process.exitCode = 1; });
    server.listen(config.port,config.host,() => console.log(config.publicOrigin ? '居所已启动，请通过配置的 HTTPS 地址访问。' : `居所 ${config.mode === 'demo' ? '模拟家庭' : '基础接入'}：http://127.0.0.1:${config.port}`));
  } catch(error) { console.error(error instanceof UserError ? error.message : '启动失败，请检查本地配置文件。'); process.exitCode = 1; }
}
