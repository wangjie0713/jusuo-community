// SPDX-License-Identifier: MPL-2.0
import { waitForExpectedState } from './control-verification.mjs';
import { isIP } from 'node:net';

export class UserError extends Error {
  constructor(message, status = 400, code = 'invalid_request') { super(message); this.status = status; this.code = code; }
}
const exact = (value, keys) => value && !Array.isArray(value) && typeof value === 'object' && Object.keys(value).every(k => keys.includes(k));
export function validateMap(value) {
  if (!exact(value, ['devices']) || !Array.isArray(value.devices) || !value.devices.length || value.devices.length > 50) throw new UserError('请配置 1 至 50 个基础设备。');
  const keys = new Set(), entities = new Set();
  return value.devices.map(d => {
    if (!exact(d, ['device_key','name','room','type','entity_id']) || !/^[a-z][a-z0-9-]{1,47}$/.test(d.device_key || '') || !['light','climate'].includes(d.type)) throw new UserError('设备配置格式不正确。');
    if (![d.name,d.room].every(s => typeof s === 'string' && s.trim().length > 0 && s.length <= 30 && !/[<>\x00-\x1f]/.test(s))) throw new UserError('请填写简短的设备和房间名称。');
    if (typeof d.entity_id !== 'string' || !new RegExp(`^${d.type}\\.[a-z0-9_]{1,100}$`).test(d.entity_id) || keys.has(d.device_key) || entities.has(d.entity_id)) throw new UserError('设备映射重复或类型不匹配。');
    keys.add(d.device_key); entities.add(d.entity_id);
    return Object.freeze({ ...d, name: d.name.trim(), room: d.room.trim() });
  });
}
export function validateAction(d, command) {
  if (!d || !d.online) throw new UserError('设备离线，请先在 Home Assistant 确认连接。', 409, 'device_offline');
  if (!exact(command, ['action','value']) || !['turn_on','turn_off','set_temperature'].includes(command.action)) throw new UserError('这个操作不在社区版支持范围内。');
  if (command.action !== 'set_temperature' && command.value !== undefined) throw new UserError('开关操作不需要额外参数。');
  if (command.action === 'set_temperature') {
    if (d.type !== 'climate' || !Number.isFinite(command.value) || command.value < d.min || command.value > d.max || Math.abs((command.value - d.min) / d.step - Math.round((command.value - d.min) / d.step)) > 1e-6) throw new UserError('请使用设备支持的温度范围和步长。');
  }
  if (d.type === 'climate' && command.action === 'turn_on' && !d.modes?.some(m => ['cool','heat','auto','heat_cool','dry','fan_only'].includes(m))) throw new UserError('设备没有可用的运行模式。');
  if (d.type === 'climate' && command.action === 'turn_off' && !d.modes?.includes('off')) throw new UserError('设备没有声明关闭模式。');
}
const baseDevices = [
  { device_key: 'demo-living-light', name: '客厅吊灯', room: '客厅', type: 'light', state: 'on', online: true },
  { device_key: 'demo-bedroom-light', name: '床头灯', room: '卧室', type: 'light', state: 'on', online: true },
  { device_key: 'demo-kitchen-light', name: '厨房照明', room: '厨房', type: 'light', state: 'off', online: true },
  { device_key: 'demo-entry-light', name: '玄关壁灯', room: '玄关', type: 'light', state: 'unavailable', online: false },
  { device_key: 'demo-living-climate', name: '客厅空调', room: '客厅', type: 'climate', state: 'cool', online: true, temperature: 24, current: 25.2, min: 16, max: 30, step: 1, modes: ['off','cool'] },
  { device_key: 'demo-bedroom-climate', name: '卧室空调', room: '卧室', type: 'climate', state: 'off', online: true, temperature: 26, current: 24.6, min: 16, max: 30, step: 1, modes: ['off','cool'] },
];
export function createDemoAdapter() {
  const devices = structuredClone(baseDevices);
  return {
    async snapshot() { return { devices: structuredClone(devices), updated_at: new Date().toISOString() }; },
    async control(key, action) {
      const d = devices.find(d => d.device_key === key); validateAction(d, action);
      if (action.action === 'set_temperature') d.temperature = action.value;
      else d.state = action.action === 'turn_off' ? 'off' : d.type === 'light' ? 'on' : 'cool';
      return structuredClone(d);
    },
  };
}
export function safeHAUrl(value) {
  let url; try { url = new URL(value); } catch { throw new UserError('HA_BASE_URL 需要填写完整地址。'); }
  const host = url.hostname;
  const local = ['localhost','host.docker.internal','homeassistant.local','[::1]'].includes(host) || (isIP(host) === 4 && /^(?:10\.|192\.168\.|127\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(host)) || /^[a-z0-9-]+\.local$/.test(host);
  if (!local || !['http:','https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new UserError('HA_BASE_URL 只接受无凭据和参数的本地 HTTP(S) 地址。');
  return url.origin;
}
function descriptor(mapping, state) {
  const a = state.attributes || {};
  const d = { device_key: mapping.device_key, name: mapping.name, room: mapping.room, type: mapping.type, state: String(state.state || 'unknown'), online: !['unavailable','unknown'].includes(state.state || 'unknown') };
  if (d.type === 'climate') {
    d.min = Number.isFinite(a.min_temp) ? a.min_temp : 16; d.max = Number.isFinite(a.max_temp) ? a.max_temp : 30;
    d.step = Number.isFinite(a.target_temp_step) && a.target_temp_step > 0 ? a.target_temp_step : 1;
    d.temperature = Number.isFinite(a.temperature) ? a.temperature : null;
    d.current = Number.isFinite(a.current_temperature) ? a.current_temperature : null;
    d.modes = Array.isArray(a.hvac_modes) ? a.hvac_modes.filter(x => ['off','cool','heat','auto','heat_cool','dry','fan_only'].includes(x)) : [];
  }
  return d;
}
export function createHAAdapter({ baseUrl, token, devices, fetchImpl = fetch }) {
  baseUrl = safeHAUrl(baseUrl);
  async function request(path, body) {
    let response;
    try {
      response = await fetchImpl(baseUrl + path, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', ...(body ? { 'Content-Type':'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(7000), redirect: 'error' });
    } catch { throw new UserError(body ? '指令结果待核实，请查看设备状态，暂勿重复发送。' : '暂时连不上 Home Assistant，请检查服务器和网络。', 503, body ? 'unconfirmed' : 'ha_unavailable'); }
    if (!response.ok) throw new UserError(response.status === 401 ? 'Home Assistant 授权失效，请在服务器检查令牌。' : body ? '指令结果待核实，请查看设备状态，暂勿重复发送。' : '设备状态读取失败，请检查本机映射。', 503, body ? 'unconfirmed' : 'ha_unavailable');
    try { return await response.json(); } catch { throw new UserError(body ? '指令结果待核实，请先查看设备状态。' : '设备状态暂时无法读取。', 503, body ? 'unconfirmed' : 'ha_unavailable'); }
  }
  const read = m => request(`/api/states/${m.entity_id}`);
  return {
    async snapshot() { return { devices: await Promise.all(devices.map(async m => descriptor(m, await read(m)))), updated_at: new Date().toISOString() }; },
    async control(key, command) {
      const m = devices.find(d => d.device_key === key);
      if (!m) throw new UserError('未找到已配置设备。', 404);
      const current = descriptor(m, await read(m)); validateAction(current, command);
      let service, args, expected;
      if (command.action === 'set_temperature') { service = 'set_temperature'; args = { temperature: command.value }; expected = s => Math.abs((s.attributes?.temperature ?? Infinity) - command.value) < 0.01; }
      else if (m.type === 'climate') {
        const mode = command.action === 'turn_off' ? 'off' : current.state !== 'off' && current.modes.includes(current.state) ? current.state : current.modes.find(x => x !== 'off');
        service = 'set_hvac_mode'; args = { hvac_mode: mode }; expected = s => s.state === mode;
      } else { service = command.action; args = {}; expected = s => s.state === (service === 'turn_on' ? 'on' : 'off'); }
      const before = await read(m);
      if (m.type === 'light' && Array.isArray(before.attributes?.entity_id) && before.attributes.entity_id.length > 1) throw new UserError('请映射单个灯具；社区版暂不操作会联动多个灯的灯组。',409);
      if (expected(before)) return descriptor(m, before);
      await request(`/api/services/${m.type}/${service}`, { entity_id: m.entity_id, ...args });
      try { return descriptor(m, await waitForExpectedState({ readState: () => read(m), matches: expected, timeoutMs: 5000, intervalMs: 350 })); }
      catch { throw new UserError('指令已发送，结果待核实。请查看设备状态，暂勿重复发送。', 409, 'unconfirmed'); }
    },
  };
}
