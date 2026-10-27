// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { createApp, readConfig } from '../server/app.mjs';

async function run(t, options = {}) {
  const server = createApp(options); server.listen(0,'127.0.0.1'); await once(server,'listening');
  t.after(() => { server.closeAllConnections(); server.close(); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  return { origin, get:path => fetch(origin+path), post:(path,body,headers={}) => fetch(origin+path,{ method:'POST',headers:{ Origin:origin,'Content-Type':'application/json',...headers },body:JSON.stringify(body) }) };
}
test('demo session and control require source/csrf and restrict static file access',async t => {
  const app=await run(t); let response=await app.get('/api/session'); const cookie=response.headers.get('set-cookie').split(';')[0]; const {csrf}=await response.json();
  assert.equal((await app.get('/.env')).status,404);
  assert.equal((await app.get('/server/app.mjs')).status,404);
  const body={request_id:randomUUID(),device_key:'demo-living-light',command:{action:'turn_off'}};
  assert.equal((await app.post('/api/control',body,{Cookie:cookie})).status,403);
  assert.equal((await app.post('/api/control',body,{Cookie:cookie,'x-ce-csrf':csrf,Origin:'https://example.invalid'})).status,403);
  assert.equal((await app.post('/api/control',body,{Cookie:cookie,'x-ce-csrf':csrf,'Content-Type':'text/plain'})).status,415);
  const result=await app.post('/api/control',body,{Cookie:cookie,'x-ce-csrf':csrf}); assert.equal(result.status,200); assert.equal((await result.json()).device.state,'off');
});
test('real mode is locked until login and login is throttled',async t => {
  const app=await run(t,{mode:'home-assistant',password:'demo-password-for-test'});
  assert.equal((await app.get('/api/home')).status,401);
  assert.equal((await (await app.get('/api/session')).json()).authenticated,false);
  for(let i=0;i<5;i++) assert.equal((await app.post('/api/login',{password:'wrong'})).status,401);
  assert.equal((await app.post('/api/login',{password:'demo-password-for-test'})).status,429);
});
test('duplicate control request sends once, changed payload conflicts',async t => {
  let calls=0;const adapter={snapshot:async()=>({devices:[]}),control:async()=>{calls++;return {state:'on'};}};
  const app=await run(t,{adapter});const response=await app.get('/api/session');const cookie=response.headers.get('set-cookie').split(';')[0];const {csrf}=await response.json();
  const headers={Cookie:cookie,'x-ce-csrf':csrf},body={request_id:randomUUID(),device_key:'demo-light',command:{action:'turn_on'}};
  const responses=await Promise.all([app.post('/api/control',body,headers),app.post('/api/control',body,headers)]);
  assert.ok(responses.every(x=>x.status===200));assert.equal(calls,1);
  assert.equal((await app.post('/api/control',{...body,command:{action:'turn_off'}},headers)).status,409);
});
test('invalid mode and insecure LAN exposure fail closed',async()=>{
  await assert.rejects(readConfig({CE_MODE:'typo'}));
  await assert.rejects(readConfig({CE_HOST:'0.0.0.0'}));
  await assert.rejects(readConfig({CE_MODE:'home-assistant'}));
});

test('model assets load locally while scripts and private build files stay restricted',async t=>{
  const app=await run(t);const response=await app.get('/assets/community-detail-v6.glb');
  assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'model/gltf-binary');
  const csp=response.headers.get('content-security-policy');
  assert.match(csp,/script-src 'self';/);assert.match(csp,/connect-src 'self' blob:;/);assert.match(csp,/img-src 'self' data: blob:;/);
  assert.equal((await app.get('/.local/detailed-model-v4b/community-source.blend')).status,404);
  assert.equal((await app.get('/assets/unknown.blend')).status,404);
});
