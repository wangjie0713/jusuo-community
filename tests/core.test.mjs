// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateMap, validateAction, createDemoAdapter, createHAAdapter, safeHAUrl } from '../server/adapters.mjs';

const mapping = { devices: [{ device_key: 'demo-light', name: '示例灯', room: '客厅', type: 'light', entity_id: 'light.demo_fixture' }] };
test('HA URL does not confuse a public hostname with a private IP', () => {
  assert.equal(safeHAUrl('http://homeassistant.local:8123'), 'http://homeassistant.local:8123');
  assert.throws(() => safeHAUrl('https://10.example.invalid'));
  assert.throws(() => safeHAUrl('http://user:pass@localhost:8123'));
  assert.throws(() => safeHAUrl('http://localhost:8123/private'));
});
test('mapping rejects duplicate keys and cross-domain control', () => {
  assert.equal(validateMap(mapping).length, 1);
  assert.throws(() => validateMap({ devices: [...mapping.devices, ...mapping.devices] }));
  assert.throws(() => validateMap({ devices: [{ ...mapping.devices[0], entity_id: 'lock.demo_fixture' }] }));
  assert.throws(() => validateMap({ devices: [{ ...mapping.devices[0], url: 'https://example.invalid' }] }));
});
test('demo enforces capability and unavailable boundaries, never accepts arbitrary services', async () => {
  const demo = createDemoAdapter();
  await demo.control('demo-living-light', { action: 'turn_off' });
  assert.equal((await demo.snapshot()).devices[0].state, 'off');
  await assert.rejects(demo.control('demo-entry-light', { action: 'turn_on' }));
  await assert.rejects(demo.control('demo-living-light', { action: 'set_temperature', value: 20 }));
  await assert.rejects(demo.control('demo-bedroom-climate', { action: 'set_temperature', value: 99 }));
  await assert.rejects(demo.control('demo-living-light', { action: 'turn_on', entity_id: 'light.other' }));
  await assert.rejects(demo.control('demo-missing', { action: 'turn_on' }));
});
test('HA uses explicit entity and service, reads state back, keeps identifiers private', async () => {
  let state = 'off'; const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, method: options.method || 'GET', body: options.body });
    if (options.method === 'POST') { state = 'on'; return Response.json([]); }
    return Response.json({ entity_id: 'light.demo_fixture', state, attributes: {} });
  };
  const ha = createHAAdapter({ baseUrl: 'http://localhost:8123', token: 'demo-only-token-not-real', devices: validateMap(mapping), fetchImpl });
  const result = await ha.control('demo-light', { action: 'turn_on' });
  assert.equal(result.state, 'on');
  assert.equal(calls.filter(x => x.method === 'POST').length, 1);
  assert.equal(calls.find(x => x.method === 'POST').url, 'http://localhost:8123/api/services/light/turn_on');
  assert.equal(JSON.stringify(await ha.snapshot()).includes('light.demo_fixture'), false);
});
test('HA uncertain readback does not reissue device action', async () => {
  let posts = 0;
  const fetchImpl = async (_url, options = {}) => {
    if (options.method === 'POST') { posts++; throw Error('private upstream detail'); }
    return Response.json({ state: 'off', attributes: {} });
  };
  const ha = createHAAdapter({ baseUrl: 'http://localhost:8123', token: 'demo-only-token-not-real', devices: validateMap(mapping), fetchImpl });
  await assert.rejects(ha.control('demo-light', { action: 'turn_on' }), /结果待核实/);
  assert.equal(posts, 1);
});
test('climate temperature uses actual bounds and supported modes', () => {
  const device = { type: 'climate', state: 'cool', online: true, min: 18, max: 28, step: 0.5, modes: ['off','cool'], temperature: 24 };
  assert.doesNotThrow(() => validateAction(device, { action: 'set_temperature', value: 23.5 }));
  assert.throws(() => validateAction(device, { action: 'set_temperature', value: 23.2 }));
});
